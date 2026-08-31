// const net = require("net");
// const esl = require("modesl");
// const axios = require("axios");
// const fs = require("fs");

// const PORT = 8084;

// net.createServer((socket) => {
//     console.log("📞 Incoming ESL connection");
//     const conn = new esl.Connection(socket);

//     conn.on("esl::ready", async () => {
//         console.log("✅ ESL Ready");

//         let callActive = true;

//         conn.on("esl::event::CHANNEL_HANGUP::*", () => {
//             if (callActive) console.log("📴 Call hung up by remote");
//             callActive = true;
//         });

//         socket.on("close", () => { callActive = false; });
//         socket.on("error", () => { callActive = false; });

//         try {
//             conn.events("json", "CHANNEL_EXECUTE_COMPLETE CHANNEL_HANGUP DTMF");
//             await sleep(200);

//             const uuid = conn.getInfo().getHeader("Channel-Call-UUID")
//                 || conn.getInfo().getHeader("Unique-ID");
//             const caller = conn.getInfo().getHeader("Caller-Caller-ID-Number")
//                 || conn.getInfo().getHeader("variable_caller_id_number");

//             console.log("UUID:", uuid, "Caller:", caller);

//             // STEP 1: Answer immediately
//             console.log("📲 Answering...");
//             await exec(conn, uuid, "answer", "");
//             console.log("✅ Answered");
//             if (!callActive) return;

//             // ✅ STEP 2: Send silent RTP so SIP phone doesn't drop the call
//             // User hears nothing — but phone stays alive during TTS generation
//             conn.execute("playback", "silence_stream://99999,1400");

//             // STEP 3: Generate greeting while silence keeps channel alive
//             console.log("🤖 Generating greeting...");
//             try {
//                 await axios.get(
//                     `http://127.0.0.1:3000/ai/greet?uuid=${uuid}&caller=${caller}`,
//                     { timeout: 20000 }
//                 );
//                 console.log("✅ Greeting ready");
//             } catch (err) {
//                 console.log("❌ Greet failed:", err);
//                 if (callActive) conn.execute("hangup", "NORMAL_CLEARING");
//                 return;
//             }

//             if (!callActive) return;

//             // STEP 4: Stop silence, play greeting
//             conn.execute("break");
//             await sleep(150);
//             await exec(conn, uuid, "playback", `/tmp/ai_greet_${uuid}.wav`);
//             console.log("✅ Greeting played");

//             // STEP 5: Conversation loop — record → AI → reply
//             let loop = 0;

//             while (callActive) {
//                 loop++;
//                 if (loop > 20) break;

//                 const input = `/dev/shm/input_${uuid}_${loop}.wav`;
//                 if (fs.existsSync(input)) fs.unlinkSync(input);

//                 if (!callActive) break;

//                 console.log(`🎙️ Listening [loop ${loop}]...`);
//                 await exec(conn, uuid, "record", `${input} 5 200 3`);

//                 const stat = fs.existsSync(input) ? fs.statSync(input) : null;
//                 console.log(`🎙️ Recorded: ${stat?.size || 0} bytes`);

//                 if (!stat || stat.size < 1000) {
//                     console.log("⚠️ No audio — re-listening");
//                     continue;
//                 }

//                 if (!callActive) break;

//                 // ✅ Send silence while AI processes (prevents hangup during API call)
//                 conn.execute("playback", "silence_stream://99999,1400");

//                 let res;
//                 try {
//                     const t = Date.now();
//                     res = await axios.post(
//                         `http://127.0.0.1:3000/ai/voice?uuid=${uuid}&caller=${caller}`,
//                         fs.readFileSync(input),
//                         { headers: { "Content-Type": "audio/wav" }, timeout: 25000 }
//                     );
//                     console.log(`✅ AI responded in ${Date.now() - t}ms`);
//                 } catch (err) {
//                     console.log("❌ API Error:", err.message);
//                     conn.execute("break");
//                     break;
//                 }

//                 if (!callActive) break;

//                 // Stop silence, play AI reply
//                 conn.execute("break");
//                 await sleep(150);
//                 await exec(conn, uuid, "playback", `/tmp/ai_reply_${uuid}.wav`);

