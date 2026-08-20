/**
 * Optimized FreeSWITCH ↔ OpenAI Realtime voice bridge.
 *
 * Single-model design: gpt-realtime handles conversation AND booking via tools.
 * Audio is delivered to the caller via mod_audio_stream's `streamAudio` JSON
 * message (requires STREAM_PLAYBACK=1 set on the channel before
 * uuid_audio_stream start, and STREAM_SAMPLE_RATE must NOT be set since the
 * sample rate already travels inside the JSON payload).
 *
 * No FIFO, no temp files — buffered chunks are sent as one streamAudio
 * message per AI turn (on response.output_audio.done).
 *
 * Deploy next to session.js on your FreeSWITCH bridge host.
 * Env: OPENAI_API_KEY, OD_API_KEY, OD_BASE_URL, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
 */
const WebSocket = require("ws");
const session = require("./session");
const { Connection } = require("modesl");
const axios = require("axios");
const moment = require("moment");
const chrono = require("chrono-node");
const nodemailer = require("nodemailer");
const {
    loadCallConfig,
    buildDynamicInstructions,
    buildDynamicGreeting,
    executeHttpTool,
} = require("./ai_runtime_config");
require("dotenv").config();

// ─── ESL (global control connection) ──────────────────────────────────────────
let eslConn = null;
let eslReady = false;
const fsConnections = new Map();

function connectESL() {
    eslConn = new Connection("127.0.0.1", 8021, "ClueCon", () => {
        eslReady = true;
        console.log("✅ ESL connected");
    });

    eslConn.on("error", (err) => {
        console.error("❌ ESL error:", err.message);
        eslReady = false;
        setTimeout(connectESL, 3000);
    });

    eslConn.on("esl::end", () => {
        console.warn("⚠️ ESL disconnected — reconnecting");
        eslReady = false;
        setTimeout(connectESL, 3000);
    });
}

connectESL();

function eslApi(cmd) {
    return new Promise((resolve, reject) => {
        if (!eslReady || !eslConn) return reject(new Error("ESL not ready"));
        eslConn.api(cmd, (res) => resolve(res.getBody()));
    });
}

// ─── OpenDental client ─────────────────────────────────────────────────────────
const http = require("http");
const https = require("https");

const DEFAULT_OD_API_KEY = process.env.OD_API_KEY || "";
const DEFAULT_OD_BASE_URL = process.env.OD_BASE_URL || "https://api.opendental.com/api/v1";
const tenantApiClients = new Map();

function getTenantApiClient(callConfig, tenantKey) {
    const settings = callConfig?.settings || {};
    const baseURL =
        settings.od_base_url ||
        settings.api_base_url ||
        DEFAULT_OD_BASE_URL;
    const apiKey =
        settings.od_api_key ||
        settings.api_key ||
        DEFAULT_OD_API_KEY;
    const authScheme = settings.od_auth_scheme || "ODFHIR";
    const headerName = settings.api_auth_header || "Authorization";
    const cacheKey = `${tenantKey}::${baseURL}::${authScheme}::${headerName}::${apiKey}`;

    const cached = tenantApiClients.get(cacheKey);
    if (cached) return cached;

    const headers = {
        "Content-Type": "application/json",
    };
    if (apiKey) {
        headers[headerName] = `${authScheme} ${apiKey}`;
    }

    const client = axios.create({
        baseURL,
        headers,
        timeout: 10000,
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true }),
    });
    tenantApiClients.set(cacheKey, client);
    return client;
}

// ─── WebSocket server (FreeSWITCH mod_audio_stream connects here) ────────────
const wss = new WebSocket.Server({ port: 8085 });
console.log("🌐 WebSocket Bridge running on port 8085");

function safeResponseCreate(openaiWs, state) {
    if (openaiWs.readyState !== WebSocket.OPEN) return;
    if (state.responseInProgress) {
        resetTurnState(state, "supersede");
        openaiWs.send(JSON.stringify({ type: "response.cancel" }));
        state.pendingResponse = true;
        return;
    }
    state.responseInProgress = true;
    openaiWs.send(JSON.stringify({ type: "response.create" }));
}

// ─── Realtime tools (single model handles booking) ────────────────────────────
function buildRealtimeTools() {
    return [
        {
            type: "function",
            name: "get_available_slots",
            description:
                "Get open appointment times for a specific date. Call when the patient wants to book, reschedule, or asks what times are available.",
            parameters: {
                type: "object",
                properties: {
                    date: { type: "string", description: "Appointment date in YYYY-MM-DD format" },
                },
                required: ["date"],
            },
        },
        {
            type: "function",
            name: "book_appointment",
            description:
                "Book a confirmed appointment. Only call after the patient clearly chose a date and time that matches an available slot.",
            parameters: {
                type: "object",
                properties: {
                    date: { type: "string", description: "YYYY-MM-DD" },
                    time: { type: "string", description: "HH:mm:ss in 24-hour format" },
                },
                required: ["date", "time"],
            },
        },
        {
            type: "function",
            name: "confirm_booking",
            description:
                "Executes the pending appointment after the patient says yes to confirmation. Only call after the patient explicitly confirms.",
            parameters: {
                type: "object",
                properties: {},
            },
        }
    ];
}

const CHRONO_OPTIONS = { forwardDate: true };

// Realtime conversation tuning (lower = snappier, higher = fewer false interrupts)
const BARGE_IN_GRACE_MS = 400;
const BARGE_IN_VARIANCE_MIN = 65;
const BARGE_IN_CHUNKS = 999;
const VAD_SILENCE_MS = 80;
const VAD_THRESHOLD = 0.5;
const ASAP_PHRASES = ["as soon as possible", "asap", "earliest", "next available"];
const PROVIDER_CACHE_TTL_MS = 10 * 60 * 1000;
const SLOT_CACHE_TTL_MS = 30 * 1000;

