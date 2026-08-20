/**
 * Outbound announcement bridge — FreeSWITCH ↔ OpenAI Realtime.
 *
 * Purpose: one-way reminder calls. The AI greets the patient by name,
 * delivers a short "your plan expires in 2 days, please renew" message,
 * says goodbye, and the call auto-hangs-up once the AI finishes speaking.
 * No booking tools, no OpenDental calls — this is a pure announcement.
 *
 * Audio is delivered to the caller via mod_audio_stream's `streamAudio` JSON
 * message (requires STREAM_PLAYBACK=1 set on the channel before
 * uuid_audio_stream start, and STREAM_SAMPLE_RATE must NOT be set since the
 * sample rate already travels inside the JSON payload).
 *
 * Deploy next to session.js on your FreeSWITCH bridge host.
 * Listens on port 8087 — paired with esl-server-outbound.js (port 8086).
 * Env: OPENAI_API_KEY
 */
const WebSocket = require("ws");
const session = require("./session");
const { Connection } = require("modesl");
require("dotenv").config();

// ─── ESL (global control connection, used only for uuid_kill on hangup) ──────
let eslConn = null;
let eslReady = false;
const fsConnections = new Map();

function connectESL() {
    eslConn = new Connection("127.0.0.1", 8021, "ClueCon", () => {
        eslReady = true;
        console.log("✅ [outbound] ESL connected");
    });

    eslConn.on("error", (err) => {
        console.error("❌ [outbound] ESL error:", err.message);
        eslReady = false;
        setTimeout(connectESL, 3000);
    });

    eslConn.on("esl::end", () => {
        console.warn("⚠️ [outbound] ESL disconnected — reconnecting");
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

// ─── WebSocket server (FreeSWITCH mod_audio_stream connects here) ────────────
const wss = new WebSocket.Server({ port: 8087 });
console.log("🌐 [outbound] WebSocket Bridge running on port 8087");

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

// Realtime conversation tuning (lower = snappier, higher = fewer false interrupts)
const BARGE_IN_GRACE_MS = 400;
const BARGE_IN_VARIANCE_MIN = 65;
const BARGE_IN_CHUNKS = 999;
const VAD_SILENCE_MS = 80;
const VAD_THRESHOLD = 0.5;

function toDateString(d) {
    return d.toISOString().slice(0, 10);
}

function todayStrings() {
    const today = new Date();
    return {
        today: toDateString(today),
    };
}

// ─── Announcement script — greet by name, plan-expiry reminder, goodbye ──────
function buildInstructions(patient, dates) {
    const { today } = dates;
    const name = patient.patientName || "there";

    return `You are a professional, friendly voice assistant calling on behalf of the company.

PATIENT ON THIS CALL:
- Name: ${name}

Today's date: ${today}

YOUR ONLY JOB ON THIS CALL:
- Greet the patient warmly by name, using a natural greeting appropriate for the time of day (e.g. "Good morning", "Good afternoon", "Good evening"). If you are unsure of the time of day, just say "Hi ${name}".
- Let them know, warmly and professionally, that their plan is expiring within the next two days.
- Kindly ask them to renew or recharge their plan soon so they don't experience any interruption in service.
- Wish them a great day.
- Keep it SHORT — 2 to 4 sentences total. This is a single announcement, not a conversation.
- Do NOT ask questions. Do NOT wait for a response before delivering the message — say the full message in one go.
- If the patient responds or asks something, answer briefly and politely, then politely end the call.
- Do NOT discuss appointments, bookings, or anything unrelated to the plan renewal reminder.
- After delivering the message (and any brief reply), say a warm goodbye like "Take care, goodbye!" The call will then end automatically — do not say you are hanging up, just say goodbye naturally.`;
}

// No tools needed — this is a one-way announcement, not an interactive booking flow.
function buildRealtimeTools() {
    return [];
}

// ─── Turn-state reset ─────────────────────────────────────────────────────────
function resetTurnState(state, reason) {
    state.bargeInBuffer = [];
    state.bargeInTriggered = false;
    console.log(`🔄 [outbound] Turn reset (${reason})`);
}

// ─── FS connection handler ─────────────────────────────────────────────────────
wss.on("connection", async (fsSocket, req) => {
    console.log("🔗 [outbound] Raw URL:", req.url);
    let uuid = null;
    let caller = null;

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
                await session.delete(newest.key);
            }
        }
    }

    if (!uuid) {
        console.error("❌ [outbound] Could not determine UUID — closing");
        fsSocket.close();
        return;
    }

    console.log(`✅ [outbound] FINAL | UUID: ${uuid} | Caller: ${caller}`);

    let mem = (await session.get(uuid)) || {};
    const openaiWs = connectToOpenAI(uuid, caller, mem, state);

    let audioBuffer = [];

    fsSocket.on("message", (data) => {
        const level = getAudioLevel(data);
        const variance = getAudioVariance(data);
        if (level < 5 || variance < 5) return;

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
                console.log("🛑 [outbound] BARGE-IN — stopping AI");
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
        console.log(`📴 [outbound] Caller disconnected | UUID: ${uuid}`);
        if (openaiWs?.readyState === WebSocket.OPEN) openaiWs.close();
        fsConnections.delete(uuid);
    });

    fsSocket.on("error", (err) => console.error("❌ [outbound] Socket error:", err.message));
});

