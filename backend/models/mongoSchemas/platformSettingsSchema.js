const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  settingsId: {
    type: String,
    default: 'global',
    unique: true
  },
  notifications: {
    enabled: {
      type: Boolean,
      default: false
    },
    email: {
      smtpHost: String,
      smtpPort: Number,
      smtpUser: String,
      smtpPass: String,
      smtpSecure: Boolean,
      fromEmail: String
    },
    alertSettings: {
      notifyHighSeverity: {
        type: Boolean,
        default: true
      },
      notifyMediumSeverity: {
        type: Boolean,
        default: false
      },
      notifyLowSeverity: {
        type: Boolean,
        default: false
      }
    },
    digestEnabled: {
      type: Boolean,
      default: false
    },
    digestFrequency: {
      type: String,
      enum: ['daily', 'weekly'],
      default: 'daily'
    },
    recipients: [String]
  },
  retention: {
    trafficLogsRetentionDays: {
      type: Number,
      default: 30
    },
    alertsRetentionDays: {
      type: Number,
      default: 90
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);