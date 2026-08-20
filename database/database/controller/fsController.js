const Gateway = require("../models/gate_way");
const fsConn = require("../config/esl"); // ESL connection
const Extension = require("../models/v_extensions")


const fsXML = async (req, res) => {
  console.log("===== XML CURL REQUEST RECEIVED =====");
  console.log('req.body',req.body);
  
  // console.log(req.body);

  const section = req.body.section;
  const key = req.body.key_value;
  const profileName = req.body.profile || "external";
  const purpose = req.body.purpose || "";
  const local_ip_v4 = "$${local_ip_v4}";
  const internal_sip_port = "$${internal_sip_port}";
  const external_sip_port = "$${external_sip_port}"

  if (section === "directory") {
    return directory(req, res);
  }


  // Validate Token
  if (req.query.token !== process.env.XMLCURL_TOKEN) {
    console.log("❌ Invalid XMLCURL_TOKEN");
    return res.status(401).send("Unauthorized");
  }

  // -----------------------------------------
  // 1️⃣ HANDLE: FreeSWITCH requests "gateways"
  // -----------------------------------------
  if (section === "configuration" && purpose === "gateways") {
    console.log("➡ Sending gateway list to FreeSWITCH");

    const gateways = await Gateway.fetchAll();
    const list = gateways.toJSON();
    console.log('gateways31', list);

    let xmlGateways = "";
    list.forEach(g => {
      xmlGateways += `
        <gateway name="${g.gateway}">
          <param name="username" value="${g.username}"/>
          <param name="password" value="${g.password}"/>
          <param name="proxy" value="${g.proxy}"/>
          <param name="realm" value="${g.from_domain || g.realm}"/>
          <param name="register" value="${g.register}"/>
          <param name="from-user" value="1035"/>
          <param name="from-domain" value="secure.voipoffice.com"/>
        </gateway>`;
    });



    const xml = `
  <document type="freeswitch/xml">
    <section name="configuration">
      <configuration name="sofia.conf">

        <profiles>
          <profile name="${profileName}">

            <!-- ADD THIS DOMAIN BLOCK -->
            <domains>
              <domain name="all" alias="false" parse="true"/>
            </domains>

            <settings>
              <param name="sip-ip" value="${local_ip_v4}"/>
              <param name="rtp-ip" value="${local_ip_v4}"/>
              <param name="context" value="default"/>
              <param name="apply-nat-acl" value="localnet.auto"/>
              <param name="apply-inbound-acl" value="localnet.auto"/>
              <param name="inbound-codec-prefs" value="OPUS,PCMU,PCMA"/>
              <param name="outbound-codec-prefs" value="OPUS,PCMU,PCMA"/>
            </settings>

            <gateways>
              ${xmlGateways}
            </gateways>

          </profile>
        </profiles>

      </configuration>
    </section>
  </document>`;

    return res.type("xml").send(xml);
  }

  // -----------------------------------------
  // 2️⃣ HANDLE: SIP PROFILE (external)
  // -----------------------------------------

  //  <!-- <profile name="internal">
  //         <settings>
  //           <param name="sip-ip" value="${local_ip_v4}"/>
  //           <param name="rtp-ip" value="${local_ip_v4}"/>
  //           <param name="sip-port" value="$${internal_sip_port}"/>
  //           <param name="context" value="default"/>
  //           <param name="apply-nat-acl" value="localnet.auto"/>
  //           <param name="apply-inbound-acl" value="localnet.auto"/>
  //           <param name="inbound-codec-prefs" value="OPUS,PCMU,PCMA"/>
  //           <param name="outbound-codec-prefs" value="OPUS,PCMU,PCMA"/>
  //         </settings>
  //       </profile> -->
  if (section === "configuration" && key == 'sofia.conf') {
    console.log('pravin111');
    
    const gateways = await Gateway.fetchAll();
    const list = gateways.toJSON();
    // console.log('gateways89',list);

    let xmlGateways = "";
    list.forEach(g => {
      const registerTransport = g.register_transport === 1 ? 'udp' : g.register_transport === 2 ? 'tcp' : 'tls';
      const register = g.register == true ? 'true' : 'false';
      xmlGateways += `
        <gateway name="${g.gateway_name}">
          <param name="username" value="${g.username}"/>
          <param name="password" value="${g.password}"/>
          <param name="realm" value="${g.from_domain || g.realm}"/>
          <param name="proxy" value="${g.proxy}"/>
          <param name="register" value="${register}"/>
          <param name="expire-seconds" value="3600"/>
           <param name="retry-seconds" value="1"/>
           <param name="register-transport" value="${registerTransport}"/>
           <param name="ping" value="25"/>
          <param name="from-domain" value="${g.from_domain}"/>
          <param name="from-user" value="${g.from_user}"/>
          <param name="caller-id-in-from" value="true"/>
        </gateway>`;

  //     xmlGateways +=`
  // <gateway name="betapbxx">
  // <param name="username" value="2041109"/>
  // <param name="password" value="3a-4SLw8v7*O_%0ADunIw54vg!DgFSuq"/>
  // <param name="realm" value="beta.voipoffice.com"/>
  // <param name="proxy" value="beta.voipoffice.com:9395"/>
  // <param name="register" value="true"/>
  // <param name="expire-seconds" value="3600"/>
  // <param name="retry-seconds" value="1"/>
  // <param name="register-transport" value="udp"/>
  // <param name="ping" value="25"/>
  // <param name="from-domain" value="beta.voipoffice.com"/>
  // <param name="from-user" value="2041109"/>
  // <param name="caller-id-in-from" value="true"/>
  // </gateway>`;
    });

    const xml = `
      <document type="freeswitch/xml">
        <section name="configuration">
          <configuration name="sofia.conf">
            <profiles>
              <!-- INTERNAL PROFILE -->
        <profile name="internal">
           <settings>
             <param name="sip-ip" value="${local_ip_v4}"/>
             <param name="rtp-ip" value="${local_ip_v4}"/>
             <param name="sip-port" value="$${internal_sip_port}"/>
             <param name="context" value="default"/>
             <param name="apply-nat-acl" value="localnet.auto"/>
             <param name="apply-inbound-acl" value="localnet.auto"/>
             <param name="inbound-codec-prefs" value="OPUS,PCMU,PCMA,L16""/>
             <param name="outbound-codec-prefs" value="OPUS,PCMU,PCMA,L16""/>
           </settings>
        </profile> 
              <profile name="external">
                <settings>
                  <param name="sip-ip" value="${local_ip_v4}"/>
                  <param name="rtp-ip" value="${local_ip_v4}"/>
                  <param name="sip-port" value="5080"/>
                  <param name="dialplan" value="XML"/>
                  <param name="context" value="default"/>
                  <param name="auth-calls" value="true"/>
                  <param name="apply-nat-acl" value="localnet.auto"/>
                  <param name="apply-inbound-acl" value="localnet.auto"/>
                  <param name="inbound-codec-prefs" value="OPUS,PCMU,PCMA,L16""/>
                  <param name="outbound-codec-prefs" value="OPUS,PCMU,PCMA,L16""/>
                </settings>
                <gateways>
                  ${xmlGateways}
                </gateways>
              </profile>
            </profiles>
          </configuration>
        </section>
      </document>`;

    console.log("GENERATED XML:\n", xmlGateways);
    return res.type("xml").send(xml);
  }

  if (section === "configuration") {

    const xml = `
    <document type="freeswitch/xml">
      <section name="configuration">
        <configuration name="${key}"></configuration>
      </section>
    </document>
  `;

    return res.type("xml").send(xml);
  }

  if (section !== "configuration") {
    return res.status(404).end();
  }

};