//                 if (res.data?.hangup) {
//                     console.log("✅ AI requested hangup");
//                     conn.execute("hangup", "NORMAL_CLEARING");
//                     break;
//                 }

//                 if (res.data?.text?.toLowerCase().includes("goodbye")) break;
//             }

//             if (callActive) {
//                 conn.execute("hangup", "NORMAL_CLEARING");
//             }

//         } catch (err) {
//             console.log("❌ Call Error:", err.message);
//             if (callActive) {
//                 try { conn.execute("hangup"); } catch (_) { }
//             }
//         }
//     });

// }).listen(PORT, () => {
//     console.log(`🚀 ESL Server running on port ${PORT}`);
// });

// // FIXED exec: .on() + removeListener — wrong-app events don't consume listener
// function exec(conn, uuid, app, data) {
//     return new Promise((resolve) => {
//         const eventName = `esl::event::CHANNEL_EXECUTE_COMPLETE::${uuid}`;

//         const timeout = setTimeout(() => {
//             console.warn(`⚠️ exec timeout: ${app}`);
//             conn.removeListener(eventName, handler);
//             resolve();
//         }, 30000);

//         function handler(event) {
//             if (event.getHeader("Application") === app) {
//                 clearTimeout(timeout);
//                 conn.removeListener(eventName, handler);
//                 resolve();
//             }
//         }

//         conn.on(eventName, handler);

//         try {
//             conn.execute(app, data);
//         } catch (e) {
//             clearTimeout(timeout);
//             conn.removeListener(eventName, handler);
//             resolve();
//         }
//     });
// }

// function sleep(ms) {
//     return new Promise(r => setTimeout(r, ms));
// }


// require('dns').setDefaultResultOrder('ipv4first');
const net = require("net");
const esl = require("modesl");
const session = require("./session");
const axios = require("axios");
const Extension = require("./models/v_extensions");

const PORT = 8084;

// OpenDental API
const API_KEY = "5NFqWGJn7dHhG6QT/UxCxmPrzy7xnBpH7"; // your key only
const BASE_URL = "https://api.opendental.com/api/v1";
const headers = {
    "Content-Type": "application/json",
    "Authorization": `ODFHIR ${API_KEY}` // correct format!
};

