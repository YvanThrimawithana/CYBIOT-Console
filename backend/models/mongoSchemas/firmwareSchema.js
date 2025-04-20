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
  name: {
    type: String,
    required: true
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  fileName: String,
  fileSize: Number,
  hash: String,
  status: {
    type: String,
    enum: ['pending', 'analyzing', 'analyzed', 'error', 'DRAFT', 'TESTING', 'APPROVED', 'DEPLOYED', 'PENDING'],
    default: 'pending',
  },
  description: String,
  // Store analysis results directly in the document
  analysis: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  analysisDate: {
    type: Date,
    default: null
  },
  securityScore: {
    type: Number,
    min: 0,
    max: 10,
    default: null
  },
  changelog: String,
  isActive: {
    type: Boolean,
    default: false
  },
  uploadDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Firmware', firmwareSchema);