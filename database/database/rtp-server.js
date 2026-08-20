const dgram = require("dgram");
// const { RtpPacket } = require('rtp'); 
const PORT = 4000;
const server = dgram.createSocket("udp4");

let client = null;

// RTP state
let seq = 0;
let timestamp = 0;
const SSRC = 0x12345678;

// RTP pacing queue
const audioQueue = [];

// G711 constants
const FRAME_SIZE = 160; // 20ms PCMU @ 8kHz
const RTP_INTERVAL = 20;

server.on("listening", () => {
    console.log("🎧 RTP server listening:", PORT);
});

server.on("message", (msg, rinfo) => {

    if (!client) {
        client = rinfo;

        console.log("🎯 FreeSWITCH RTP target:", rinfo);
    }
});

server.bind(PORT);

//
// RTP pacing loop
//
setInterval(() => {

    if (!client) return;
    if (audioQueue.length === 0) return;

    const payload = audioQueue.shift();

    const packet = Buffer.alloc(12 + payload.length);

    //
    // RTP Header
    //
    packet[0] = 0x80;

    // PT=0 (PCMU)
    packet[1] = 0x00;

    packet.writeUInt16BE(seq, 2);
    packet.writeUInt32BE(timestamp, 4);
    packet.writeUInt32BE(SSRC, 8);

    payload.copy(packet, 12);

    server.send(packet, client.port, client.address);

    seq++;
    timestamp += 160;

}, RTP_INTERVAL);

//
// Push OpenAI audio into RTP queue
//
function sendAudio(ulawBuffer) {

    if (!client) {
        console.log("⏳ Waiting for RTP target...");
        return;
    }

    for (let i = 0; i < ulawBuffer.length; i += FRAME_SIZE) {

        let frame = ulawBuffer.slice(i, i + FRAME_SIZE);

        //
        // pad last frame
        //
        if (frame.length < FRAME_SIZE) {

            const padded = Buffer.alloc(FRAME_SIZE, 0xFF);

            frame.copy(padded);

            frame = padded;
        }

        audioQueue.push(frame);
    }
}

module.exports = {sendAudio};
   


