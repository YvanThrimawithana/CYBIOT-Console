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

            // Create form data
            const formData = new FormData();
            formData.append('firmware', firmwareBuffer, { filename });

            const response = await axios.post(`${config.analysis.serverUrl}`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'X-API-Key': config.analysis.apiKey
                },
                responseType: 'stream',
                timeout: config.analysis.timeout,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.status === 200) {
                // Get filename from response headers or use default
                const contentDisp = response.headers['content-disposition'];
                let resultFilename = 'analysis_results.json';
                if (contentDisp && contentDisp.includes('filename=')) {
                    resultFilename = contentDisp.split('filename=')[1].replace(/"/g, '');
                }

                // Create results directory if it doesn't exist
                const resultsDir = path.join(__dirname, '../data/analysis_results');
                await fs.mkdir(resultsDir, { recursive: true });

                // Save response stream to file
                const resultPath = path.join(resultsDir, resultFilename);
                const writer = await fs.open(resultPath, 'w');
                
                return new Promise((resolve, reject) => {
                    response.data.pipe(writer.createWriteStream());
                    response.data.on('end', () => {
                        console.log(`Analysis complete! Results saved to: ${resultPath}`);
                        resolve({ resultPath, resultFilename });
                    });
                    response.data.on('error', reject);
                });
            } else {
                throw new Error(`Server returned status code ${response.status}`);
            }
        } catch (error) {
            console.error('Analysis failed:', error);
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }
}

module.exports = AnalysisService;
