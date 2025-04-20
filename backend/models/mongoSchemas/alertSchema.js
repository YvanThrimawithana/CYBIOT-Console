const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  ruleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AlertRule',
    required: true
  },
  ruleName: {
    type: String,
    required: true
  },
  description: String,
  deviceIp: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  status: {
    type: String,
    enum: ['NEW', 'ACKNOWLEDGED', 'RESOLVED'],
    default: 'NEW'
  },
  matchCount: {
    type: Number,
    default: 1
  },
  matchedLogs: [{
    type: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Alert', alertSchema);