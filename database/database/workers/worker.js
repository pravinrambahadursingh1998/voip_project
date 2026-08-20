// workers/worker.js
require("dotenv").config();

console.log(`[Queue Worker] Started — PID ${process.pid}`);

// Booting aiQueue registers the .process() handler automatically
require("../queues/aiQueue");

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log(`[Queue Worker] Shutting down PID ${process.pid}`);
    const aiQueue = require("../queues/aiQueue");
    await aiQueue.close();
    process.exit(0);
});

process.on("uncaughtException", (err) => {
    console.error("[Queue Worker] Uncaught exception:", err.message);
});

process.on("unhandledRejection", (err) => {
    console.error("[Queue Worker] Unhandled rejection:", err?.message);
});