const directory = async (req, res) => {
  try {
    console.log('directory186', req.body);
    // console.log('req.body187',req.query);
    if (req.body.section != 'directory') {
      return res.status(404).end();
    }


    // if (req.query.token !== process.env.XMLCURL_TOKEN) {
    //   return res.status(401).send("Unauthorized");
    // }

    const user = req.body.user || req.body.sip_to_user || req.body.sip_req_user || req.body.sip_auth_username || req.body['Caller-Destination-Number']; // Zoiper sends user ID here
    const domain = req.body.domain || 'default';

    if (!user) {
      console.log("❌ Directory request missing user");
      return res.type("xml").send(`
        <document type="freeswitch/xml">
          <section name="directory">
            <result status="not found"/>
          </section>
        </document>
      `);
    }

    // Fetch extension from DB
    const ext = await Extension.where({ extension: user }).fetch().catch(() => null);

  if (!ext) {
  console.log("⚠ Extension not found in DB, allowing:", user);

  return res.type("xml").send(`
    <document type="freeswitch/xml">
      <section name="directory">
        <domain name="${domain}">
          <groups>
            <group name="default">
              <users>

                <user id="${user}">
                  <params>
                    <param name="password" value="3a-4SLw8v7*O_%0ADunIw54vg!DgFSuq"/>
                    <param name="dial-string" value="{sip_invite_domain=${'$'}{dialed_domain}}${'$'}{sofia_contact(${'$'}{dialed_user}@${'$'}{dialed_domain})}"/>
                  </params>

                  <variables>
                    <variable name="user_context" value="default"/>
                    <variable name="effective_caller_id_name" value="${user}"/>
                    <variable name="effective_caller_id_number" value="${user}"/>
                  </variables>

                </user>

              </users>
            </group>
          </groups>
        </domain>
      </section>
    </document>
  `);
}

    const data = ext.toJSON();

    const xml = `
      <document type="freeswitch/xml">
        <section name="directory">
          <domain name="${domain}">
            <user id="${data.extension}">
              <params>
                <param name="password" value="${data.password}"/>
                <param name="dial-string" value="{sip_invite_domain=${'$'}{dialed_domain}}${'$'}{sofia_contact(${'$'}{dialed_user}@${'$'}{dialed_domain})}"/>
              </params>
              <variables>
                <variable name="user_context" value="default"/>
                <variable name="effective_caller_id_name" value="${data.extension}"/>
                <variable name="effective_caller_id_number" value="${data.extension}"/>
              </variables>
            </user>
          </domain>
        </section>
      </document>
    `;



    return res.type("xml").send(xml);

  } catch (error) {
    console.log("❌ Directory Error:", error);
    return res.type("xml").send(`
      <document type="freeswitch/xml">
        <section name="directory">
          <result status="error"/>
        </section>
      </document>
    `);
  }
};

