// config/esl.js
const esl = require("modesl");
const OpenAI = require("openai");
const fs = require("fs");
require("dotenv").config();

let fsConn = null;

function connectESL() {
    console.log("🔄 Connecting to FreeSWITCH ESL...");

    fsConn = new esl.Connection("127.0.0.1", 8021, "ClueCon", () => {
        console.log("✅ Connected to FreeSWITCH ESL13");
    });
    //  fsConn = new esl.Connection("165.227.232.158", 8021, "ClueCon", () => {
    //     console.log("✅ Connected to FreeSWITCH ESL13");
    // });

    fsConn.on("error", (err) => {
        console.log("❌ ESL Error:", err.message);
        console.log("🔄 Reconnecting ESL in 3 seconds...");
        fsConn = null;
        setTimeout(connectESL, 3000);
    });

    fsConn.on("end", () => {
        console.log("⚠️ ESL connection lost! Reconnecting...");
        fsConn = null;
        setTimeout(connectESL, 3000);
    });

     // 🔥 Send gateway status events to Angular via Socket.IO
    fsConn.on("esl::event::sofia::gateway_state", (evt) => {
        if (global.io) {
            global.io.emit("gateway-event", {
                gateway: evt.getHeader("Gateway"),
                state: evt.getHeader("State"),
                status: evt.getHeader("Status")
            });
        }
    });
     // Call events (optional)
    fsConn.on("esl::event::CHANNEL_CREATE", (evt) => {
        if (global.io) {
            global.io.emit("call-event", {
                uuid: evt.getHeader("Unique-ID"),
                caller: evt.getHeader("Caller-Caller-ID-Number"),
                callee: evt.getHeader("Caller-Destination-Number"),
                state: "CREATE"
            });
        }
    const uuid = evt.getHeader("Unique-ID");
    const destination = evt.getHeader("Caller-Destination-Number");
    if (destination !== "ai_agent") return;
       console.log("📞 AI CALL:", uuid);

    });

}



// connectESL(); // FreeSWITCH ESL connection disabled

module.exports = () => fsConn;