function toDateString(m) {
    return m.clone().startOf("day").format("YYYY-MM-DD");
}

function mondayOfNextWeek() {
    return moment().startOf("isoWeek").add(1, "week");
}

function mondayOfThisWeek() {
    const monday = moment().startOf("isoWeek");
    const today = moment().startOf("day");
    return monday.isBefore(today) ? today : monday;
}

function thisWeekendDate() {
    const today = moment().startOf("day");
    const day = today.day();
    if (day === 6 || day === 0) return today;
    return today.clone().add(6 - day, "days");
}

function nextWeekendDate() {
    const today = moment().startOf("day");
    if (today.day() === 0) return today.clone().add(6, "days");
    return thisWeekendDate().clone().add(7, "days");
}

function parseNaturalDate(text) {
    if (!text || typeof text !== "string") return null;

    const raw = text.trim();
    const iso = moment(raw, "YYYY-MM-DD", true);
    if (iso.isValid()) return iso.format("YYYY-MM-DD");

    const lower = raw.toLowerCase();
    if (ASAP_PHRASES.some((phrase) => lower.includes(phrase))) {
        return toDateString(moment().startOf("day"));
    }

    if (lower.includes("next weekend")) return toDateString(nextWeekendDate());
    if (lower.includes("this weekend")) return toDateString(thisWeekendDate());
    if (lower.includes("next week")) return toDateString(mondayOfNextWeek());
    if (lower.includes("this week")) return toDateString(mondayOfThisWeek());

    const parsed = chrono.parseDate(raw, new Date(), CHRONO_OPTIONS);
    if (!parsed) return null;
    return moment(parsed).format("YYYY-MM-DD");
}

function parseNaturalTime(text) {
    if (!text || typeof text !== "string") return null;

    const results = chrono.parse(text, new Date(), CHRONO_OPTIONS);
    for (const result of results) {
        if (!result.start.isCertain("hour")) continue;
        const hour = result.start.get("hour");
        const min = result.start.get("minute") || 0;
        return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
    }
    return null;
}

function todayStrings() {
    const today = moment().startOf("day");
    return {
        today: toDateString(today),
        tomorrow: toDateString(today.clone().add(1, "day")),
        dayAfter: toDateString(today.clone().add(2, "days")),
    };
}

function buildTenantKey(mem = {}) {
    const companyId = mem.company_id ?? "default-company";
    const extension = mem.extension ?? "default-extension";
    return `${companyId}::${extension}`;
}

function buildInstructions(patient, dates) {
    const { today, tomorrow, dayAfter } = dates;
    return `You are a friendly AI dental receptionist for Smile Centers PC.

PATIENT ON THIS CALL:
- Name: ${patient.patientName || "Unknown"}
- Phone: ${patient.phone || "Unknown"}
- Email: ${patient.email || "Unknown"}
- Date of birth: ${patient.patient_dob || "Unknown"}

Today: ${today}, Tomorrow: ${tomorrow}, Day after tomorrow: ${dayAfter}

DATE RULES (always pass YYYY-MM-DD to tools):
- "ASAP", "as soon as possible", "earliest", "next available" → ${today}
- "today" → ${today}
- "tomorrow" → ${tomorrow}
- "day after tomorrow" → ${dayAfter}
- Relative dates such as:
  - next Monday
  - this Friday
  - next week
  - this week
  - next weekend
  - this weekend
  - next month
  - June 25th
  - two weeks from now
  must be converted to a valid YYYY-MM-DD date before calling tools. Let Chrono resolve the actual date.
- Named dates without a year use the current year; if that date already passed, use next year

CONVERSATION RULES:
- Greet the patient by name on the first message only.
- Listen and respond ONLY to what they ask.
- Keep replies SHORT and conversational. Never repeat yourself.
- NEVER hang up — wait for the patient to disconnect.
- Cancel requests: say you cannot cancel by phone; ask them to call during office hours.
- Reschedule requests: say the team can help during office hours.
- NEVER call get_available_slots or book_appointment with a date earlier than ${today}.
- If the patient requests a date that has already passed, do NOT call any tool. Tell them that date has already passed and ask for a current or future date.

BOOKING (use tools — do NOT guess availability):
- When booking intent appears, call get_available_slots with the date.
- Read times AND doctor names naturally from tool results, e.g. "I have 10 AM with Dr. Brian Albert and 2 PM with Dr. Sarah Jones — which works for you?"
- If all slots have the same doctor, mention the doctor once: "All slots are with Dr. Brian Albert — I have 10 AM and 2 PM available."
- Always mention the doctor name alongside the time so the patient knows who they'll see.
- When the patient picks a time, before calling book_appointment, confirm by repeating the date and time back, e.g. "Just to confirm, book you for [date] at [time] — is that correct?"
- Only call book_appointment after the patient confirms "yes". If they say "no", ask which date and time they'd prefer instead, and do not call book_appointment.
- If a time is ambiguous (e.g. "4:55"), pick AM/PM based on which falls inside a returned slot.
- If book_appointment returns success: false and alreadyBooked: true, say exactly: "Sorry, that time is already booked. Please select a different time." Then list the alternatives from the result naturally, e.g. "I have [time1] and [time2] available — which works for you?"
- If book_appointment returns success: false (without alreadyBooked), tell the patient that exact time isn't available, state the available time range from the result, and ask them to pick a time within it.
- After book_appointment succeeds, confirm warmly, let them know they'll receive a confirmation via SMS or email shortly, and say goodbye. Do not ask more questions.
- If book_appointment fails, apologize and offer to connect to staff.
- When the patient confirms "yes", call confirm_booking (no parameters needed). Do NOT call book_appointment again.`;
}

