const { spawn } = require("child_process");
const fs = require("fs");
const { getAllDevices } = require("../models/deviceModel");
const { addTrafficLogForDevice } = require("../controllers/trafficController");

const startTrafficMonitoring = () => {
    const devices = getAllDevices();
    devices.forEach(device => {
        if (device.ip) {
            console.log(`🚨 Starting traffic monitoring for device: ${device.name} (${device.ip})`);
            
            // Corrected tshark command with proper separator syntax
            const tshark = spawn("tshark", [
                "-i", "Wi-Fi",
                "-f", `host ${device.ip}`,
                "-T", "fields",                    // Use fields format
                "-E", "header=y",                  // Include field names in header
                "-E", "separator=/t",              // Tab separator
                "-E", "quote=d",                   // Double-quote strings
                "-e", "frame.time",                // Timestamp
                "-e", "ip.src",                    // Source IP
                "-e", "ip.dst",                    // Destination IP
                "-e", "ip.proto",                  // Protocol
                "-e", "_ws.col.Info",             // Packet info
                "-l"                               // Line-buffered output
            ]);

            console.log("🔍 tshark process started with PID:", tshark.pid);

            // Log any errors from tshark
            tshark.stderr.on("data", (data) => {
                console.error(`🔴 tshark stderr: ${data}`);
            });

            // Process the traffic data
            tshark.stdout.on("data", (data) => {
                try {
                    const line = data.toString().trim();
                    if (line) {
                        console.log(`📦 Received packet: ${line}`);
                        
                        // Parse the tab-separated line
                        const [timestamp, srcIp, dstIp, protocol, info] = line.split('\t').map(field => 
                            field.replace(/^"(.*)"$/, '$1').trim() // Remove quotes
                        );

                        // Only process if we have valid data
                        if (srcIp || dstIp) {
                            const log = {
                                timestamp: timestamp || new Date().toISOString(),
                                source: {
                                    srcIp,
                                    dstIp,
                                    protocol,
                                    info
                                },
                                raw: line
                            };

                            console.log(`✅ Processed packet for ${device.ip}:`, JSON.stringify(log, null, 2));
                            addTrafficLogForDevice(device.ip, log);
                        }
                    }
                } catch (error) {
                    console.error("🔴 Error processing traffic data:", error.message);
                    console.error("🔍 Raw data:", data.toString());
                }
            });

            // Handle tshark process close
            tshark.on("close", (code) => {
                console.log(`⚠️ tshark for ${device.name} stopped with code ${code}`);
            });

            // Handle process errors
            tshark.on('error', (error) => {
                console.error(`🔴 Error in tshark process for ${device.name}:`, error);
            });

            // Log process exit
            tshark.on('exit', (code, signal) => {
                console.log(`⚠️ tshark process exited with code ${code} and signal ${signal}`);
            });
        }
    });
};

module.exports = { startTrafficMonitoring };