const mongoose = require('mongoose');

const trafficLogSchema = new mongoose.Schema({
  deviceIp: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  source: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  protocol: String,
  action: String,
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'INFO'],
    default: 'INFO'
  },
  eventType: String,
  info: String
}, {
  timestamps: true
});

// Create compound index for faster queries
trafficLogSchema.index({ deviceIp: 1, timestamp: -1 });

module.exports = mongoose.model('TrafficLog', trafficLogSchema);