function resolveCallContext(mem, pending, reqUrl) {
    const qs = {};
    try {
        const q = (reqUrl || "").split("?")[1] || "";
        for (const part of q.split("&")) {
            if (!part) continue;
            const [k, v] = part.split("=");
            qs[decodeURIComponent(k)] = decodeURIComponent(v || "");
        }
    } catch (_) { /* ignore */ }

    const companyId =
        mem.company_id ??
        pending?.company_id ??
        qs.company_id ??
        process.env.AI_COMPANY_ID ??
        null;

    const extension =
        mem.extension ||
        pending?.extension ||
        qs.extension ||
        process.env.AI_EXTENSION ||
        null;

    return { companyId, extension };
}

const BOOKING_TOOL_NAMES = new Set(["get_available_slots", "book_appointment", "confirm_booking"]);

/**
 * Resolves the final tool list for a session.
 *
 * - No DB tools → return hardcoded booking tools (dental fallback).
 * - DB tools exist AND include at least one booking tool name → merge in
 *   hardcoded booking tools only where the DB schema is incomplete, so the
 *   booking flow always has valid parameters.
 * - DB tools exist but NO booking tool names → this is a non-booking AI
 *   (e.g. FAQ, support); return DB tools as-is without injecting booking tools.
 */
function resolveSessionTools(callConfig) {
    const hardcoded = buildRealtimeTools();
    const dbTools = callConfig?.tools;
    if (!dbTools?.length) return hardcoded;

    // Check whether the DB has defined any booking-related tools
    const dbHasBookingTools = dbTools.some((t) => BOOKING_TOOL_NAMES.has(t.name));
    if (!dbHasBookingTools) {
        // Non-booking AI — use DB tools exactly as configured
        return dbTools;
    }

    // Booking AI — merge hardcoded booking tools as fallback schema only
    const result = [...dbTools];
    const indexByName = new Map(result.map((t, idx) => [t.name, idx]));

    for (const fallbackTool of hardcoded) {
        const idx = indexByName.get(fallbackTool.name);
        if (idx === undefined) {
            // DB didn't include this booking tool at all — add it
            indexByName.set(fallbackTool.name, result.length);
            result.push(fallbackTool);
            continue;
        }

        // DB has this tool — only override if its parameter schema is missing or incomplete
        const existingTool = result[idx];
        const existingParams = existingTool.parameters || {};
        const existingProps = existingParams.properties || {};
        const existingRequired = Array.isArray(existingParams.required)
            ? existingParams.required
            : [];

        const fallbackParams = fallbackTool.parameters || {};
        const fallbackRequired = Array.isArray(fallbackParams.required)
            ? fallbackParams.required
            : [];

        const existingHasAnyProps =
            existingProps &&
            typeof existingProps === "object" &&
            Object.keys(existingProps).length > 0;

        const missingRequiredKeys =
            fallbackRequired.length > 0
                ? fallbackRequired.some((k) => !existingRequired.includes(k))
                : false;

        if (!existingHasAnyProps || missingRequiredKeys) {
            result[idx] = fallbackTool;
        }
    }

    return result;
}

// ─── Slot / booking helpers ────────────────────────────────────────────────────
function formatSlotTimes(slots) {
    return slots.map((s) => {
        const start = new Date(s.DateTimeStart).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
        const end = new Date(s.DateTimeEnd).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
        return `${start} to ${end}`;
    });
}

const slotCacheByTenantDate = new Map();
async function fetchSlots(uuid, date, tenantKey, apiClient, slotsPath) {
    const mem = (await session.get(uuid)) || {};
    if (mem.slots?.length > 0 && mem.date === date) {
        console.log("⚡ CACHE HIT");
        return mem.slots;
    }

    const slotCacheKey = `${tenantKey}::${date}`;
    const cached = slotCacheByTenantDate.get(slotCacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        console.log("⚡ TENANT SLOT CACHE HIT");
        await session.set(uuid, { date, slots: cached.slots });
        return cached.slots;
    }
    console.log("🌐 API HIT");

    const resolvedSlotsPath = slotsPath || "/appointments/Slots";
    const resp = await apiClient.get(resolvedSlotsPath, { params: { date } });
    const slots = resp.data || [];
    await session.set(uuid, { date, slots });
    slotCacheByTenantDate.set(slotCacheKey, {
        slots,
        expiresAt: Date.now() + SLOT_CACHE_TTL_MS,
    });
    return slots;
}

// ─── Check already booked appointments ────────────────────────────────────────
async function fetchBookedAppointments(date, apiClient) {
    const resp = await apiClient.get("/appointments", { params: { date } });
    return resp.data || [];
}

function isSlotAlreadyBooked(bookedAppointments, date, time) {
    // Build request minutes from HH:mm:ss
    const [reqH, reqM] = time.split(":").map(Number);
    const reqMinutes = reqH * 60 + reqM;

    return bookedAppointments.some((apt) => {
        // Only block on active statuses
        if (!["Scheduled", "Complete", "ASAP"].includes(apt.AptStatus)) return false;

        const aptDateTime = apt.AptDateTime; // "2026-06-25 13:00:00"
        if (!aptDateTime) return false;

        const [aptDate, aptTime] = aptDateTime.split(" ");
        if (aptDate !== date) return false;

        const [aptH, aptM] = aptTime.split(":").map(Number);
        const aptStartMinutes = aptH * 60 + aptM;

        // Each "/" or "X" in Pattern = 15 minutes
        const pattern = apt.Pattern || "//";
        const durationMins = pattern.length * 15;
        const aptEndMinutes = aptStartMinutes + durationMins;

        // Overlap: requested time falls within [start, end)
        return reqMinutes >= aptStartMinutes && reqMinutes < aptEndMinutes;
    });
}

