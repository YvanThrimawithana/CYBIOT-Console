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
  // Alias for backward compatibility
  ip: {
    type: String,
    get: function() { return this.ipAddress; }
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'unknown'],
    default: 'offline',
    set: function(val) {
      // Normalize status to lowercase
      return val ? val.toLowerCase() : 'unknown';
    }
  },
  lastSeen: {
    type: Date,
    default: null
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

// Virtual property to check if device is online
deviceSchema.virtual('isOnline').get(function() {
  return this.status.toLowerCase() === 'online';
});

// Convert ipAddress to ip for backwards compatibility
deviceSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.ip = ret.ipAddress;
    return ret;
  }
});

// Create an index on ipAddress for faster lookups
deviceSchema.index({ ipAddress: 1 });

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;