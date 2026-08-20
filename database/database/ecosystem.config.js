// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: "ai-api",
            script: "./server.js",
            cwd: "/home/pravin/Documents/voip_project/database",  // ✅ ADD THIS
            instances: "max",
            exec_mode: "cluster",
            watch: false,
            max_memory_restart: "400M",
            env: { NODE_ENV: "production", PORT: 3000 },
            error_file: "./logs/api-error.log",
            out_file:   "./logs/api-out.log"
        },
        {
            name: "esl-server",
            script: "./cluster.js",
            cwd: "/home/pravin/Documents/voip_project/database",  // ✅ ADD THIS
            instances: 1,
            exec_mode: "fork",
            watch: false,
            max_memory_restart: "400M",
            error_file: "./logs/esl-error.log",
            out_file:   "./logs/esl-out.log"
        },
        {
            name:"esl-outbound-server",
            script:"./cluster.js",
             cwd: "/home/pravin/database",  // ✅ ADD THIS
            instances: 1,
            exec_mode: "fork",
            watch: false,
            max_memory_restart: "400M",
            error_file: "./logs/esl-error.log",
            out_file:   "./logs/esl-out.log"
        },
        {
            name: "ai-queue-worker",
            script: "./workers/worker.js",
            cwd: "/home/pravin/Documents/voip_project/database",  // ✅ ADD THIS
            instances: 2,
            exec_mode: "fork",
            watch: false,
            max_memory_restart: "600M",
            error_file: "./logs/worker-error.log",
            out_file:   "./logs/worker-out.log"
        },
        {
            name: "ws-bridge",
            script: "./ws-bridge.js",
            cwd: "/home/pravin/database",
            instances: 1,              // ⚠️ IMPORTANT: keep 1 (WebSocket server)
            exec_mode: "fork",
            watch: false,
            max_memory_restart: "400M",
            error_file: "./logs/ws-error.log",
            out_file:   "./logs/ws-out.log",
        },
        
        {
            name: "ws-bridge-outbound",
            script: "./ws-bridge-outbound.js",
            cwd: "/home/pravin/database",
            instances: 1,              // ⚠️ IMPORTANT: keep 1 (WebSocket server)
            exec_mode: "fork",
            watch: false,
            max_memory_restart: "400M",
            error_file: "./logs/ws-error.log",
            out_file:   "./logs/ws-out.log",
        }
    ]
};