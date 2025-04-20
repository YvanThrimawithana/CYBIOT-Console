const mongoose = require('mongoose');

const firmwareSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true
  },
  deviceType: {
    type: String,
    required: true
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  fileName: String,
  filePath: String,
  fileSize: Number,
  hash: String,
  status: {
    type: String,
    enum: ['DRAFT', 'TESTING', 'APPROVED', 'DEPLOYED', 'pending', 'PENDING'],
    default: 'DRAFT',
    // Normalize status to uppercase for consistency
    set: function(status) {
      if (!status) return 'DRAFT';
      if (status.toLowerCase() === 'pending') return 'PENDING';
      return status.toUpperCase();
    }
  },
  securityAnalysis: {
    vulnerabilities: [{
      type: String
    }],
    securityScore: Number,
    analysisDate: Date
  },
  changelog: String,
  isActive: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Firmware', firmwareSchema);