// ─── Check Doctors appointments ────────────────────────────────────────
const providerCacheByTenant = new Map();
async function fetchProviders(tenantKey, apiClient) {
    const cached = providerCacheByTenant.get(tenantKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.providers;
    }

    const resp = await apiClient.get("/providers");
    const providers = resp.data || [];
    providerCacheByTenant.set(tenantKey, {
        providers,
        expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS,
    });
    console.log(`👨‍⚕️ Providers cached (${tenantKey}): ${providers.length}`);
    return providers;
}

function getProviderName(providers, provNum) {
    const p = providers.find((p) => p.ProvNum === provNum);
    if (!p) return null;
    const parts = [p.FName, p.MI ? p.MI + "." : null, p.LName].filter(Boolean);
    return "Dr. " + parts.join(" ");
}

function findSlotForTime(slots, date, time) {
    const reqMinutes = parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]);

    return slots.find((s) => {
        const startTime = s.DateTimeStart.split(" ")[1];
        const endTime = s.DateTimeEnd.split(" ")[1];

        const startMinutes = parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]);
        const endMinutes = parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1]);

        return reqMinutes >= startMinutes && reqMinutes <= endMinutes;
    });
}

function minutesToPattern(startISO, endISO) {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const mins = Math.max(15, Math.round((end - start) / 60000));
    return "/".repeat(Math.round(mins / 15)); // 15-min units
}

async function executeBookAppointment(uuid, callerPhone, mem, date, time, selectedSlot, providers = [], apiClient) {
    const p = mem.patientData || {};
    // const dateTimeStr = `${date}T${time}`;
    const dateTimeStr = `${date} ${time}`;
    const startISO = new Date(dateTimeStr);
    const endISO = new Date(startISO.getTime() + 30 * 60000);

    const payload = {
        AptDateTime: dateTimeStr,
        PatNum: Number(p.patNum ?? "1"),
        ProvNum: Number(p.ProvNum ?? "1"),
        Pattern: minutesToPattern(startISO.toISOString(), endISO.toISOString()),
        Op: selectedSlot.OpNum ?? "1",
        Note: "Booked via AI Voice",
        email: p.email,
    };
    console.log('payload390', payload);


    console.time("OD_POST");
    const created = await apiClient.post("/appointments", payload);
    // console.log('created',created);

    console.timeEnd("OD_POST");

    const doctorName = getProviderName(providers, selectedSlot.ProvNum) || `Provider ${selectedSlot.ProvNum}`;

    const appointment = {
        appointment_id: created.data?.AptNum || created.data?.AppointmentNum || created.data?.AptNumNew || null,
        status: "booked",
        provider: payload.ProvNum,
        start: payload.AptDateTime,
        patientName: p.patientName,
        email: payload.email,
        doctor: doctorName
    };

    // ✅ Background, non-blocking, fire-and-forget — never delays the voice response
    queueBookingEmail(appointment);

    await session.set(uuid, { date: null, time: null, slots: [] });
    return appointment;
}

async function handleToolCall(uuid, caller, mem, name, argsJson, state, callConfig = null) {
    let args;
    try {
        args = JSON.parse(argsJson || "{}");
    } catch {
        return { error: "Invalid tool arguments" };
    }

    // If this tool is configured in ai_functions with an HTTP endpoint,
    // execute it (even for the built-in booking tool names).
    const configuredFn = callConfig?.functions?.find((f) => f.function_name === name);
    if (configuredFn?.endpoint_url) {
        return executeHttpTool(configuredFn, args);
    }

    const tenantKey = buildTenantKey(mem);
    const apiClient = getTenantApiClient(callConfig, tenantKey);
    const slotsPath = callConfig?.settings?.od_slots_path || null;

    const localToolHandlers = {
        get_available_slots: async () => {
            const date = parseNaturalDate(args.date) || args.date;
            if (!date) return { error: "date is required (YYYY-MM-DD)" };

            try {
                console.time("GET_SLOTS");
                const [slots, providers] = await Promise.all([
                    fetchSlots(uuid, date, tenantKey, apiClient, slotsPath),
                    fetchProviders(tenantKey, apiClient),
                ]);
                console.timeEnd("GET_SLOTS");

                if (!slots.length) {
                    return { date, available: false, message: "No openings on this date." };
                }
                return {
                    date,
                    available: true,
                    slots: slots.map((s) => ({
                        start: s.DateTimeStart,
                        end: s.DateTimeEnd,
                        display: formatSlotTimes([s])[0],
                        doctor: getProviderName(providers, s.ProvNum),
                    })),
                };
            } catch (err) {
                console.error("❌ Slots error:", err.message);
                return { error: "Could not retrieve availability. Ask patient to hold." };
            }
        },

        book_appointment: async () => {
            const date = parseNaturalDate(args.date) || args.date;
            const time = parseNaturalTime(args.time) || args.time;
            if (!date || !time) return { error: "date and time are required" };

            await session.set(uuid, { date, time });
            mem = (await session.get(uuid)) || mem;

            try {
                let slots = mem.slots || [];
                if (!slots.length || mem.date !== date) {
                    slots = await fetchSlots(uuid, date, tenantKey, apiClient, slotsPath);
                    mem = (await session.get(uuid)) || mem;
                }

                const [selectedSlot, providers] = await Promise.all([
                    Promise.resolve(findSlotForTime(slots, date, time)),
                    fetchProviders(tenantKey, apiClient),
                ]);

                if (!selectedSlot) {
                    const readable = new Date(`${date}T${time}`).toLocaleTimeString([], {
                        hour: "2-digit", minute: "2-digit", hour12: true,
                    });
                    return {
                        success: false,
                        message: `${readable} is not available.`,
                        alternatives: formatSlotTimes(slots),
                    };
                }

                // ─── Check if already booked ─────────────────────────────────────────
                try {
                    const bookedAppointments = await fetchBookedAppointments(date, apiClient);

                    if (isSlotAlreadyBooked(bookedAppointments, date, time)) {
                        const readable = new Date(`${date}T${time}`).toLocaleTimeString([], {
                            hour: "2-digit", minute: "2-digit", hour12: true,
                        });
                        const bookedStartTimes = bookedAppointments
                            .filter((apt) => ["Scheduled", "Complete", "ASAP"].includes(apt.AptStatus))
                            .map((apt) => apt.AptDateTime?.split(" ")[1])
                            .filter(Boolean);
                        const freeSlots = slots.filter((s) => {
                            const slotTime = s.DateTimeStart.split(" ")[1];
                            return !bookedStartTimes.includes(slotTime);
                        });
                        return {
                            success: false,
                            alreadyBooked: true,
                            message: `${readable} is already booked.`,
                            alternatives: formatSlotTimes(freeSlots),
                        };
                    }
                } catch (err) {
                    console.warn("⚠️ Could not verify existing bookings:", err.message);
                }

                // ─── Save pending booking — wait for confirmation ─────────────────────
                await session.set(uuid, {
                    ...mem,
                    pendingBooking: { date, time, selectedSlot, providers },
                });

                const readable = new Date(`${date}T${time}`).toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit", hour12: true,
                });
                return {
                    needsConfirmation: true,
                    message: `Shall I book you in for ${date} at ${readable}?`,
                };

            } catch (err) {
                console.error("❌ Booking error:", err.message);
                return { success: false, error: "System error during booking." };
            }
        },

        confirm_booking: async () => {
            mem = (await session.get(uuid)) || mem;
            const pending = mem.pendingBooking;

            if (!pending) {
                return { success: false, error: "No pending booking to confirm." };
            }

            const { date, time, selectedSlot, providers } = pending;

            // Clear pending regardless of outcome
            await session.set(uuid, { ...mem, pendingBooking: null });

            try {
                console.time("BOOK_APPOINTMENT");
                await executeBookAppointment(uuid, caller, mem, date, time, selectedSlot, providers, apiClient);
                console.timeEnd("BOOK_APPOINTMENT");
                state.hangupAfterResponse = true;

                const readable = new Date(`${date}T${time}`).toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit", hour12: true,
                });
                return { success: true, message: `Booked for ${date} at ${readable}` };

            } catch (err) {
                console.error("❌ Booking error:", err.message);
                return { success: false, error: "System error during booking." };
            }
        },
    };

    const localHandler = localToolHandlers[name];
    if (localHandler) {
        return localHandler();
    }

    return { error: `Unknown tool: ${name}` };
}

