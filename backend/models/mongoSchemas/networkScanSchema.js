const mongoose = require('mongoose');

const portSchema = new mongoose.Schema({
    portId: String,
    protocol: String,
    state: String,
    service: String
});

const networkScanSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    status: String,
    ports: [portSchema],
    osMatch: String,
    vulnerabilities: [{
        type: String,
        severity: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        },
        description: String
    }]
});

// Add TTL index to automatically remove old scans after 30 days
networkScanSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('NetworkScan', networkScanSchema);