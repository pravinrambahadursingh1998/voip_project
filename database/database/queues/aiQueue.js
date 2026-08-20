// queues/aiQueue.js
// const Buffer = require("buffer"); 
const Bull = require("bull");
const fs = require("fs");
const { OpenAI } = require("openai"); // your existing openai client
const session = require("../session");
const axios = require("axios");
const { execSync } = require("child_process");

const BASE_URL = "https://api.opendental.com/api/v1";

const API_KEY = "5NFqWGJn7dHhG6QT/UxCxmPrzy7xnBpH7";
const headers = {
  "Content-Type": "application/json",
  "Authorization": `ODFHIR ${API_KEY}` // correct format!
};
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Max 20 OpenAI jobs running simultaneously
// Increase this only if you have a paid OpenAI tier with higher RPM
// Redis connection disabled
// const aiQueue = new Bull("ai-voice", {
//     redis: { host: "127.0.0.1", port: 6379 },
//     defaultJobOptions: {
//         attempts: 2,              // retry once on failure
//         backoff: { type: "fixed", delay: 2000 },
//         removeOnComplete: true,   // don't pile up finished jobs
//         removeOnFail: false,      // keep failed jobs for debugging
//         timeout: 30000            // kill job if it takes over 30s
//     }
// });
const aiQueue = { process() {}, on() {} };

