const { spawn } = require("child_process");
const fs = require("fs");
const { getAllDevices } = require("../models/deviceModel");
const { addLog } = require("../models/trafficModel");

const startTrafficMonitoring = async () => {
    try {
        // getAllDevices now returns a Promise with {success, devices} structure
        const result = await getAllDevices();
        
        if (!result.success) {
            console.log("⚠️ Failed to get devices for monitoring");
            return;
        }
        
        const devices = result.devices;
        
        if (!devices || devices.length === 0) {
            console.log("⚠️ No devices found to monitor");
            return;
        }

        console.log(`📡 Starting traffic monitoring for ${devices.length} devices...`);
        devices.forEach(device => {
            if (device.ipAddress) {
                monitorDevice(device);
            } else {
                console.log(`⚠️ Device ${device.name || 'Unknown'} has no IP address`);
            }
        });
    } catch (error) {
        console.error("🔴 Error starting traffic monitoring:", error);
    }
};

const monitorDevice = (device) => {
    console.log(`🚨 Starting traffic monitoring for device: ${device.name} (${device.ipAddress})`);
    
    // Check if tshark is available
    const checkTshark = spawn("tshark", ["--version"]);
    
    checkTshark.on("error", (error) => {
        console.error(`🔴 Failed to start tshark for ${device.name}: ${error.message}`);
        console.log("Please ensure tshark (Wireshark CLI) is installed and in the system PATH");
        return;
    });

    checkTshark.on("close", (code) => {
        if (code !== 0) {
            console.error(`🔴 tshark check failed with code ${code}`);
            return;
        }
        
        // Start actual monitoring
        startDeviceMonitoring(device);
    });
};

const startDeviceMonitoring = (device) => {
    try {
        // Use -D to list interfaces first
        const listInterfaces = spawn("tshark", ["-D"]);
        let interfacesList = "";
        
        listInterfaces.stdout.on("data", (data) => {
            interfacesList += data.toString();
        });
        
        listInterfaces.on("close", () => {
            // Try to find a suitable interface
            let interface = "1"; // Default to first interface
            
            if (interfacesList.toLowerCase().includes("ethernet") || 
                interfacesList.toLowerCase().includes("wi-fi")) {
                // Search for common interfaces
                const lines = interfacesList.split("\n");
                for (const line of lines) {
                    if (line.toLowerCase().includes("ethernet") || 
                        line.toLowerCase().includes("wi-fi") ||
                        line.toLowerCase().includes("wireless")) {
                        interface = line.split(".")[0].trim();
                        break;
                    }
                }
            }
            
            console.log(`📡 Using interface ${interface} for monitoring ${device.ipAddress}`);
            
            const tshark = spawn("tshark", [
                "-i", interface,
                "-f", `host ${device.ipAddress}`,
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

                        console.log(`📝 Traffic detected for ${device.ipAddress}: ${line.substring(0, 50)}...`);

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

                            // Add log using the model function with device.ipAddress as deviceIp
                            const deviceIp = device.ipAddress;
                            addLog(deviceIp, log)
                                .then(result => {
                                    if (result.success) {
                                        console.log(`✅ Logged traffic for ${deviceIp}`);
                                    }
                                })
                                .catch(error => {
                                    console.error(`🔴 Error logging traffic for ${deviceIp}:`, error);
                                });
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
                setTimeout(() => startDeviceMonitoring(device), 5000);
            });
            
            tshark.on("error", (error) => {
                console.error(`🔴 tshark error for ${device.name}: ${error.message}`);
                setTimeout(() => startDeviceMonitoring(device), 5000);
            });
        });
    } catch (error) {
        console.error(`🔴 Error in tshark setup for ${device.name}:`, error);
        setTimeout(() => startDeviceMonitoring(device), 5000);
    }
};

module.exports = { startTrafficMonitoring };