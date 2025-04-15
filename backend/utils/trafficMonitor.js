const { spawn } = require("child_process");
const fs = require("fs");
const { getAllDevices } = require("../models/deviceModel");
const { addTrafficLog } = require("../models/trafficModel");

const startTrafficMonitoring = () => {
    const devices = getAllDevices();
    
    if (!devices || devices.length === 0) {
        console.log("⚠️ No devices found to monitor");
        return;
    }

    devices.forEach(device => {
        if (device.ip) {
            monitorDevice(device);
        }
    });
};

const monitorDevice = (device) => {
    console.log(`🚨 Starting traffic monitoring for device: ${device.name} (${device.ip})`);
    
    const tshark = spawn("tshark", [
        "-i", "Wi-Fi",
        "-f", `host ${device.ip}`,
        "-T", "fields",
        "-E", "header=y",
        "-E", "separator=/t",
        "-E", "quote=d",
        "-e", "frame.time",
        "-e", "ip.src",
        "-e", "ip.dst",
        "-e", "ip.proto",
        "-e", "_ws.col.Info",
        "-l"
    ]);

    tshark.stdout.on("data", (data) => {
        try {
            const lines = data.toString().trim().split('\n');
            
            lines.forEach(line => {
                if (!line.trim()) return;

                const [timestamp, srcIp, dstIp, protocol, info] = line.split('\t').map(field => 
                    field.replace(/^"(.*)"$/, '$1').trim()
                );

                if (srcIp || dstIp) {
                    const log = {
                        timestamp: new Date().toISOString(),
                        source: {
                            srcIp,
                            dstIp,
                            protocol: protocol || 'Unknown',
                            info: info || 'No information'
                        },
                        raw: line
                    };

                    // Add log directly using the model function
                    const saved = addTrafficLog(device.ip, log);
                    if (saved) {
                        console.log(`✅ Logged traffic for ${device.ip}`);
                    }
                }
            });
        } catch (error) {
            console.error("🔴 Error processing traffic data:", error);
        }
    });

    tshark.stderr.on("data", (data) => {
        console.error(`🔴 tshark stderr: ${data}`);
    });

    tshark.on("close", (code) => {
        console.log(`⚠️ tshark for ${device.name} stopped with code ${code}`);
        // Restart monitoring after a delay
        setTimeout(() => monitorDevice(device), 5000);
    });
};

module.exports = { startTrafficMonitoring };