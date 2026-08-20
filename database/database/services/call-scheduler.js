/**
 * call-scheduler.js
 * Polls for due scheduled outbound calls and fires them via outbound-call.js.
 * Does not touch esl-server.js / ws-bridge.js / outbound-call.js.
 */
const crypto = require("crypto");
const session = require("../session");
const { originateCall } = require("../outbound-call");

const POLL_INTERVAL_MS = 15000; // check every 15s — adjust to taste
const KEY_PREFIX = "scheduled_call_";

/**
 * Schedule a call.
 * @param {object} opts
 * @param {string} opts.toNumber       extension/number to call
 * @param {string} opts.runAt          ISO datetime for one-off calls, e.g. "2026-07-26T15:00:00"
 * @param {string} [opts.dailyTime]    "HH:mm" (24h) for recurring daily calls — use instead of runAt
 * @param {object} [opts.patientData]  same shape as before (patientName, phone, email, patNum, etc.)
 * @param {object} [opts.meta]         anything else you want carried through (e.g. reason, campaignId)
 */
async function scheduleCall(opts) {
    const { toNumber, runAt, dailyTime, patientData = {}, meta = {} } = opts;
    if (!toNumber) throw new Error("toNumber is required");
    if (!runAt && !dailyTime) throw new Error("Provide either runAt (ISO) or dailyTime (HH:mm)");

    const id = crypto.randomUUID();
    const job = {
        id,
        toNumber,
        patientData,
        meta,
        recurring: !!dailyTime,
        dailyTime: dailyTime || null,
        runAt: runAt || null,
        status: "pending",
        createdAt: Date.now(),
        lastRunAt: null,
    };

    await session.set(`${KEY_PREFIX}${id}`, job);
    console.log(`🗓️ Scheduled call ${id} → ${toNumber} @ ${dailyTime ? `daily ${dailyTime}` : runAt}`);
    return job;
}

async function cancelScheduledCall(id) {
    await session.delete(`${KEY_PREFIX}${id}`);
    console.log(`🗑️ Cancelled scheduled call ${id}`);
}

async function listScheduledCalls() {
    const keys = await session.keys(`${KEY_PREFIX}*`);
    const jobs = [];
    for (const key of keys) {
        const job = await session.get(key);
        if (job) jobs.push(job);
    }
    return jobs;
}

// function isDueOneOff(job, now) {
//     if (!job.runAt) return false;
//     if (job.status === "failed" || job.status === "firing") return false;
//     return new Date(job.runAt).getTime() <= now.getTime();
// }

function isDueOneOff(job, now) {
    if (!job.runAt) return false;
    if (job.status === "failed" || job.status === "firing") return false;

    const runAtTime = new Date(job.runAt).getTime();
    const GRACE_MS = 5 * 60 * 1000; // 5 minutes — adjust if you want a wider/narrower window

    // Skip jobs whose runAt has passed by more than the grace window —
    // treat as stale instead of firing late.
    if (now.getTime() - runAtTime > GRACE_MS) {
        if (job.status !== "expired") {
            console.log(`⏭️ Job ${job.id} is stale (runAt ${job.runAt} passed grace window) — marking expired`);
            job.status = "expired";
            session.set(`${KEY_PREFIX}${job.id}`, job).catch(() => {});
        }
        return false;
    }

    return runAtTime <= now.getTime();
}

function isDueDaily(job, now) {
    if (!job.dailyTime) return false;
    if (job.status === "firing") return false; 
    const [h, m] = job.dailyTime.split(":").map(Number);
    const scheduled = new Date(now);
    scheduled.setHours(h, m, 0, 0);

    // Fire once per day: due if we've passed the time AND haven't run today yet
    const alreadyRanToday =
        job.lastRunAt && new Date(job.lastRunAt).toDateString() === now.toDateString();

    return now.getTime() >= scheduled.getTime() && !alreadyRanToday;
}

async function fireJob(job) {
    console.log(`📞 Firing scheduled call: ${job.id} → ${job.toNumber}`);
    job.status = "firing";
    await session.set(`${KEY_PREFIX}${job.id}`, job);

    try {
        await originateCall(job.toNumber, job.patientData);

        if (job.recurring) {
            job.lastRunAt = Date.now();
            job.status = "fired";
            await session.set(`${KEY_PREFIX}${job.id}`, job);
        } else {
            // one-off — done, remove it
            await session.delete(`${KEY_PREFIX}${job.id}`);
        }
    } catch (err) {
        console.error(`❌ Scheduled call ${job.id} failed:`, err.message);
        job.status = "failed";
        job.lastError = err.message;
        await session.set(`${KEY_PREFIX}${job.id}`, job);
        // one-off failed jobs stay recorded as "failed" instead of silently vanishing —
        // change to session.delete(...) here if you'd rather they disappear.
    }
}

async function tick() {
    const now = new Date();
    const keys = await session.keys(`${KEY_PREFIX}*`);

    for (const key of keys) {
        const job = await session.get(key);
        if (!job) continue;

        const due = job.recurring ? isDueDaily(job, now) : isDueOneOff(job, now);
        if (due) await fireJob(job);
    }
}

function startScheduler() {
    console.log(`⏱️ Call scheduler started (poll every ${POLL_INTERVAL_MS / 1000}s)`);
    setInterval(() => {
        tick().catch((err) => console.error("❌ Scheduler tick error:", err.message));
    }, POLL_INTERVAL_MS);
}

module.exports = { scheduleCall, cancelScheduledCall, listScheduledCalls, startScheduler };