// const dialplan = async (req, res) => {
//   try {
//     console.log("📞 DIALPLAN HIT:");
//     console.log("Headers:", req.headers);
//     console.log("Query:", req.query);
//     console.log("Body:", req.body);

//       if (req.body.section !== 'dialplan') {
//         return res.status(404).end();
//       }


//     if (req.query.token !== process.env.XMLCURL_TOKEN) {
//       return res.status(401).send("Unauthorized");
//     }

//     const gateways = await Gateway.fetchAll();
//     const gwList = gateways.toJSON();
//     const bicomGateway = gwList.length > 0 ? gwList[0].gateway : "1035";
//         const gateway = gwList[0];

//     const pbxDomain = gateway.from_domain;        // secure.voipoffice.com
//     const pbxProxy  = gateway.proxy; 

//     let matchRules = "";

//     // ======================================================
//     // 1️⃣ INTERNAL → INTERNAL (NO user_exists)
//     // ======================================================


// // matchRules += `
// // <extension name="internal_with_pbx_log">
// //   <condition field="destination_number" expression="^\\d{4}$">

// //     <action application="set" inline="true" data="dst_exists=\${user_exists(\${destination_number} \${domain_name})}"/>

// //     <action application="export" data="sip_gateway_name=${bicomGateway}"/>

// //     <action application="export" data="sip_h_X-Log-Type=CALL_START"/>
// //     <action application="export" data="sip_h_X-Caller=\${effective_caller_id_number}"/>
// //     <action application="export" data="sip_h_X-Callee=\${destination_number}"/>

// //     <action application="set" data="call_timeout=10"/>
// //     <action application="set" data="hangup_after_bridge=true"/>
// //     <action application="set" data="continue_on_fail=true"/>

// //     <action application="bridge" data="\${sofia_contact(\${destination_number}@\${domain_name})}"/>

// //     <action application="transfer" data="ai_agent XML default"/>

// //   </condition>
// // </extension>
// // `;