net.createServer((socket) => {
    console.log("📞 Incoming ESL connection");
    const conn = new esl.Connection(socket);

    conn.on('error', (err) => {
        console.log(`⚠️ ESL Connection Error: ${err.message}`);
    });

    conn.on("esl::ready", async () => {
        console.log("✅ ESL Ready");

        let callActive = true;

        // ✅ Socket level cleanup
        socket.on("close", () => { callActive = false; });
        socket.on("error", () => { callActive = false; });

        try {
            // ✅ Subscribe to ALL needed events like old code
            // conn.events("json", "CHANNEL_EXECUTE_COMPLETE CHANNEL_HANGUP DTMF");
            conn.events(
                "json",
                "CUSTOM CHANNEL_EXECUTE_COMPLETE CHANNEL_HANGUP DTMF"
            );

            // conn.api(
            //     "event",
            //     "json CUSTOM mod_audio_stream::play"
            // );
            await sleep(200);

            const uuid =
                conn.getInfo().getHeader("Channel-Call-UUID") ||
                conn.getInfo().getHeader("Unique-ID");

            const caller =
                conn.getInfo().getHeader("Caller-Caller-ID-Number") ||
                conn.getInfo().getHeader("variable_caller_id_number");

            const extension =
                conn.getInfo().getHeader("Caller-Destination-Number") ||
                conn.getInfo().getHeader("variable_destination_number") ||
                conn.getInfo().getHeader("Caller-Callee-ID-Number") ||
                conn.getInfo().getHeader("variable_sip_to_user") ||
                null;

            let companyId = null;
            if (extension) {
                try {
                    const extRecord = await Extension.where({ extension: String(extension) }).fetch({ require: false });
                    if (extRecord) {
                        companyId = extRecord.get("company_id") || null;
                    }
                } catch (err) {
                    console.log("⚠️ Failed to lookup extension company_id:", err.message);
                }
            }

            let patientData = null;

            console.log("UUID:", uuid, "Caller:", caller, "Extension:", extension);

            let mem = (await session.get(uuid)) || {};
            console.log('mem239', mem);

            const isOutbound = mem.direction === "outbound";
            console.log(`📍 Call direction: ${isOutbound ? "outbound" : "inbound"} | UUID: ${uuid}`);


            // ✅ Hangup handler — like old code
            conn.on("esl::event::CHANNEL_HANGUP::*", (event) => {
                const hangupUuid = event.getHeader("Unique-ID");
                if (hangupUuid === uuid) {
                    console.log(`📴 Call ended | UUID: ${uuid}`);
                    callActive = false;
                    if (socket.writable) {
                        try {
                            conn.api("uuid_audio_stream", `${uuid} stop`);
                        } catch (err) {
                            console.log("Cleanup API call failed (Socket likely closed)");
                            console.log('err', err)
                        }
                    }

                }
            });


            // ✅ Step 1: Answer
            // await exec(conn, uuid, "answer", "");
            // await sleep(500);
            if (!isOutbound) {
                await exec(conn, uuid, "answer", "");
                await sleep(500);
            } else {
                console.log(`⏭️  Outbound call already answered — skipping answer() | UUID: ${uuid}`);
                // await exec(conn, uuid, "answer", "");
            }
            if (!callActive) return;

            // ✅ Step 2: Play silence while session registers

            // conn.api("uuid_setvar", `${uuid} STREAM_PLAYBACK 1`);
            // conn.api("uuid_setvar", `${uuid} STREAM_BUFFER_SIZE 200`);
            const playbackResult = await eslApiCall(conn, "uuid_setvar", `${uuid} STREAM_PLAYBACK 1`);
            console.log(`[${uuid}] set STREAM_PLAYBACK:`, playbackResult);

            const bufferResult = await eslApiCall(conn, "uuid_setvar", `${uuid} STREAM_BUFFER_SIZE 200`);
            console.log(`[${uuid}] set STREAM_BUFFER_SIZE:`, bufferResult);

            // conn.api("uuid_getvar", `${uuid} STREAM_PLAYBACK`, (res) => {
            //     console.log(`[${uuid}] STREAM_PLAYBACK=${res.getBody()}`);
            // });

            const getVarResult = await eslApiCall(conn, "uuid_getvar", `${uuid} STREAM_PLAYBACK`);
            console.log(`[${uuid}] STREAM_PLAYBACK=${getVarResult}`);

            conn.api("uuid_setvar", `${uuid} STREAM_BUFFER_SIZE 200`, (res) => {
                console.log("SET BUFFER:", res.getBody());
            });
            await sleep(200);
            if (!isOutbound) {
                try {
                    const t0 = Date.now();
                    // const { data } = await axios.get(
                    //     `${BASE_URL}/patients?Phone=${encodeURIComponent(caller)}`,
                    //     { headers }
                    // );

                    const { data } = await fetch(`${BASE_URL}/patients?Phone=1002`, { headers });

                    console.log("API call:", Date.now() - t0, "ms");

                    if (data?.length > 0) {
                        const p = data[0];

                        // patientData = {
                        //     patNum: p.PatNum,
                        //     patientName: `${p.FName} ${p.LName}`.trim(),
                        //     patient_dob: p.Birthdate,
                        //     email: p.Email
                        // };

                        const t1 = Date.now();
                        await session.set(uuid, {
                            patientData: {
                                patNum: p.PatNum,
                                patientName: `${p.FName} ${p.LName}`.trim(),
                                patient_dob: p.Birthdate,
                                email: p.Email
                            },
                            date: null,
                            time: null,
                            slots: []
                        });
                        console.log("session.set:", Date.now() - t1, "ms");
                        // console.log("✅ Patient found:", patientData.patientName);
                    }

                } catch (err) {
                    console.log("❌ Patient lookup failed:", err);
                }
            } else {
                console.log(`⏭️  Outbound call — using pre-seeded patientData | UUID: ${uuid}`);
            }


            // ✅ Step 3: Save session for WS bridge
            await session.set(uuid, {
                company_id: companyId,
                extension,
                phone: caller,
                direction: isOutbound ? "outbound" : "inbound",
            });

            await session.set(`pending_stream_${uuid}`, {
                uuid,
                caller,
                extension,
                company_id: companyId,
                direction: isOutbound ? "outbound" : "inbound",
                createdAt: Date.now(),
            });
            console.log(`📝 Session saved | UUID: ${uuid} | ext: ${extension}`);

            // ✅ Step 4: Stop silence
            // await conn.execute("break");
            await sleep(150);
            if (!callActive) return;

            // conn.api( `uuid_displace ${uuid} start silence_stream://-1` );
            conn.on("esl::event::CUSTOM::mod_audio_stream::play", (event) => {
                console.log('event329', event);

                const body = event.getBody();
                try {
                    const data = JSON.parse(body);
                    if (data.file && callActive) {
                        conn.execute("playback", data.file);
                    }
                } catch (err) {
                    console.log("❌ Play error:", err.message);
                }
            });

            // ✅ Step 5: Start WebSocket audio stream to WS bridge
            console.log(`📡 Requesting uuid_audio_stream start | UUID: ${uuid}`);
            conn.api(
                "uuid_audio_stream",
                `${uuid} start ws://127.0.0.1:8085/${uuid} mono 8000`,
                (res) => console.log("🎙️ WS STREAM:", res.getBody())
            );
            

            // ✅ Step 6: Park ONCE — keep call alive
            // await exec(conn, uuid, "park", "");
            await sleep(500);
            // conn.execute("playback", "silence_stream://-1");
            console.log(`🔇 Entering silence loop | UUID: ${uuid}`);
            // conn.execute("playback", "silence_stream://-1");
            //  await exec(conn, uuid, "park", "");         
            while (callActive) {
                // await exec(conn, uuid, "park", "");
                if (!callActive) break;
                await sleep(500);
            }

            // ✅ Step 7: Wait for hangup — like old code's while(callActive)
            // but WITHOUT polling — just wait for event
            // await waitForHangup(conn, uuid, () => { callActive = false; });

            console.log(`✅ Call finished | UUID: ${uuid}`);

        } catch (err) {
            console.log("❌ Error:", err.message);
        }
    });

}).listen(PORT, () => {
    console.log(`🚀 ESL Server running on port ${PORT}`);
});