function sendFunctionOutput(openaiWs, state, callId, output) {
    openaiWs.send(
        JSON.stringify({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: callId,
                output: typeof output === "string" ? output : JSON.stringify(output),
            },
        })
    );
    safeResponseCreate(openaiWs, state);
}

// ─── Background session enrichment (never blocks speech) ──────────────────────
function updateSessionFromTranscript(uuid, transcript) {
    const update = {};
    const parsedDate = parseNaturalDate(transcript);
    if (parsedDate) update.date = parsedDate;

    const parsedTime = parseNaturalTime(transcript);
    if (parsedTime) update.time = parsedTime;

    if (!Object.keys(update).length) return;

    session.set(uuid, update).then(() => {
        console.log("📝 Session updated:", update);
        if (update.date) {
            session
                .get(uuid)
                .then((currentMem) => {
                    const tenantKey = buildTenantKey(currentMem || {});
                    const apiClient = getTenantApiClient(
                        { settings: currentMem?.api_client_settings || {} },
                        tenantKey
                    );
                    const slotsPath = currentMem?.api_client_settings?.od_slots_path || null;
                    return fetchSlots(uuid, update.date, tenantKey, apiClient, slotsPath);
                })
                .then(() => console.log(`⚡ Pre-fetched slots for ${update.date}`))
                .catch((err) => console.error("Prefetch error:", err.message));
        }
    });
}

// ─── Turn-state reset (replaces old FIFO flushPlayback) ───────────────────────
/** Clear barge-in buffers between AI turns. No FIFO, no files — nothing to flush on disk. */
function resetTurnState(state, reason) {
    state.bargeInBuffer = [];
    state.bargeInTriggered = false;
    console.log(`🔄 Turn reset (${reason})`);
}

