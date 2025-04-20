const axios = require('axios');
const FormData = require('form-data');
const config = require('../config/config');
const fs = require('fs').promises;
const path = require('path');
const firmwareModel = require('../models/firmwareModel');

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

            // Generate result filename for logging purposes
            const timestamp = new Date().toISOString().replace(/[:.]/g, '');
            const resultFilename = `${filename.replace('.bin', '')}_${timestamp}_results.json`;
            
            // Parse the analysis results
            let parsedResults;
            if (typeof response.data === 'string') {
                try {
                    parsedResults = JSON.parse(response.data);
                } catch (parseError) {
                    console.warn('Invalid JSON from analyzer, creating default structure');
                    parsedResults = {
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
                    };
                }
            } else {
                parsedResults = response.data;
            }

            // Extract firmware ID from the filename (assumes format: "id_name.bin")
            const firmwareId = filename.split('_')[0];
            if (firmwareId) {
                // Save to MongoDB directly
                console.log(`Saving analysis results for firmware ${firmwareId} to MongoDB`);
                await firmwareModel.saveAnalysisResult(firmwareId, parsedResults);
                console.log(`Analysis results saved to MongoDB for firmware ${firmwareId}`);
            } else {
                console.error('Failed to extract firmware ID from filename:', filename);
            }
            
            // For backward compatibility, still save results to file system
            const resultsDir = path.join(__dirname, '../data/analysis_results');
            await fs.mkdir(resultsDir, { recursive: true });
            const resultPath = path.join(resultsDir, resultFilename);
            await fs.writeFile(resultPath, JSON.stringify(parsedResults, null, 2));
            console.log(`Analysis also saved to file: ${resultPath} for backup purpose`);
            
            return { resultPath, resultFilename, results: parsedResults };
        } catch (error) {
            console.error('Analysis service error:', error);
            throw new Error(`Analysis service error: ${error.message}`);
        }
    }
}

module.exports = AnalysisService;
