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
    required: false,
    default: function() {
      return `Device-${this.deviceId.substring(0, 8)}`;
    }
  },
  deviceType: {
    type: String,
    required: false,
    default: 'raspberrypi'
  },
  ipAddress: {
    type: String,
    required: false
  },
  // Alias for backward compatibility
  ip: {
    type: String,
    get: function() { return this.ipAddress; }
  },
  status: {
    type: String,
    required: false,
    default: 'offline',
    set: function(val) {
      // Normalize status to lowercase
      return val ? val.toLowerCase() : 'unknown';
    }
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  firmware: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firmware',
    required: false
  },
  firmwareVersion: {
    type: String,
    required: false,
    default: 'unknown'
  },
  updateScheduled: {
    type: Boolean,
    default: false
  },
  scheduledUpdateTime: {
    type: Date,
    required: false
  },
  scheduledFirmwareId: {
    type: String,
    required: false
  },
  metrics: {
    type: Object,
    required: false,
    default: {}
  },
  managementUser: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
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