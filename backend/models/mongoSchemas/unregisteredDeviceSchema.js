const mongoose = require('mongoose');

const unregisteredDeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  ipAddress: {
    type: String,
    required: false
  },
  firmwareVersion: {
    type: String,
    required: false,
    default: 'unknown'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  metrics: {
    type: Object,
    required: false,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create an index on deviceId for faster lookups
unregisteredDeviceSchema.index({ deviceId: 1 });

const UnregisteredDevice = mongoose.model('UnregisteredDevice', unregisteredDeviceSchema);

module.exports = UnregisteredDevice;
