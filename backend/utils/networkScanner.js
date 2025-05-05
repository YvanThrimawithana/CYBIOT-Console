const { spawn } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

class NetworkScanner {
    static validateSubnet(subnet) {
        // Validate CIDR notation (e.g., 192.168.1.0/24)
        const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        if (!cidrPattern.test(subnet)) {
            throw new Error('Invalid subnet format. Expected format: xxx.xxx.xxx.xxx/xx');
        }

        // Validate IP octets and subnet mask
        const [ip, mask] = subnet.split('/');
        const octets = ip.split('.');
        
        if (octets.length !== 4) {
            throw new Error('Invalid IP address format');
        }

        // Validate each octet
        for (const octet of octets) {
            const num = parseInt(octet);
            if (isNaN(num) || num < 0 || num > 255) {
                throw new Error('IP address octets must be between 0 and 255');
            }
        }

        // Validate subnet mask
        const maskNum = parseInt(mask);
        if (isNaN(maskNum) || maskNum < 0 || maskNum > 32) {
            throw new Error('Subnet mask must be between 0 and 32');
        }

        return true;
    }

    static async validateNmapInstallation() {
        try {
            await exec('nmap --version');
            return true;
        } catch (error) {
            console.error('Nmap is not installed or not accessible');
            return false;
        }
    }

    static async scanNetwork(subnet) {
        // Validate subnet before proceeding
        try {
            this.validateSubnet(subnet);
        } catch (error) {
            throw new Error(`Invalid subnet: ${error.message}`);
        }

        if (!await this.validateNmapInstallation()) {
            throw new Error('Nmap is not installed or not accessible');
        }

        return new Promise((resolve, reject) => {
            console.log(`Starting network scan for subnet: ${subnet}`);
            const scanResults = [];
            const nmap = spawn('nmap', [
                '-sS',                 // SYN scan
                '-T4',                 // Aggressive timing
                '--max-retries', '2',  // Limit retries
                '-p-',                 // All ports
                '-n',                  // No DNS resolution
                '-oX', '-',           // Output XML to stdout
                subnet
            ]);

            let xmlOutput = '';
            let errorOutput = '';

            nmap.stdout.on('data', (data) => {
                xmlOutput += data.toString();
            });

            nmap.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.warn(`Nmap warning: ${data}`);
            });

            nmap.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Nmap scan failed with code ${code}: ${errorOutput}`));
                    return;
                }
                resolve(xmlOutput);
            });

            nmap.on('error', (error) => {
                reject(error);
            });
        });
    }

    static async parseNmapResults(xmlOutput) {
        try {
            const parseString = promisify(require('xml2js').parseString);
            const result = await parseString(xmlOutput);
            
            const hosts = result.nmaprun.host || [];
            return hosts.map(host => {
                const address = host.address.find(addr => addr.$.addrtype === 'ipv4');
                const ports = host.ports?.[0]?.port || [];
                
                return {
                    ip: address?.$.addr,
                    timestamp: new Date().toISOString(),
                    status: host.status?.[0]?.$.state || 'unknown',
                    ports: ports.map(port => ({
                        portId: port.$.portid,
                        protocol: port.$.protocol,
                        state: port.state?.[0]?.$.state,
                        service: port.service?.[0]?.$.name
                    })),
                    osMatch: host.os?.[0]?.osmatch?.[0]?.$.name || 'Unknown'
                };
            });
        } catch (error) {
            console.error('Error parsing Nmap results:', error);
            throw error;
        }
    }
}

module.exports = NetworkScanner;