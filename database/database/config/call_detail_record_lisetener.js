// config/cdrListener.js
const esl = require("modesl");
const CDR = require("../models/call_detail_record"); // your database connection
const Gateway = require("../models/gate_way");


function startCDRListener() {
    // console.log("📞 Starting CDR Listener...");

    const conn = new esl.Connection("127.0.0.1", 8021, "ClueCon", () => {
        console.log("✅ Connected to FreeSWITCH for CDR");

        conn.subscribe("all");
    });

    conn.on("error", (err) => {
        // console.log("❌ CDR ESL Error:", err.message);
        // console.log("🔄 Reconnecting CDR Listener in 3 seconds...");
        setTimeout(startCDRListener, 3000);
    });

    conn.on("esl::event::CHANNEL_HANGUP_COMPLETE::*", async (evt) => {
        try {
            // console.log('event22',evt);
            // console.log("ALL HEADERS:");
// evt.headers.forEach(h => console.log(h.name, "=", h.value));
const gateways = await Gateway.fetchAll();
             const gwList = gateways.toJSON();
             const pbxGateway = gwList[0].gateway;      // 1035
             const pbxDomain  = gwList[0].from_domain; // secure.voipoffice.com
             const gate_way_id = gwList[0].id
              const caller =
        evt.getHeader("Caller-Caller-ID-Number") ||
        evt.getHeader("variable_sip_from_user") ||
        evt.getHeader("Caller-ANI") ||
        null;
        let callee =
        evt.getHeader("Caller-Destination-Number") ||
        evt.getHeader("variable_sip_req_user") ||
        evt.getHeader("variable_sip_to_user") ||
        evt.getHeader("variable_sip_req_uri") ||
        evt.getHeader("variable_sip_to_uri") ||
        null;

        if(callee == 'ai_agent' || callee == 'ai_agent_loop' ){
            callee = 0
        }

            // const gateway = evt.getHeader("variable_sip_gateway_name");
            const gateway = pbxDomain
            const uuid = evt.getHeader("Unique-ID");
            const duration = evt.getHeader("variable_duration") || 0;
            const billsec = evt.getHeader("variable_billsec") || 0;
            const hangupCause = evt.getHeader("Hangup-Cause");
            const sipStatus = evt.getHeader("variable_last_bridge_proto_specific_reason");

            // console.log("📌 CDR Captured:", {
            //     caller, callee, gateway, uuid, duration, billsec, hangupCause
            // });

            await CDR.forge({
                caller: caller,
                callee: callee,
                extension_id:caller,
                incoming_extension:callee,
                gateway_id: gate_way_id,
                call_uuid: uuid,
                duration: duration,
                billsec: billsec,
                hangup_cause: hangupCause,
                sip_status: sipStatus,
                start_time: new Date(),
                end_time: new Date()
            }).save();

            // console.log("💾 CDR Saved in DB");

             


const msg =
`call-command: sendmsg
to: sofia/gateway/${pbxGateway}/pbx-log@${pbxDomain}
content-type: text/plain

CALL_END
Caller=${caller}
Callee=${callee}
Billsec=${billsec}
Cause=${hangupCause}`;

conn.api(msg);
// console.log("📡 PBX CALL_END sent via gateway",msg);

            // Emit to Angular live dashboard
            if (global.io) {
                global.io.emit("cdr", {
                    caller,
                    callee,
                    duration,
                    billsec,
                    gateway,
                    uuid,
                    hangupCause
                });
            }

        } catch (err) {
            console.log("❌ Error saving CDR:", err.message);
        }
    });
}

// startCDRListener(); // FreeSWITCH ESL CDR connection disabled

module.exports = startCDRListener;
