const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require('morgan');
const http = require("http");
const { exec } = require("child_process");

require("dotenv").config();
require("./config/db")

require("./config/esl");  // ESL connection loaded once
require("./config/call_detail_record_lisetener")

const gatewayRoutes = require("./routes/gateway.route");
const fsRoutes = require("./routes/fs_routes");
const aiRoutes  = require("./routes/ai_route");
const schedulerRoutes = require("./routes/scheduler_route");
const CommonRoutes = require("./routes/common_route")
const { startScheduler, scheduleCall } = require("./services/call-scheduler"); // match wherever you put it


// Bull board — queue monitor UI
// const { createBullBoard } = require("bull-board");
// const { BullAdapter }     = require("bull-board/bullAdapter");
// const aiQueue             = require("./queues/aiQueue");


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));   // <--- REQUIRED
app.use(morgan("dev"));


app.use("/ai", aiRoutes)

app.use("/api/gateway", gatewayRoutes);
app.use("/schedule", schedulerRoutes); 
app.use('/api', CommonRoutes)
app.use("/", fsRoutes);

const fsConn = require("./config/esl")();

// const { router: bullBoardRouter } = createBullBoard([new BullAdapter(aiQueue)]);
// app.use("/admin/queues", bullBoardRouter);

const server = http.createServer(app);

// Initialize Socket.IO
const io = require("socket.io")(server, {
  cors: { origin: "*" }
});

// Make socket.io globally available
global.io = io;

io.on("connection", (socket) => {
  console.log("✔ WebSocket client connected");
  socket.emit("connected", { message: "Socket connection successful" });
});


// ─── HARDCODED CALLS — edit this list, restart server to apply ───────────────
const HARDCODED_CALLS = [
    {
        toNumber: "1002",
        runAt: "2026-07-26T23:48:00",
        patientData: { patientName: "Pravin" },
    },
    // Add more here, or use dailyTime instead of runAt for recurring:
    // { toNumber: "1002", dailyTime: "09:00", patientData: { patientName: "Chetan" } },
];

async function seedHardcodedCalls() {
  console.log('call');
  
    for (const call of HARDCODED_CALLS) {
        try {
            const job = await scheduleCall(call);
            console.log(`🗓️ Seeded hardcoded call → ${call.toNumber} (id: ${job.id})`);
        } catch (err) {
            console.error(`❌ Failed to seed hardcoded call for ${call.toNumber}:`, err.message);
        }
    }
}

// ✅ ESL connection — only in worker 0 OR when running without PM2
// This prevents N workers all creating ESL connections simultaneously
const isClusterWorker = process.env.pm_id !== undefined;
const isPrimaryWorker = process.env.pm_id === "0" || !isClusterWorker;

if (isPrimaryWorker) {
    require("./config/esl"); // ESL loaded only once
     startScheduler(); 
     seedHardcodedCalls(); 
    console.log(`[Worker ${process.env.pm_id || "solo"}] ESL connection started`);
}

function refreshFS() {
  console.log("🔄 Reloading FreeSWITCH XML...");
  if (!isPrimaryWorker) return;

  exec('sudo fs_cli -x "reloadxml"', (err) => {
    if (err) return console.log("❌ reloadxml failed:", err.message);

    exec('sudo fs_cli -x "sofia profile external rescan"', (err2) => {
      if (err2) return console.log("❌ rescan failed:", err2.message);

      console.log("✅ FreeSWITCH XML + SIP Profile refreshed successfully");
    });
  });
}

setTimeout(refreshFS, 5000);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    // console.log(`[Worker ${process.env.pm_id || "solo"}] Running on http://192.168.1.8:${PORT}`);
    console.log(`[Worker ${process.env.pm_id || "solo"}] Running on http://localhost:${PORT}`);

});