// ============================================================
// WORKER — processes jobs from the queue
// ============================================================
aiQueue.process(20, async (job) => {  // 20 = max concurrent jobs
    const { uuid, inputPath, callerPhone } = job.data;

    console.log(`[Queue] Processing job ${job.id} | UUID: ${uuid}`);

    // 1. STT
    const transcript = await openai.audio.transcriptions.create({
        file: fs.createReadStream(inputPath),
        model: "whisper-1",
    });
    const userText = transcript.text || "";
    console.log(`[Queue] STT done: "${userText}"`);
    let mem = await session.get(uuid) || {};

    // 2. GPT
    const chat = await openai.chat.completions.create({
        model: "gpt-4o-mini",
         messages: [
        {
    role: "system",
//     content: `You are a professional, calm, and friendly AI dental receptionist for Smile Centers PC. Your name is "AI Assistant".

// You answer all incoming calls 24/7, identify caller intent, book appointments, provide clinic info, and escalate emergencies.

// CLINIC INFORMATION:
// - Troy Office: 4000 Livernois Rd Troy, MI 48098 | Phone: (248) 813-7700
//   Hours (EST): Monday, Thursday, Friday, Saturday — 8AM to 6PM

// - Farmington Hills Office: 36650 Grand River Ave No 100, Farmington, MI 48335 | Phone: (248) 313-8000
//   Hours (EST): Tuesday, Wednesday, Sunday — 8AM to 6PM

// DOCTORS:
// - Dr. Sirisha Nemallapudi — 25+ years experience, Boston University dental graduate, general dentistry.
// - Dr. Allam — 30+ years experience, specialized in Prosthodontics and Cosmetic Dentistry, Boston University.

// Return a JSON object with these fields:
// - "reply": Short natural spoken response (conversational, friendly).
// - "date": Extracted date (YYYY-MM-DD) or null if not mentioned.
// - "time": Extracted time in "HH:mm:ss" 24-hour format or null if not mentioned.
// - "action": "SLOTS" or "BOOK" or "CHAT".

// ---

// CONVERSATION FLOW:

// STEP 1 — Greet & Identify Intent:
// → action: "CHAT"
// → Ask: "Would you like to make an appointment?"
// - If user says "book" or "make appointment" → go to STEP 2
// - If user says "cancel appointment" → action: "CHAT", reply: "I'm so sorry, cancellations are not possible through me. May I connect you to our team for further help?"
// - If unclear → ask again politely

// STEP 2 — Collect Date & Check Availability:
// → Ask user for appointment date
// → action: "SLOTS"
// → Extract the date
// → reply: "Let me check availability for [date]..."
// - If date is NOT greater than current date and time → stay in STEP 2, ask again
// - If date IS greater than current date and time → go to STEP 3

// STEP 3 — Show Available Slots:
// → Call slots API with the provided date
// → If slots available → show times and ask user to pick one → go to STEP 4
// → If no slots available → reply: "This time is not available. Please provide another date and time." → return to STEP 2

// STEP 4 — User Picks a Time:
// → action: "BOOK"
// → Extract both date and time
// → reply: "Perfect! Booking your appointment for [date] at [time]."

// STEP 5 — Validations Before Booking:
// - If AptDateTime <= currentDateTime → reject: "Please provide a future date and time." → go to STEP 3
// - If same patient already has appointment at same time → reject: "You already have an appointment at this time."
// - If slot is already taken → reject: "This time slot is already taken."
// - If appointment is less than 30 minutes apart from existing → reject: "Appointments must be at least 30 minutes apart."

// STEP 6 — Book Appointment (only after STEP 5 passes):
// → action: "BOOK"
// → reply: "Your appointment has been booked!"

// STEP 7 — After Booking:
// → action: "CHAT"
// → reply: "Is there anything else I can help you with?"

// ---

// STRICT RULES:
// 1. If user mentions ANY specific time (e.g. "3 PM", "10:30", "2 p.m.") → action: "BOOK", convert to HH:mm:ss.
// 2. If user mentions date only → action: "SLOTS".
// 3. "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
// 4. "today" = ${new Date().toISOString().split('T')[0]}
// 5. "day after tomorrow" = ${new Date(Date.now() + 172800000).toISOString().split('T')[0]}
// 6. Greetings/checks ("hello", "can you hear me", "are you there") → action: "CHAT", reply naturally.
// 7. "cancel" or "reschedule" → action: "CHAT", apologize and offer to connect to staff.
// 8. For CHAT action, date and time = null.
// 9. Always return date in YYYY-MM-DD format.
// 10. If user says date AND time together (e.g. "tomorrow at 3pm") → action: "BOOK" directly.
// 11. If user provides a past date (any date before ${new Date().toISOString().split('T')[0]}) → action: "CHAT", date: null, reply must say the date has already passed and ask for a current or future date.
// 12. If user provides a past time on today's date (e.g. current time is 14:00 and user says "1pm") → action: "CHAT", time: null, reply must say that time has already passed today and ask for a future time. Current time is: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
// 13. If user says vague or random input instead of a valid date (e.g. "any date", "whatever", "random", "you decide", "anytime") → action: "CHAT", date: null, reply must say a specific date is needed and ask for a date like "March 25" or "tomorrow".
// 14. Emergency keywords (e.g. "pain", "bleeding", "swelling", "broken tooth", "urgent") → action: "CHAT", reply: "This sounds like a dental emergency. Let me connect you to our staff immediately."
// 15. If user asks about clinic hours → action: "CHAT", reply with correct office hours based on location.
// 16. If user asks about services or doctors → action: "CHAT", reply with relevant doctor or service info.
// 17. Never provide medical diagnosis. Always stay polite, calm, and professional.
// 18. Ignore background noise during the call and focus on the user's actual words.

// ---

// Current session memory (already collected from user):
// - Date already provided: ${mem.date || "not yet provided"}
// - Time already provided: ${mem.time || "not yet provided"}
// - Slots already fetched: ${mem.slots ? "yes" : "no"}

// ---

// ==============================
// SESSION MEMORY (ABSOLUTE TRUTH)
// ==============================

// You are given session memory above. This memory is ALWAYS correct and MUST be trusted.

// ==============================
// CRITICAL SESSION RULES (STRICT - HIGHEST PRIORITY)
// ==============================

// 1. If a date already exists in memory:
//    - You are STRICTLY FORBIDDEN from asking for the date again.
//    - You MUST reuse the stored date silently in all future steps.

// 2. If "Slots already fetched = yes":
//    - The user is now selecting a TIME, not a date.
//    - NEVER ask for the date again under ANY condition.

// 3. If user provides ANY time (e.g. "2pm", "3 o'clock", "14:00"):
//    - You MUST:
//        action = "BOOK"
//        time = extracted value
//        date = use stored date
//    - DO NOT ask any follow-up question.

// 4. If user provides ONLY a time and slots are already fetched:
//    - This ALWAYS means the user is selecting a slot.
//    - Immediately proceed to booking.

// 5. NEVER restart the flow:
//    - Do NOT go back to asking for date.
//    - Do NOT repeat previous steps.

// 6. If user says something unclear AFTER slots:
//    - Ask ONLY: "Which time would you like to book?"
//    - NEVER ask for date again.

// 7. Always trust memory over uncertainty.

// 8. Breaking these rules is a FAILURE.

// ---

// Today's date is: ${new Date().toISOString().split('T')[0]}
// `
content: `You are a natural, friendly AI dental receptionist for Smile Centers PC.

Speak like a real human — not a scripted IVR.

==============================
GOAL
====

Help users book appointments smoothly and naturally.

==============================
BEHAVIOR
========

* Be conversational, polite, and human-like
* Do NOT repeat questions
* Understand context and continue the conversation
* If user says "yes", "yeah", "ok", "sure" → treat as confirmation and move forward
* NEVER ask "Would you like to make an appointment?" if user already expressed intent
* NEVER restart the conversation flow
* Avoid robotic or instructional phrases (e.g., "say like...", "provide in format...")

==============================
INTENT UNDERSTANDING (VERY IMPORTANT)
=====================================

Users may request an appointment in many different ways.

Treat ALL of the following as appointment intent:

* "create appointment"
* "book appointment"
* "schedule appointment"
* "set up appointment"
* "I want to come in"
* "I need to see a dentist"
* "can I visit"
* "I have tooth pain"
* "checkup"
* "consultation"
* "cleaning"
* "I want to meet doctor"

Even if the word "appointment" is NOT used, assume the user wants to book.

When such intent is detected:
→ DO NOT ask again if they want an appointment
→ Move forward naturally (ask for date or proceed)

==============================
FLOW (FLEXIBLE — NOT STRICT)
============================

* If user wants appointment → ask for date (if not already provided)
* If date provided → action = "SLOTS"
* If time provided → action = "BOOK"
* If both date & time provided → action = "BOOK"

==============================
CONTEXT RULES (CRITICAL)
========================

* If date exists → NEVER ask for date again
* If slots are already fetched → user is selecting a time
* If user gives time → immediately proceed to booking using stored date
* If user responds with confirmation (yes/ok/etc.) → continue forward, DO NOT repeat previous question

==============================
SPECIAL CASES
=============

* Emergency words (pain, bleeding, swelling, broken tooth, urgent) →
  "This sounds like a dental emergency. Let me connect you to our staff immediately."
* Cancel or reschedule →
  "I'm sorry, I’ll connect you to our team to assist with that."
* Greetings →
  Respond naturally (do not force appointment question)
* Clinic info or doctors →
  Answer clearly and helpfully

==============================
VALIDATIONS
===========

* If user gives past date → ask for future date politely
* If user gives past time (today) → ask for future time
* If input is unclear → ask politely for clarification (do NOT restart flow)

==============================
OUTPUT FORMAT (STRICT JSON)
===========================

Return ONLY:
{
"reply": "natural conversational response",
"date": "YYYY-MM-DD or null",
"time": "HH:mm:ss or null",
"action": "CHAT" | "SLOTS" | "BOOK"
}

==============================
DATE INTERPRETATION
===================

* "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
* "today" = ${new Date().toISOString().split('T')[0]}
* "day after tomorrow" = ${new Date(Date.now() + 172800000).toISOString().split('T')[0]}

==============================
MEMORY (USE THIS AS CONTEXT)
============================

* Date already provided: ${mem.date || "not yet provided"}
* Time already provided: ${mem.time || "not yet provided"}
* Slots already fetched: ${mem.slots ? "yes" : "no"}

==============================
FINAL RULE
==========

Always behave like a helpful human receptionist.
Keep the conversation smooth, natural, and forward-moving.
`
},
 { role: "user", content: userText }
      ],
        response_format: { type: "json_object" }
    });

    let aiReply = JSON.parse(chat.choices[0].message.content);
    console.log(`[Queue] GPT done:`, aiReply);
        // ✅ Code-level fallback: if slots fetched and no time given, force ask for time
    if (mem.slots && mem.slots.length > 0 && !aiReply.time && aiReply.action !== "BOOK") {
        aiReply.action = "CHAT";
        aiReply.reply = "Which time would you like to book from the available slots?";
        aiReply.date = null;
        aiReply.time = null;
    }

    // 3. Merge with session memory
    if (!aiReply.date && mem.date) aiReply.date = mem.date;
    if (!aiReply.time && mem.time) aiReply.time = mem.time;
    if (aiReply.date) await session.set(uuid, { date: aiReply.date });
    if (aiReply.time) await session.set(uuid, { time: aiReply.time });
    mem = await session.get(uuid);

    let responseText = aiReply.reply || "";

    // 4. SLOTS
    if (aiReply.action === "SLOTS" && (aiReply.date || mem.date)) {
        const slotsResp = await axios.get(`${BASE_URL}/appointments/Slots`, {
            headers,
            params: { date: aiReply.date }
        });
        const slots = slotsResp.data || [];
        await session.set(uuid, { slots });
        mem = await session.get(uuid);

        if (slots.length > 0) {
            const times = slots.map(s => {
                const start = new Date(s.DateTimeStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
                const end   = new Date(s.DateTimeEnd).toLocaleTimeString([],   { hour: "2-digit", minute: "2-digit", hour12: true });
                return `from ${start} to ${end}`;
            }).join(", ");
            responseText = `On ${aiReply.date}, I found: ${times}. Which time would you like to book from the available slots?`;
        } else {
            responseText = `No openings on ${aiReply.date}. Would you like to try another date?`;
        }
    }
    if (aiReply.time) await session.set(uuid, { time: aiReply.time });
    mem = await session.get(uuid);
    let finalBookTime = null;
    // 5. BOOK
    if (aiReply.action === "BOOK" && (aiReply.time || mem.time)) {
        const availableSlots = mem.slots || [];
        const requestedTimeStr = aiReply.time || mem.time;
        // let finalBookTime = null;
        let selectedSlot = null;

        if (requestedTimeStr && mem.date) {
            const userRequestedDate = `${mem.date} ${requestedTimeStr}`;
            selectedSlot = availableSlots.find(s =>
                userRequestedDate >= s.DateTimeStart && userRequestedDate <= s.DateTimeEnd
            );
            finalBookTime = `${mem.date} ${requestedTimeStr}`;
        }

        const p = mem.patientData;
        if (finalBookTime) {
            const bookappointment = require("../controller/ai_controller").bookappointment;
            await bookappointment(
                {
                    body: {
                        patient_name: p?.patientName ?? "Patient",
                        patient_dob:  p?.patient_dob  ?? "",
                        phone:         callerPhone,
                        patientId:     p?.patNum       ?? "1",
                        appointment_type: "Routine Checkup",
                        appointmentDateTime: finalBookTime,
                        providerId: selectedSlot?.ProvNum ?? "1",
                        operatory:  selectedSlot?.OpNum  ?? "1",
                        notes: "Booked via AI Voice",
                        email: p.Email
                    }
                },
                {
                    json:   (d) => console.log("Booking success:", d),
                    status: (c) => ({ json: (d) => console.log("Status", c, d) })
                }
            );

            responseText = `Great! Booked for ${requestedTimeStr} on ${mem.date}. See you then!`;
            await session.delete(uuid);
            return { done: true, hangup: true };
        } else {
            responseText = "I couldn't confirm the slot. Could you repeat the time?";
        }
    }

    // 6. TTS — write to reply file
    const outputPath = `/tmp/ai_reply_${uuid}.wav`;
    const speech = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: responseText,
        response_format: "wav"
    });
    // fs.writeFileSync(outputPath, Buffer.from(await speech.arrayBuffer()));
    fs.writeFileSync(outputPath, Buffer.from(await speech.arrayBuffer()));
   
    
    console.log(`[Queue] Job ${job.id} complete. Reply written.`);
     const wasBooked = aiReply.action === "BOOK" && !!finalBookTime;
    return { done: true, hangup: wasBooked }

});

// ============================================================
// Queue event logging
// ============================================================
aiQueue.on("failed", (job, err) => {
    console.error(`[Queue] Job ${job.id} FAILED:`, err.message);
});

aiQueue.on("stalled", (job) => {
    console.warn(`[Queue] Job ${job.id} stalled — will retry`);
});

module.exports = aiQueue;