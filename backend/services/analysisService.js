const axios = require('axios');
const FormData = require('form-data');
const config = require('../config/config');
const fs = require('fs').promises;
const path = require('path');

class AnalysisService {
    static async sendFirmwareForAnalysis(firmwareBuffer, filename) {
        if (!config.analysis.serverUrl) {
            throw new Error('Analysis server URL not configured');
        }

        try {
            console.log(`Sending firmware to analysis server: ${config.analysis.serverUrl}`);

            const formData = new FormData();
            formData.append('firmware', firmwareBuffer, { filename });

            const response = await axios.post(config.analysis.serverUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'X-API-Key': config.analysis.apiKey,
                    'Accept': 'application/json'
                },
                timeout: config.analysis.timeout
            });

            // Generate result filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '');
            const resultFilename = `${filename.replace('.bin', '')}_${timestamp}_results.json`;
            const resultsDir = path.join(__dirname, '../data/analysis_results');
            await fs.mkdir(resultsDir, { recursive: true });
            const resultPath = path.join(resultsDir, resultFilename);

            // Handle both JSON and text responses
            let resultContent;
            if (typeof response.data === 'string') {
                resultContent = JSON.stringify({
                    static: {
                        analysis_message: [{
                            message: response.data,
                            severity: 'INFO'
                        }]
                    },
                    dynamic: {
                        open_ports: [],
                        fuzzing_results: [],
                        timeline: []
                    }
                });
            } else {
                resultContent = JSON.stringify(response.data);
            }

            // Save results
            await fs.writeFile(resultPath, resultContent);
            console.log(`Analysis complete! Results saved to: ${resultPath}`);
            
            return { resultPath, resultFilename };
        } catch (error) {
            console.error('Analysis service error:', error);
            throw new Error(`Analysis service error: ${error.message}`);
        }
    }
}

module.exports = AnalysisService;