// matchRules += `
// <extension name="internal_with_pbx_log">
//   <condition field="destination_number" expression="^\\d{4}$">

//     <action application="set" inline="true" data="dst_exists=\${user_exists(id \${destination_number} \${domain_name})}"/>

//     <action application="export" data="sip_gateway_name=${bicomGateway}"/>

//     <action application="export" data="nolocal:sip_h_X-Log-Type=CALL_START"/>
//     <action application="export" data="nolocal:sip_h_X-Caller=\${effective_caller_id_number}"/>
//     <action application="export" data="nolocal:sip_h_X-Callee=\${destination_number}"/>

//     <action application="set" data="call_timeout=10"/>
//     <action application="set" data="hangup_after_bridge=true"/>
//     <action application="set" data="continue_on_fail=true"/>

//     <action application="bridge" data="\${sofia_contact(\${destination_number}@\${domain_name})}"/>

//     <action application="transfer" data="ai_agent XML default"/>

//   </condition>
// </extension>
// `;



// // matchRules += `
// // <extension name="internal_with_pbx_log">
// //   <condition field="destination_number" expression="^\\d{4}$">

// //     <!-- Check if destination is registered -->
// //     <action application="set"
// //       data="dst_exists=\${user_exists(\${destination_number}@\${domain_name})}"/>

// //     <!-- Add PBX headers ONLY if registered -->
// //     <condition field="\${dst_exists}" expression="true">
// //          <action application="export" data="sip_gateway_name=${bicomGateway}"/>
// //       <action application="export" data="sip_h_X-Log-Type=CALL_START"/>
// //       <action application="export" data="sip_h_X-Caller=\${effective_caller_id_number}"/>
// //       <action application="export" data="sip_h_X-Callee=\${destination_number}"/>
// //     </condition>

// //     <!-- Single REAL bridge -->
// //     <action application="bridge"
// //        data="\${sofia_contact(\${destination_number}@\${domain_name})}"/>
// //   </condition>
// // </extension>
// // `;



//  // AI Agent handle the call

// matchRules += `
// <extension name="ai_agent">
//   <condition field="destination_number" expression="^ai_agent$">
//     <action application="answer"/>
//     <action application="sleep" data="1000"/>

//     <action application="curl" data="http://127.0.0.1:3000/ai/greet?uuid=${'$'}{uuid}&caller=${'$'}{caller_id_number}"/>
//     <action application="playback" data="/tmp/ai_reply_${'$'}{uuid}.wav"/>

//     <action application="transfer" data="ai_agent_loop XML default"/>
//   </condition>
// </extension>

// <extension name="ai_agent_loop">
//   <condition field="destination_number" expression="^ai_agent_loop$">

//     <action application="set" data="playback_terminators=none"/>

//     <action application="playback" data="tone_stream://%(200,0,800)"/>

//     <action application="record" data="/tmp/ai_input_${'$'}{uuid}.wav 10 200 2"/>

//     <action application="curl" data="http://127.0.0.1:3000/ai/voice?uuid=${'$'}{uuid}&caller=${'$'}{caller_id_number} post /tmp/ai_input_${'$'}{uuid}.wav"/>

//     <action application="playback" data="/tmp/ai_reply_${'$'}{uuid}.wav"/>

//     <action application="transfer" data="ai_agent_loop XML default"/>
//   </condition>
// </extension>
// `;





// // matchRules += `
// // <extension name="internal_to_internal">
// //   <condition field="destination_number" expression="^\\d{4}$">
// //     <action application="bridge"
// //             data="\${sofia_contact(\${destination_number}@\${domain_name})}"/>
// //   </condition>
// // </extension>
// // `;

//     // ======================================================
//     // 2️⃣ INTERNAL → BICOM PBX
//     // ======================================================
//     matchRules += `
//       <extension name="internal_to_gateway">
//         <condition field="destination_number" expression="^\\d{4}$">
//           <action application="export" data="sip_h_X-Call-Type=internal"/>
//           <action application="export" data="call_direction=internal"/>
//           <action application="set" data="callee=\${destination_number}"/>
//           <action application="export" data="gateway=${bicomGateway}"/>
//           <action application="export" data="sip_gateway_name=${bicomGateway}"/>
//           <action application="bridge" data="sofia/gateway/${bicomGateway}/\${destination_number}"/>
//         </condition>
//       </extension>
//     `;

