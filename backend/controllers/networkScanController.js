const NetworkScanner = require('../utils/networkScanner');
const NetworkScan = require('../models/mongoSchemas/networkScanSchema');

const performNetworkScan = async (req, res) => {
    try {
        const { subnet } = req.body;
        
        if (!subnet) {
            return res.status(400).json({
                success: false,
                error: 'Subnet parameter is required'
            });
        }

        // Log the scan request
        console.log(`Initiating network scan for: ${subnet}`);

        // Perform network scan
        const xmlResults = await NetworkScanner.scanNetwork(subnet);
        const parsedResults = await NetworkScanner.parseNmapResults(xmlResults);

        if (!parsedResults || parsedResults.length === 0) {
            console.log(`No hosts found for subnet: ${subnet}`);
            return res.json({
                success: true,
                message: 'Scan completed - no active hosts found',
                hostsScanned: 0,
                results: []
            });
        }

        // Save results to database
        const savedResults = await Promise.all(
            parsedResults.map(async result => {
                const scan = new NetworkScan(result);
                return scan.save();
            })
        );

        console.log(`Scan completed for ${subnet}: Found ${savedResults.length} hosts`);

        res.json({
            success: true,
            message: `Scan completed for ${subnet}`,
            hostsScanned: savedResults.length,
            results: savedResults
        });
    } catch (error) {
        console.error('Network scan error:', error);
        res.status(error.message.includes('Invalid subnet') ? 400 : 500).json({
            success: false,
            error: error.message
        });
    }
};

const getScanResults = async (req, res) => {
    try {
        const { ip, limit = 100, skip = 0 } = req.query;
        
        let query = {};
        if (ip) {
            query.ip = ip;
        }

        const results = await NetworkScan.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await NetworkScan.countDocuments(query);

        res.json({
            success: true,
            results,
            pagination: {
                total,
                limit: parseInt(limit),
                skip: parseInt(skip)
            }
        });
    } catch (error) {
        console.error('Error fetching scan results:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch scan results'
        });
    }
};

const getLatestScanForIp = async (req, res) => {
    try {
        const { ip } = req.params;
        
        const result = await NetworkScan.findOne({ ip })
            .sort({ timestamp: -1 });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'No scan results found for this IP'
            });
        }

        res.json({
            success: true,
            result
        });
    } catch (error) {
        console.error('Error fetching latest scan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch latest scan result'
        });
    }
};

module.exports = {
    performNetworkScan,
    getScanResults,
    getLatestScanForIp
};