// ─── OpenAI Realtime (announcement-only) ───────────────────────────────────────
function connectToOpenAI(uuid, caller, mem, state) {
    const p = mem.patientData || {};
    const patientName = p.patientName || "there";
    const dates = todayStrings();

    let callActive = true;

    const openaiWs = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-realtime", {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });

    openaiWs.on("open", () => {
        console.log(`✅ [outbound] OpenAI connected | UUID: ${uuid}`);

        openaiWs.send(
            JSON.stringify({
                type: "session.update",
                session: {
                    type: "realtime",
                    instructions: buildInstructions(p, dates),
                    tools: buildRealtimeTools(),
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
                        output: { voice: "alloy" },
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
                            text: `[Call started. Deliver your reminder message now to ${patientName} warmly and briefly, then say goodbye.]`,
                        },
                    ],
                },
            })
        );

        // ✅ One-way announcement — hang up automatically once the AI finishes speaking
        state.hangupAfterResponse = true;

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
                if (
                    state.aiSpeaking &&
                    state.responseInProgress &&
                    !state.bargeInTriggered &&
                    Date.now() > state.bargeInAllowedAfter
                ) {
                    console.log("🎤 [outbound] Barge-in detected — cancelling AI response");
                    state.bargeInTriggered = true;

                    if (openaiWs.readyState === WebSocket.OPEN) {
                        openaiWs.send(JSON.stringify({ type: "response.cancel" }));
                    }

                    const fsWs = fsConnections.get(uuid);
                    if (fsWs?.readyState === WebSocket.OPEN) {
                        fsWs.send(JSON.stringify({ type: "stopAudio" }));
                    }

                    state.audioChunks = [];
                    state.aiSpeaking = false;
                }
                break;
            }

            case "response.output_audio.delta": {
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
                {
                    const fsWs = fsConnections.get(uuid);
                    if (fsWs?.readyState === WebSocket.OPEN) {
                        fsWs.send(JSON.stringify({ type: "stopAudio" }));
                    }
                }
                break;

            case "response.output_audio.done": {
                if (state.audioChunks.length > 0) {
                    const fullAudio = Buffer.concat(state.audioChunks);
                    state.audioChunks = [];

                    const fsWs = fsConnections.get(uuid);
                    if (fsWs?.readyState === WebSocket.OPEN) {
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
                            .then(() => console.log(`📴 [outbound] Hangup | UUID: ${uuid}`))
                            .catch((err) => console.error("❌ [outbound] Hangup error:", err.message));
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

            case "response.audio_transcript.delta":
                process.stdout.write(event.delta || "");
                break;

            case "response.audio_transcript.done":
                console.log(`\n🤖 [outbound] AI: "${event.transcript}"`);
                break;

            case "conversation.item.input_audio_transcription.completed":
                console.log(`👤 [outbound] User: "${event.transcript}"`);
                // No booking / follow-up logic — this is a one-way announcement call.
                if (event.transcript?.trim() && openaiWs.readyState === WebSocket.OPEN && !state.responseInProgress) {
                    safeResponseCreate(openaiWs, state);
                }
                break;

            case "error":
                console.error("❌ [outbound] OpenAI Error:", JSON.stringify(event.error || event, null, 2));
                break;
        }
    });

    openaiWs.on("close", () => {
        console.log(`🔌 [outbound] OpenAI closed | UUID: ${uuid}`);
        callActive = false;
    });

    openaiWs.on("error", (err) => console.error("❌ [outbound] OpenAI WS Error:", err.message));

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

function getAudioLevel(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 2) {
        sum += Math.abs(buffer.readInt16LE(i));
    }
    return sum / (buffer.length / 2);
}

function getAudioVariance(buffer) {
    const avg = buffer.reduce((s, b) => s + b, 0) / buffer.length;
    return Math.sqrt(buffer.reduce((s, b) => s + Math.pow(b - avg, 2), 0) / buffer.length);
}