// ─── FS connection handler ─────────────────────────────────────────────────────
wss.on("connection", async (fsSocket, req) => {
    console.log("🔗 Raw URL:", req.url);
    let uuid = null;
    let caller = null;
    let pendingMeta = null;

    const state = {
        aiSpeaking: false,
        responseInProgress: false,
        echoSuppressUntil: 0,
        bargeInBuffer: [],
        bargeInTriggered: false,
        bargeInAllowedAfter: 0,
        hangupAfterResponse: false,
        pendingResponse: false,
        audioChunks: [],
    };

    const pathPart = req.url.replace(/^\//, "").split("?")[0];
    if (pathPart && pathPart.length > 5) {
        uuid = pathPart;
        const pending = await session.get(`pending_stream_${uuid}`);
        if (pending) {
            caller = pending.caller;
            pendingMeta = pending;
            await session.delete(`pending_stream_${uuid}`);
        }
    }
    fsConnections.set(uuid, fsSocket);

    if (!uuid) {
        const allKeys = await session.keys("pending_stream_*");
        if (allKeys.length > 0) {
            let newest = null;
            let newestTime = 0;
            for (const key of allKeys) {
                const data = await session.get(key);
                if (data?.createdAt > newestTime) {
                    newestTime = data.createdAt;
                    newest = { key, data };
                }
            }
            if (newest) {
                uuid = newest.data.uuid;
                caller = newest.data.caller;
                pendingMeta = newest.data;
                await session.delete(newest.key);
            }
        }
    }

    if (!uuid) {
        console.error("❌ Could not determine UUID — closing");
        fsSocket.close();
        return;
    }

    console.log(`✅ FINAL | UUID: ${uuid} | Caller: ${caller}`);

    let mem = (await session.get(uuid)) || {};
    const { companyId, extension } = resolveCallContext(mem, pendingMeta, req.url);
    console.log(`🧠 AI config lookup | company: ${companyId} | extension: ${extension}`);

    const callConfig = await loadCallConfig({
        companyId,
        extension,
        direction: mem.direction || pendingMeta?.direction || null,
    });
    console.log(
        `🧠 AI config source | prompt=${callConfig.source.prompt} tools=${callConfig.source.tools} settings=${callConfig.source.settings} direction=${callConfig.direction}`
    );

    if (companyId || extension) {
        await session.set(uuid, {
            company_id: companyId,
            extension,
        });
        mem = (await session.get(uuid)) || mem;
    }

    await session.set(uuid, {
        api_client_settings: callConfig?.settings || null,
    });
    mem = (await session.get(uuid)) || mem;

    const openaiWs = connectToOpenAI(uuid, caller, mem, state, callConfig);

    let audioBuffer = [];

    fsSocket.on("message", (data) => {
        const level = getAudioLevel(data);
        const variance = getAudioVariance(data);
        if (level < 5 || variance < 5) return;

        // Echo guard applies after AI finishes — must not block barge-in while AI is speaking
        if (!state.aiSpeaking && Date.now() < state.echoSuppressUntil) {
            audioBuffer = [];
            state.bargeInBuffer = [];
            return;
        }

        if (state.aiSpeaking) {
            if (variance < BARGE_IN_VARIANCE_MIN) return;
            if (Date.now() < state.bargeInAllowedAfter) {
                state.bargeInBuffer = [];
                return;
            }

            state.bargeInBuffer.push(data);
            if (state.bargeInBuffer.length >= BARGE_IN_CHUNKS && !state.bargeInTriggered) {
                state.bargeInTriggered = true;
                console.log("🛑 BARGE-IN — stopping AI");
                const bargeAudio = Buffer.concat(state.bargeInBuffer);
                state.bargeInBuffer = [];

                resetTurnState(state, "barge-in");

                if (openaiWs.readyState === WebSocket.OPEN && state.responseInProgress) {
                    openaiWs.send(JSON.stringify({ type: "response.cancel" }));
                }

                state.aiSpeaking = false;
                state.responseInProgress = false;
                state.pendingResponse = false;
                state.echoSuppressUntil = 0;
                state.audioChunks = [];

                if (openaiWs.readyState === WebSocket.OPEN) {
                    const upsampled = upsample8kTo24k(bargeAudio);
                    openaiWs.send(
                        JSON.stringify({
                            type: "input_audio_buffer.append",
                            audio: upsampled.toString("base64"),
                        })
                    );
                }
            }
            return;
        }

        state.bargeInBuffer = [];
        audioBuffer.push(data);

        if (audioBuffer.length >= 1 && openaiWs.readyState === WebSocket.OPEN) {
            const combined = Buffer.concat(audioBuffer);
            audioBuffer = [];
            openaiWs.send(
                JSON.stringify({
                    type: "input_audio_buffer.append",
                    audio: upsample8kTo24k(combined).toString("base64"),
                })
            );
        }
    });

    fsSocket.on("close", () => {
        console.log(`📴 Caller disconnected | UUID: ${uuid}`);
        if (openaiWs?.readyState === WebSocket.OPEN) openaiWs.close();
        fsConnections.delete(uuid);
    });

    fsSocket.on("error", (err) => console.error("❌ Socket error:", err.message));
});

// ─── OpenAI Realtime (single model) ────────────────────────────────────────────
function connectToOpenAI(uuid, caller, mem, state, callConfig = null) {
    const p = {
        ...(mem.patientData || {}),
        phone: mem.patientData?.phone || mem.phone || caller || "Unknown",
    };
    const patientName = p.patientName || "there";
    const dates = todayStrings();

    const instructions =
        callConfig?.prompt?.prompt_body
            ? buildDynamicInstructions(callConfig.prompt, p, dates)
            : buildInstructions(p, dates);

    const tools = resolveSessionTools(callConfig);

    const greetingText = callConfig?.prompt
        ? buildDynamicGreeting(callConfig.prompt, patientName, dates)
        : `[Call started. Greet the caller warmly and briefly by their name: ${patientName}.]`;

    const apiKey =
        callConfig?.settings?.api_key || process.env.OPENAI_API_KEY;
    const model =
        callConfig?.settings?.model || "gpt-realtime";
    const voice = "alloy";

    let callActive = true;

    const openaiWs = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
        {
            headers: { Authorization: `Bearer ${apiKey}` },
        }
    );

    openaiWs.on("open", () => {
        console.log(`✅ OpenAI connected | UUID: ${uuid} | model: ${model}`);

        openaiWs.send(
            JSON.stringify({
                type: "session.update",
                session: {
                    type: "realtime",
                    instructions,
                    tools,
                    tool_choice: "auto",
                    audio: {
                        input: {
                            transcription: { model: "gpt-4o-mini-transcribe" },
                            turn_detection: {
                                type: "server_vad",
                                threshold: VAD_THRESHOLD,
                                prefix_padding_ms: 300,
                                silence_duration_ms: VAD_SILENCE_MS,
                                create_response: false,
                            },
                        },
                        output: { voice },
                    },
                },
            })
        );

        openaiWs.send(
            JSON.stringify({
                type: "conversation.item.create",
                item: {
                    type: "message",
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: greetingText,
                        },
                    ],
                },
            })
        );

        safeResponseCreate(openaiWs, state);
    });

    openaiWs.on("message", async (rawData) => {
        if (!callActive) return;

        const event = JSON.parse(rawData);

        switch (event.type) {
            case "input_audio_buffer.speech_stopped":
                if (Date.now() < state.echoSuppressUntil) {
                    openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
                }
                break;

            case "input_audio_buffer.speech_started": {
                // Only interrupt if AI is currently speaking AND grace period has passed
                if (
                    state.aiSpeaking &&
                    state.responseInProgress &&
                    !state.bargeInTriggered &&
                    Date.now() > state.bargeInAllowedAfter
                ) {
                    console.log("🎤 Barge-in detected — cancelling AI response");
                    state.bargeInTriggered = true;

                    // 1. Cancel OpenAI's current response
                    if (openaiWs.readyState === WebSocket.OPEN) {
                        openaiWs.send(JSON.stringify({ type: "response.cancel" }));
                    }

                    // 2. Stop audio playback on FreeSWITCH side
                    const fsWs = fsConnections.get(uuid);
                    if (fsWs?.readyState === WebSocket.OPEN) {
                        fsWs.send(JSON.stringify({ type: "stopAudio" }));  // adjust to your FS event name
                    }

                    // 3. Clear any buffered audio chunks
                    state.audioChunks = [];
                    state.aiSpeaking = false;
                }
                break;
            }
            case "response.output_audio.delta": {
                // Buffer chunks — sent as ONE streamAudio message per turn (see response.output_audio.done)
                const chunk = downsample24kTo8k(Buffer.from(event.delta, "base64"));
                state.audioChunks.push(chunk);
                state.aiSpeaking = true;
                break;
            }

            case "response.created":
                resetTurnState(state, "new-response");
                state.aiSpeaking = true;
                state.responseInProgress = true;
                state.bargeInTriggered = false;
                state.bargeInBuffer = [];
                state.bargeInAllowedAfter = Date.now() + BARGE_IN_GRACE_MS;
                state.audioChunks = [];
                break;

            case "response.cancelled":
                resetTurnState(state, "cancelled");
                state.aiSpeaking = false;
                state.responseInProgress = false;
                state.audioChunks = [];
                // Stop any audio already sent to FreeSWITCH
                const fsWs = fsConnections.get(uuid);
                if (fsWs?.readyState === WebSocket.OPEN) {
                    fsWs.send(JSON.stringify({ type: "stopAudio" }));
                }
                break;

            case "response.output_audio.done": {
                if (state.audioChunks.length > 0) {
                    const fullAudio = Buffer.concat(state.audioChunks);
                    state.audioChunks = [];

                    const fsWs = fsConnections.get(uuid);
                    if (fsWs?.readyState === WebSocket.OPEN) {
                        console.log(
                            "PCM HEX:",
                            fullAudio.slice(0, 32).toString("hex")
                        );
                        fsWs.send(
                            JSON.stringify({
                                type: "streamAudio",
                                data: {
                                    audioDataType: "raw",
                                    sampleRate: 8000,
                                    audioData: fullAudio.toString("base64"),
                                },
                            })
                        );
                    }
                }
                state.aiSpeaking = false;

                if (state.hangupAfterResponse) {
                    state.hangupAfterResponse = false;
                    setTimeout(() => {
                        eslApi(`uuid_kill ${uuid}`)
                            .then(() => console.log(`📴 Hangup | UUID: ${uuid}`))
                            .catch((err) => console.error("❌ Hangup error:", err.message));
                    }, 7000);
                }
                break;
            }

            case "response.done":
                state.responseInProgress = false;
                state.bargeInTriggered = false;
                if (state.pendingResponse) {
                    state.pendingResponse = false;
                    setTimeout(() => {
                        if (openaiWs.readyState === WebSocket.OPEN && !state.responseInProgress) {
                            safeResponseCreate(openaiWs, state);
                        }
                    }, 20);
                }
                break;

            case "response.function_call_arguments.done": {
                const { call_id: callId, name, arguments: argsJson } = event;
                console.log(`🔧 Tool call: ${name}`, argsJson);

                const result = await handleToolCall(
                    uuid,
                    caller,
                    mem,
                    name,
                    argsJson,
                    state,
                    callConfig
                );
                mem = (await session.get(uuid)) || mem;
                sendFunctionOutput(openaiWs, state, callId, result);
                break;
            }

            case "response.audio_transcript.delta":
                process.stdout.write(event.delta || "");
                break;

            case "response.audio_transcript.done":
                console.log(`\n🤖 AI: "${event.transcript}"`);
                break;

            case "conversation.item.input_audio_transcription.completed": {
                console.log(`👤 User: "${event.transcript}"`);

                if (!event.transcript?.trim()) break;

                // Background only — do NOT gate response.create on transcription
                updateSessionFromTranscript(uuid, event.transcript || "");
                if (openaiWs.readyState === WebSocket.OPEN && !state.responseInProgress) {
                    safeResponseCreate(openaiWs, state);
                }
                break;
            }

            case "error":
                console.error("❌ OpenAI Error:", JSON.stringify(event.error || event, null, 2));
                break;
        }
    });

    openaiWs.on("close", () => {
        console.log(`🔌 OpenAI closed | UUID: ${uuid}`);
        callActive = false;
    });

    openaiWs.on("error", (err) => console.error("❌ OpenAI WS Error:", err.message));

    return openaiWs;
}

