// session.js
// Redis connection disabled
// const Redis = require("ioredis");
// const redis = new Redis({ host: "127.0.0.1", port: 6379 });
// redis.on("error", (err) => console.error("Redis error:", err));
const redis = {
    get: async () => null,
    setex: async () => {},
    del: async () => {},
    keys: async () => [],
};

const SESSION_TTL = 3600; // 1 hour in seconds

const session = {
    async get(uuid) {
        try {
            const raw = await redis.get(`session:${uuid}`);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error("session.get error:", e.message);
            return null;
        }
    },

    async set(uuid, data) {
        try {
            const existing = await session.get(uuid) || {};
            const merged = { ...existing, ...data };
            await redis.setex(`session:${uuid}`, SESSION_TTL, JSON.stringify(merged));
        } catch (e) {
            console.error("session.set error:", e.message);
        }
    },

    async delete(uuid) {
        try {
            await redis.del(`session:${uuid}`);
        } catch (e) {
            console.error("session.delete error:", e.message);
        }
    },
      // ✅ ADD THIS — scan Redis for keys matching a pattern
    async keys(pattern) {
        try {
            const keys = await redis.keys(`session:${pattern}`);
            // Strip "session:" prefix so returned keys match what you pass to get/delete
            return keys.map(k => k.replace(/^session:/, ""));
        } catch (e) {
            console.error("session.keys error:", e.message);
            return [];
        }
    }
    
    
  
};

module.exports = session;