//     // ======================================================
//     // 3️⃣ OTHER OUTBOUND
//     // ======================================================
//     gwList.forEach((g) => {
//       matchRules += `
//         <extension name="out_${g.gateway}">
//           <condition field="destination_number" expression="^${g.prefix || '\\\\d+'}$">
//             <action application="set" data="callee=\${destination_number}"/>
//             <action application="export" data="sip_gateway_name=${g.gateway}"/>
//             <action application="bridge" data="sofia/gateway/${g.gateway}/\${destination_number}"/>
//           </condition>
//         </extension>
//       `;
//     });

//     const xml = `
//       <document type="freeswitch/xml">
//         <section name="dialplan">
//           <context name="default">
//             ${matchRules}
//           </context>
//         </section>
//       </document>
//     `;

//     return res.type("xml").send(xml);

//   } catch (err) {
//     console.error("❌ Dialplan Error:", err);
//     return res.send(err);
//   }
// };


const dialplan = async (req, res) => {
  try {
    console.log("📞 DIALPLAN HIT:");
    console.log("Headers:", req.headers);
    console.log("Query:", req.query);
    console.log("Body:", req.body);

    if (req.body.section !== 'dialplan') {
      return res.status(404).end();
    }


    if (req.query.token !== process.env.XMLCURL_TOKEN) {
      return res.status(401).send("Unauthorized");
    }

    const gateways = await Gateway.fetchAll();
    const gwList = gateways.toJSON();
    const bicomGateway = gwList.length > 0 ? gwList[0].gateway : "secure_voipoffice";
    const gateway = gwList[0];

    const pbxDomain = gateway.from_domain;        // secure.voipoffice.com
    const pbxProxy = gateway.proxy;

    let matchRules = "";

    // ======================================================
    // 1️⃣ INTERNAL → INTERNAL (NO user_exists)
    // ======================================================


    // matchRules += `
    // <extension name="internal_with_pbx_log">
    //   <condition field="destination_number" expression="^\\d{4}$">

    //     <action application="set"  data="dst_exists=\${user_exists(\${destination_number}@\${domain_name})}"/>

    //    <condition field="\${dst_exists}" expression="true">
    //     <action application="export" data="sip_gateway_name=${bicomGateway}"/>
    //     <action application="export" data="sip_h_X-Log-Type=CALL_START"/>
    //     <action application="export" data="sip_h_X-Caller=\${effective_caller_id_number}"/>
    //     <action application="export" data="sip_h_X-Callee=\${destination_number}"/>
    //    </condition>

    //     <action application="set" data="call_timeout=10"/>
    //     <action application="set" data="hangup_after_bridge=true"/>
    //     <action application="set" data="continue_on_fail=true"/>

    //     <action application="bridge" data="\${sofia_contact(\${destination_number}@\${domain_name})}"/>

    //     <action application="transfer" data="ai_agent XML default"/>

    //   </condition>
    // </extension>
    // `;


// matchRules +=`
// <extension name="incoming_from_gateway">
//   <condition field="destination_number" expression="^\\d+$">
//     <action application="answer"/>
//     <action application="set" data="call_timeout=10"/>
//     <action application="set" data="hangup_after_bridge=true"/>
//     <action application="set" data="continue_on_fail=true"/>
//     <action application="socket" data="127.0.0.1:8084 async full"/>
//   </condition>
// </extension>
//   `  

//   matchRules +=`
// <extension name="incoming_from_gateway">
//   <condition field="destination_number" expression="^\\d+$">
//     <action application="answer"/>
//     <action application="socket" data="127.0.0.1:8084 async full"/>
//   </condition>
// </extension>
//   `  

    matchRules +=`
<extension name="incoming_from_gateway">
  <condition field="destination_number" expression="^\\d+$">
    <action application="socket" data="127.0.0.1:8084 async full"/>
  </condition>
</extension>
  `  
// matchRules += `
//  <extension name="ai_entry">
//   <condition field="destination_number" expression="^ai_entry">
//   <action application="log" data="🔥 AI_ENTRY STARTED"/>
//     <action application="set" data="caller=\${caller_id_number}"/>
//     <action application="playback" data="silence_stream://1000"/>
//     <action application="log" data="🔥 BEFORE CURL"/>

//     <action application="curl" data="http://127.0.0.1:3000/ai/greet?uuid=${'$'}{uuid}&caller=${'$'}{caller_id_number}"/>
//      <action application="playback" data="/tmp/ai_reply_${'$'}{uuid}.wav"/>
//      <action application="log" data="🔥 BEFORE CURL"/>

//     <action application="transfer" data="ai_agent_loop XML default"/>
//   </condition>
// </extension>

// <extension name="ai_agent_loop">
//   <condition field="destination_number" expression="^ai_agent_loop$">
    
//     <action application="set" data="playback_terminators=none"/>

//     <action application="playback" data="tone_stream://%(200,0,800)"/>

//     <action application="record" data="/tmp/ai_input_${'$'}{uuid}.wav 10 200 2"/>

//     <action application="curl" data="http://127.0.0.1:3000/ai/voice?uuid=${'$'}{uuid}&caller=${'$'}{caller_id_number} post /tmp/ai_input_${'$'}{uuid}.wav"/>

//     <action application="playback" data="/tmp/ai_reply_${'$'}{uuid}.wav"/>

//     <action application="transfer" data="ai_agent_loop XML default"/>
//   </condition>
// </extension>
//  `  

  

      // AI Agent handle the call
// matchRules += `
// <extension name="ai_agent">
//   <condition field="destination_number" expression="^ai_agent$">
//     <action application="answer"/>
//     <action application="sleep" data="1000"/>
    
//     <action application="curl" data="http://127.0.0.1:3000/ai/greet?uuid=${'$'}{uuid}&caller=${'$'}{caller_id_number}"/>
//     <action application="playback" data="/tmp/ai_reply_${'$'}{uuid}.wav"/>

//     <action application="transfer" data="ai_agent_loop XML default"/>
//   </condition>
// </extension>

// <extension name="ai_agent_loop">
//   <condition field="destination_number" expression="^ai_agent_loop$">
    
//     <action application="set" data="playback_terminators=none"/>

//     <action application="playback" data="tone_stream://%(200,0,800)"/>

//     <action application="record" data="/tmp/ai_input_${'$'}{uuid}.wav 10 200 2"/>

//     <action application="curl" data="http://127.0.0.1:3000/ai/voice?uuid=${'$'}{uuid}&caller=${'$'}{caller_id_number} post /tmp/ai_input_${'$'}{uuid}.wav"/>

//     <action application="playback" data="/tmp/ai_reply_${'$'}{uuid}.wav"/>

//     <action application="transfer" data="ai_agent_loop XML default"/>
//   </condition>
// </extension>
// `;

//    matchRules += `
// <extension name="internal_with_pbx_log">
//   <condition field="destination_number" expression="^(\\d+)$">

//      <!-- preserve caller -->
//     <action application="set" data="effective_caller_id_number=\${caller_id_number}"/>
//     <action application="set" data="origination_caller_id_number=\${caller_id_number}"/>

//     <!-- Keep your logging headers -->
//     <action application="export" data="sip_gateway_name=betapbx"/>
//     <action application="export" data="sip_h_X-Log-Type=CALL_START"/>
//     <action application="export" data="sip_h_X-Caller=\${caller_id_number}"/>
//     <action application="export" data="sip_h_X-Callee=\${destination_number}"/>

//     <!-- Call control -->
//     <action application="set" data="call_timeout=10"/>
//     <action application="set" data="hangup_after_bridge=true"/>
//     <action application="set" data="continue_on_fail=true"/>

//     <!-- Gateway bridge (identity preserved) -->
//     <!-- <action application="originate"
//       data="{ignore_early_media=true,origination_caller_id_number=\${caller_id_number}}sofia/gateway/betapbx/\${destination_number} &sleep(3600)"/> -->


//        <!-- Real call -->
//    <!-- <action application="bridge"
//       data="\${sofia_contact(\${destination_number}@\${domain_name})}"/> -->

//         <action application="bridge"
//       data="sofia/gateway/betapbx/\${destination_number}"/>

//   </condition>
// </extension>
// `;



    // matchRules += `
    // <extension name="internal_with_pbx_log">
    //   <condition field="destination_number" expression="^(\\d+)$">

    //     <!-- Check if destination is registered -->
    //     <action application="set"
    //       data="dst_exists=\${user_exists(\${destination_number}@\${domain_name})}"/>

    //     <!-- Add PBX headers ONLY if registered -->
    //     <condition field="\${dst_exists}" expression="true">
    //          <action application="export" data="sip_gateway_name=${bicomGateway}"/>
    //       <action application="export" data="sip_h_X-Log-Type=CALL_START"/>
    //       <action application="export" data="sip_h_X-Caller=\${effective_caller_id_number}"/>
    //       <action application="export" data="sip_h_X-Callee=\${destination_number}"/>
    //     </condition>

    //     <!-- Single REAL bridge -->
    //     <action application="bridge"
    //        data="\${sofia_contact(\${destination_number}@\${domain_name})}"/>

    //   </condition>
    // </extension>
    // `;


    // matchRules += `
    // <extension name="internal_to_internal">
    //   <condition field="destination_number" expression="^\\d{4}$">
    //     <action application="bridge"
    //             data="\${sofia_contact(\${destination_number}@\${domain_name})}"/>
    //   </condition>
    // </extension>
    // `;

    // ======================================================
    // 2️⃣ INTERNAL → BICOM PBX
    // ======================================================
    // matchRules += `
    //   <extension name="internal_to_gateway">
    //     <condition field="destination_number" expression="^\\d{4}$">
    //       <action application="export" data="sip_h_X-Call-Type=internal"/>
    //       <action application="export" data="call_direction=internal"/>
    //       <action application="set" data="callee=\${destination_number}"/>
    //       <action application="export" data="gateway=${bicomGateway}"/>
    //       <action application="export" data="sip_gateway_name=${bicomGateway}"/>
    //       <action application="bridge" data="sofia/gateway/${bicomGateway}/\${destination_number}"/>
    //     </condition>
    //   </extension>
    // `;

    // ======================================================
    // 3️⃣ OTHER OUTBOUND
    // ======================================================
    // gwList.forEach((g) => {
    //   matchRules += `
    //     <extension name="out_${g.gateway}">
    //       <condition field="destination_number" expression="^${g.prefix || '\\\\d+'}$">
    //         <action application="set" data="callee=\${destination_number}"/>
    //         <action application="export" data="sip_gateway_name=${g.gateway}"/>
    //         <action application="bridge" data="sofia/gateway/${g.gateway}/\${destination_number}"/>
    //       </condition>
    //     </extension>
    //   `;
    // });

    const xml = `
      <document type="freeswitch/xml">
        <section name="dialplan">
          <context name="default">
            ${matchRules}
          </context>
        </section>
      </document>
    `;

    return res.type("xml").send(xml);

  } catch (err) {
    console.error("❌ Dialplan Error:", err);
    return res.send(err);
  }
};


const monitorGateways = async (req, res) => {
  try {
    // console.log("Gateway monitoring...");

    const rows = await Gateway.fetchAll();
    const gateways = rows.toJSON();
    const results = [];

    const conn = fsConn(); // always fresh ESL instance

    if (!conn) {
      return res.json([{ error: "ESL not connected" }]);
    }

    for (let gw of gateways) {
      console.log('gw');

      const name = !!gw.gateway ? gw.gateway : '1109';

      const raw = await new Promise(resolve => {
        conn.api(`sofia status gateway ${name}`, r => {
          resolve(r.getBody());
        });
      });
      console.log('raw', raw);

      let status = "Not Connected";

      if (/REGED/i.test(raw)) status = "Connected";
      else if (/FAILED/i.test(raw)) status = "Failed";
      else if (/UNREGED/i.test(raw)) status = "Unregistered";
      else if (/Invalid Gateway/i.test(raw)) status = "Not Loaded";
      results.push({ name, status, raw });
    }

    return res.json(results);

  } catch (err) {
    console.error("Monitor error:", err);
    return res.status(500).json({ error: "Monitoring failed" });
  }
};


module.exports = { fsXML, monitorGateways, dialplan, directory }