// ─── Audio helpers ──────────────────────────────────────────────────────────────
function downsample24kTo8k(buffer) {
    const output = Buffer.alloc(Math.floor(buffer.length / 3));
    for (let i = 0, j = 0; i < buffer.length; i += 6, j += 2) {
        if (i + 1 < buffer.length) {
            output[j] = buffer[i];
            output[j + 1] = buffer[i + 1];
        }
    }
    return output;
}

function upsample8kTo24k(buffer) {
    const inputSamples = buffer.length / 2;
    const outputSamples = inputSamples * 3;
    const output = Buffer.alloc(outputSamples * 2);

    for (let i = 0; i < inputSamples - 1; i++) {
        const s0 = buffer.readInt16LE(i * 2);
        const s1 = buffer.readInt16LE((i + 1) * 2);

        for (let t = 0; t < 3; t++) {
            const interp = Math.round(s0 + (s1 - s0) * (t / 3));
            output.writeInt16LE(interp, (i * 3 + t) * 2);
        }
    }
    return output;
}

// function upsample8kTo24k(buffer) {
//     console.log("UPSAMPLE V3 LOADED");

//     const validBytes = buffer.length & ~1; // make even

//     if (validBytes < 4) {
//         return Buffer.alloc(0);
//     }

//     const inputSamples = validBytes / 2;
//     const output = Buffer.alloc((inputSamples - 1) * 3 * 2);

