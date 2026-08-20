const express = require("express");
const router = express.Router();
const {
    scheduleCall,
    cancelScheduledCall,
    listScheduledCalls,
} = require("../services/call-scheduler");

// POST /schedule-call  { toNumber, runAt } or { toNumber, dailyTime }
router.post("/schedule-call", async (req, res) => {
    try {
        const job = await scheduleCall(req.body);
        res.json({ ok: true, job });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

router.delete("/schedule-call/:id", async (req, res) => {
    await cancelScheduledCall(req.params.id);
    res.json({ ok: true });
});

router.get("/schedule-call", async (req, res) => {
    res.json({ ok: true, jobs: await listScheduledCalls() });
});

module.exports = router;