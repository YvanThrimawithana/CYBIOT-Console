const mongoose = require('mongoose');

const alertRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  condition: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  enabled: {
    type: Boolean,
    default: true
  },
  threshold: {
    type: Number,
    default: 1,
    min: 1
  },
  timeWindow: {
    type: Number,
    default: 300,
    min: 1
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AlertRule', alertRuleSchema);