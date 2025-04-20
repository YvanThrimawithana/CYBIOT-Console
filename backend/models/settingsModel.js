const PlatformSettings = require('./mongoSchemas/platformSettingsSchema');

// Default settings to use if no settings exist
const defaultSettings = {
  settingsId: 'global',
  notifications: {
    enabled: false,
    email: {
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPass: '',
      smtpSecure: false,
      fromEmail: 'noreply@cybiot.local'
    },
    alertSettings: {
      notifyHighSeverity: true,
      notifyMediumSeverity: false,
      notifyLowSeverity: false
    },
    digestEnabled: false,
    digestFrequency: 'daily',
    recipients: []
  },
  retention: {
    trafficLogsRetentionDays: 30,
    alertsRetentionDays: 90
  }
};

// Get the global platform settings
const getSettings = async () => {
  try {
    // Try to get existing settings
    let settings = await PlatformSettings.findOne({ settingsId: 'global' });
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = new PlatformSettings(defaultSettings);
      await settings.save();
    }
    
    return { success: true, settings };
  } catch (error) {
    console.error('Error retrieving platform settings:', error);
    return { success: false, error: error.message };
  }
};

// Update platform settings
const updateSettings = async (settingsData) => {
  try {
    const settings = await PlatformSettings.findOneAndUpdate(
      { settingsId: 'global' },
      { $set: settingsData },
      { new: true, upsert: true, runValidators: true }
    );
    
    return { success: true, settings };
  } catch (error) {
    console.error('Error updating platform settings:', error);
    return { success: false, error: error.message };
  }
};

// Update email configuration
const updateEmailSettings = async (emailSettings) => {
  try {
    const settings = await PlatformSettings.findOneAndUpdate(
      { settingsId: 'global' },
      { $set: { 'notifications.email': emailSettings } },
      { new: true, runValidators: true }
    );
    
    if (!settings) {
      return {
        success: false,
        error: 'Settings not found'
      };
    }
    
    return { success: true, settings };
  } catch (error) {
    console.error('Error updating email settings:', error);
    return { success: false, error: error.message };
  }
};

// Update notification settings
const updateNotificationSettings = async (notificationSettings) => {
  try {
    const settings = await PlatformSettings.findOneAndUpdate(
      { settingsId: 'global' },
      { $set: { 'notifications': notificationSettings } },
      { new: true, runValidators: true }
    );
    
    if (!settings) {
      return {
        success: false,
        error: 'Settings not found'
      };
    }
    
    return { success: true, settings };
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return { success: false, error: error.message };
  }
};

// Reset settings to default
const resetSettings = async () => {
  try {
    const settings = await PlatformSettings.findOneAndUpdate(
      { settingsId: 'global' },
      defaultSettings,
      { new: true, upsert: true }
    );
    
    return { success: true, settings };
  } catch (error) {
    console.error('Error resetting platform settings:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  getSettings,
  updateSettings,
  updateEmailSettings,
  updateNotificationSettings,
  resetSettings
};