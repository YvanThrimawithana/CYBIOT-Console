const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  ipAddress: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Online', 'Offline', 'Unknown', 'online', 'offline', 'unknown'],
    default: 'Unknown'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  deviceType: {
    type: String,
    trim: true
  },
  currentFirmware: {
    type: String,
    default: 'No firmware'
  },
  previousFirmware: {
    type: String,
    default: null
  },
  url: {
    type: String
  }
}, {
  timestamps: true
});

// Create an index on ipAddress for faster lookups
deviceSchema.index({ ipAddress: 1 });

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;