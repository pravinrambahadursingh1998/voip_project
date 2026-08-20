/**
 * Outbound call originator.
 * Does NOT touch esl-server.js or ws-bridge.js — it just originates a
 * FreeSWITCH call and points it at the SAME socket app (127.0.0.1:8084)
 * that inbound calls use, so the existing pipeline picks it up unchanged.
 */
const { Connection } = require("modesl");
const crypto = require("crypto");
const session = require("./session");
const getEsl = require("./config/esl")

const GATEWAY = process.env.OUTBOUND_GATEWAY || "betapbxx"; // your sofia gateway name
const CALLER_ID_NUMBER = process.env.OUTBOUND_CALLER_ID || "2041109";


/**
 * Place an outbound call and route it into the existing AI pipeline.
 * @param {string} toNumber   destination number to dial (E.164 or PBX format)
 * @param {object} patientData  optional pre-known patient info, same shape
 *                               esl-server.js stores under session.patientData
 */
async function originateCall(toNumber, patientData = {}, domainName = GATEWAY) {
    const fsConn = getEsl(); // reuse the same connection server.js already opened
    console.log('toNumber',toNumber);
    console.log('domainName',domainName);
    console.log('CALLER_ID_NUMBER',CALLER_ID_NUMBER);
    
    
     if (!fsConn || typeof fsConn.api !== "function") {
        throw new Error("ESL not ready — connection is down or reconnecting");
    }

    const uuid = crypto.randomUUID();

    // Pre-seed session BEFORE the channel exists, keyed by the UUID we're
    // about to force FreeSWITCH to use. esl-server.js reads this via
    // session.get(uuid) once the socket connects.
    await session.set(uuid, {
        patientData,
        direction: "outbound",
        date: null,
        time: null,
        slots: [],
    });

   const originateStr =
        `{origination_uuid=${uuid},origination_caller_id_number=${CALLER_ID_NUMBER},` +
        `ignore_early_media=true,hangup_after_bridge=true}` +
        `sofia/gateway/${GATEWAY}/${toNumber} &socket(127.0.0.1:8086 async full)`;

     return new Promise((resolve, reject) => {
        fsConn.api(`originate ${originateStr}`, (res) => {
            const body = res.getBody();
            console.log("📤 [outbound] originate result:", body);
            body.startsWith("+OK") ? resolve({ uuid, result: body }) : reject(new Error(body));
        });
    });
}

module.exports = { originateCall };