// ─── Wait for hangup — from old code pattern ─────────────────────────────────

function waitForHangup(conn, uuid, onHangup) {
    return new Promise((resolve) => {
        const eventName = `esl::event::CHANNEL_HANGUP::*`;

        function handler(event) {
            const hangupUuid = event.getHeader("Unique-ID");
            if (hangupUuid === uuid) {
                conn.removeListener(eventName, handler);
                if (onHangup) onHangup();
                resolve();
            }
        }

        conn.on(eventName, handler);
    });
}

// ─── exec — EXACTLY from old working code ────────────────────────────────────

function exec(conn, uuid, app, data) {
    return new Promise((resolve) => {
        const eventName = `esl::event::CHANNEL_EXECUTE_COMPLETE::${uuid}`;

        const timeout = setTimeout(() => {
            console.warn(`⚠️ exec timeout: ${app}`);
            conn.removeListener(eventName, handler);
            resolve();
        }, 30000);

        function handler(event) {
            if (event.getHeader("Application") === app) {
                clearTimeout(timeout);
                conn.removeListener(eventName, handler);
                resolve();
            }
        }

        conn.on(eventName, handler);

        try {
            conn.execute(app, data);
        } catch (e) {
            clearTimeout(timeout);
            conn.removeListener(eventName, handler);
            resolve();
        }
    });
}
function eslApiCall(conn, command, args, timeoutMs = 5000) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            console.warn(`⚠️ eslApiCall timeout: ${command} ${args}`);
            resolve(null);
        }, timeoutMs);

        conn.api(command, args, (res) => {
            clearTimeout(timer);
            resolve(res.getBody());
        });
    });
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}



