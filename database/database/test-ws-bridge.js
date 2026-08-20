// test-ws.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8086 });

wss.on("connection", (ws) => {
    console.log("✅ FS Connected");

    ws.on("message", (msg) => {
        console.log("RX", msg.length);
    });

    ws.on("close", () => {
        console.log("❌ Closed");
    });
});

console.log("Listening on 8086...");