//     for (let i = 0; i < inputSamples - 1; i++) {

//         const off0 = i * 2;
//         const off1 = (i + 1) * 2;

//         if (off1 + 1 >= validBytes) {
//             break;
//         }

//         const s0 = buffer.readInt16LE(off0);
//         const s1 = buffer.readInt16LE(off1);

//         for (let t = 0; t < 3; t++) {
//             const interp = Math.round(
//                 s0 + ((s1 - s0) * t) / 3
//             );

//             output.writeInt16LE(
//                 interp,
//                 (i * 3 + t) * 2
//             );
//         }
//     }

//     return output;
// }

function getAudioLevel(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 2) {
        sum += Math.abs(buffer.readInt16LE(i));
    }
    return sum / (buffer.length / 2);
}

// function getAudioLevel(buffer) {
//     let sum = 0;

//     for (let i = 0; i < buffer.length - 1; i += 2) {
//         sum += Math.abs(buffer.readInt16LE(i));
//     }

//     return sum / Math.max(1, Math.floor(buffer.length / 2));
// }

function getAudioVariance(buffer) {
    const avg = buffer.reduce((s, b) => s + b, 0) / buffer.length;
    return Math.sqrt(buffer.reduce((s, b) => s + Math.pow(b - avg, 2), 0) / buffer.length);
}

// ─── Background email (non-blocking, retry-safe) ──────────────────────────────
let mailTransport = null;
function getMailTransport() {
    if (mailTransport) return mailTransport;
    mailTransport = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    });
    return mailTransport;
}

/**
 * Fire-and-forget — call this right after a successful booking.
 * Never awaited by the caller, never blocks the voice response or hangup flow.
 * Internally retries once on transient failure.
 */
function queueBookingEmail(appointment) {
    setImmediate(() => {
        sendBookingEmailWithRetry(appointment).catch((err) => {
            console.error("❌ Booking email permanently failed:", err.message);
        });
    });
}

async function sendBookingEmailWithRetry(appt, attempt = 1) {
    try {
        await sendBookingEmail(appt);
        console.log(`📧 Booking email sent | Appointment #${appt.appointment_id || "N/A"}`);
    } catch (err) {
        if (attempt < 2) {
            console.warn(`⚠️ Booking email failed (attempt ${attempt}), retrying:`, err.message);
            await new Promise((r) => setTimeout(r, 2000));
            return sendBookingEmailWithRetry(appt, attempt + 1);
        }
        throw err;
    }
}

// async function sendBookingEmail(appt) {
//     if (!appt || appt.status !== "booked") return;

//     const transport = getMailTransport();

//     const internalRecipients = ["pravinrambahadursingh1998@gmail.com", "shreedhar.solution@gmail.com"];
//     const to = appt.email ? [...internalRecipients, appt.email].join(", ") : internalRecipients.join(", ");

//     const subject = `Appointment booked: #${appt.appointment_id || "N/A"}`;
//     const startLocal = appt.start ? new Date(appt.start).toLocaleString() : "N/A";

//     const text = [
//         "Your appointment has been booked.",
//         "",
//         `Patient: ${appt.patientName || "N/A"}`,
//         // `Appointment ID: ${appt.appointment_id || "N/A"}`,
//         `Doctor: ${appt.doctor || "N/A"}`,
//         // `Provider: ${appt.provider || "N/A"}`,
//         `Start: ${startLocal}`,
//         `Status: ${appt.status}`,
//     ].join("\n");

//     await transport.sendMail({
//         from: process.env.SMTP_FROM || process.env.SMTP_USER,
//         to,
//         subject,
//         text,
//     });
// }


async function sendBookingEmail(appt) {
    if (!appt || appt.status !== "booked") return;

    const transport = getMailTransport();

    const internalRecipients = ["pravinrambahadursingh1998@gmail.com", "shreedhar.solution@gmail.com"];
    const to = appt.email ? [...internalRecipients, appt.email].join(", ") : internalRecipients.join(", ");

    // const subject = `Appointment Confirmed – ${appt.patientName || "Your appointment"}`;
    const subject = `Appointment Confirmation – Open Dental`;

    const startLocal = appt.start
        ? new Date(appt.start).toLocaleString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        })
        : "N/A";

    // const firstName = appt.patientName ? appt.patientName.split(" ")[0] : "there";

    const text = [
        `Hi ${appt.patientName},`,
        "",
        `Your appointment is confirmed for ${startLocal} with ${appt.doctor || "your doctor"}.`,
        "",
        "Thank you for choosing us!",
    ].join("\n");

    await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
    });
}