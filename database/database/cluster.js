// cluster.js
const cluster = require("cluster");
const os = require("os");

const NUM_WORKERS = os.cpus().length;

if (cluster.isPrimary) {
    console.log(`Master PID ${process.pid} — spawning ${NUM_WORKERS} ESL workers`);

    for (let i = 0; i < NUM_WORKERS; i++) {
        cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
        console.error(`Worker ${worker.process.pid} died (code: ${code}). Restarting...`);
        cluster.fork(); // auto-restart dead workers
    });

    cluster.on("online", (worker) => {
        console.log(`Worker ${worker.process.pid} is online`);
    });

} else {
    // Each worker runs the ESL TCP server
    require("./esl-server");
}