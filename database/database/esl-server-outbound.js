const net = require("net");
const esl = require("modesl");
const session = require("./session");
const getEsl = require("./config/esl"); // stable inbound-mode connection to FreeSWITCH (port 8021)

const PORT = 8086;

/**
 * Run an `api` command over the STABLE inbound-mode ESL connection (getEsl()),
 * NOT over the outbound-mode per-call socket. Outbound-mode sockets
 * (FreeSWITCH -> your app, via &socket(...)) are unreliable for `api`
 * replies — they're built for call-control events, not command/response.
 * The inbound-mode connection (your app -> FreeSWITCH, port 8021) is what
 * `api` is actually designed for, so we route all api calls there.
 */
function eslApiCall(command, args, timeoutMs = 5000) {
    return new Promise((resolve) => {
        const fsConn = getEsl();
        if (!fsConn || typeof fsConn.api !== "function") {
            console.warn(`⚠️ [outbound] eslApiCall: main ESL connection not ready (${command} ${args})`);
            return resolve(null);
        }

        const timer = setTimeout(() => {
            console.warn(`⚠️ [outbound] eslApiCall timeout: ${command} ${args}`);
            resolve(null);
        }, timeoutMs);

        fsConn.api(command, args, (res) => {
            clearTimeout(timer);
            resolve(res.getBody());
        });
    });
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

net.createServer((socket) => {
    console.log("📞 [outbound] Incoming ESL connection");
    // This per-call outbound-mode connection is used ONLY for:
    //   1. Reading channel info (uuid, caller) via getInfo()
    //   2. Subscribing to and receiving CHANNEL_HANGUP / mod_audio_stream events
    // It is deliberately NOT used for any api/bgapi command — see eslApiCall() above.
    const conn = new esl.Connection(socket);

    conn.on("error", (err) => {
        console.log(`⚠️ [outbound] ESL Connection Error: ${err.message}`);
    });

    conn.on("esl::ready", async () => {
        console.log("✅ [outbound] ESL Ready");

        let callActive = true;
        socket.on("close", () => { callActive = false; });
        socket.on("error", () => { callActive = false; });

        try {
            conn.events("json", "CUSTOM CHANNEL_EXECUTE_COMPLETE CHANNEL_HANGUP DTMF");
            await sleep(200);

            const uuid =
                conn.getInfo().getHeader("Channel-Call-UUID") ||
                conn.getInfo().getHeader("Unique-ID");

            const caller =
                conn.getInfo().getHeader("Caller-Caller-ID-Number") ||
                conn.getInfo().getHeader("variable_caller_id_number");

            console.log("UUID:", uuid, "Caller:", caller);

            let mem = (await session.get(uuid)) || {};
            console.log("mem [outbound]:", mem);

            conn.on("esl::event::CHANNEL_HANGUP::*", (event) => {
                const hangupUuid = event.getHeader("Unique-ID");
                if (hangupUuid === uuid) {
                    console.log(`📴 [outbound] Call ended | UUID: ${uuid}`);
                    callActive = false;
                    // Stop the stream via the stable main connection, not the
                    // outbound socket (which may already be closing/closed).
                    eslApiCall("uuid_audio_stream", `${uuid} stop`).catch(() => {});
                }
            });

            if (!callActive) return;

            // ✅ All api calls now go through the stable inbound-mode connection
            const playbackResult = await eslApiCall("uuid_setvar", `${uuid} STREAM_PLAYBACK 1`);
            console.log(`[${uuid}] set STREAM_PLAYBACK:`, playbackResult);

            const bufferResult = await eslApiCall("uuid_setvar", `${uuid} STREAM_BUFFER_SIZE 200`);
            console.log(`[${uuid}] set STREAM_BUFFER_SIZE:`, bufferResult);

            const getVarResult = await eslApiCall("uuid_getvar", `${uuid} STREAM_PLAYBACK`);
            console.log(`[${uuid}] STREAM_PLAYBACK=${getVarResult}`);

            await sleep(200);
            if (!callActive) return;

            // patientData already pre-seeded by outbound-call.js — no lookup needed here.

            await session.set(`pending_stream_${uuid}`, {
                uuid,
                caller,
                direction: "outbound",
                createdAt: Date.now(),
            });
            console.log(`📝 [outbound] Session saved | UUID: ${uuid}`);

            await sleep(150);
            if (!callActive) return;

            // Playback-trigger events still arrive fine over the outbound socket —
            // event delivery is reliable even though api replies weren't.
            conn.on("esl::event::CUSTOM::mod_audio_stream::play", (event) => {
                const body = event.getBody();
                try {
                    const data = JSON.parse(body);
                    if (data.file && callActive) {
                        conn.execute("playback", data.file);
                    }
                } catch (err) {
                    console.log("❌ [outbound] Play error:", err.message);
                }
            });

            console.log(`📡 [outbound] Requesting uuid_audio_stream start | UUID: ${uuid}`);
            const streamResult = await eslApiCall(
                "uuid_audio_stream",
                `${uuid} start ws://127.0.0.1:8087/${uuid} mono 8000`
            );
            console.log("🎙️ [outbound] WS STREAM RAW RESPONSE:", streamResult);

            await sleep(500);
            console.log(`🔇 [outbound] Entering silence loop | UUID: ${uuid}`);
            while (callActive) {
                if (!callActive) break;
                await sleep(500);
            }

            console.log(`✅ [outbound] Call finished | UUID: ${uuid}`);

        } catch (err) {
            console.log("❌ [outbound] Error:", err.message);
        }
    });

}).listen(PORT, () => {
    console.log(`🚀 [outbound] ESL Server running on port ${PORT}`);
});