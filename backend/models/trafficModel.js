const TrafficLog = require('./mongoSchemas/trafficLogSchema');

// Add a new traffic log
const addLog = async (deviceIp, logData) => {
  try {
    const newLog = new TrafficLog({
      deviceIp,
      ...logData,
      timestamp: logData.timestamp || new Date()
    });
    
    await newLog.save();
    return { success: true, log: newLog };
  } catch (error) {
    console.error("Error adding traffic log:", error);
    return { success: false, error: error.message };
  }
};

// Get logs for a specific device
const getDeviceLogs = async (deviceIp, since = null) => {
  try {
    let query = { deviceIp };
    
    if (since) {
      const sinceDate = new Date(since);
      query.timestamp = { $gt: sinceDate };
    }
    
    const logs = await TrafficLog.find(query)
      .sort({ timestamp: -1 })
      .limit(1000); // Limit to prevent excessive data transfer
      
    return { success: true, logs };
  } catch (error) {
    console.error(`Error getting logs for device ${deviceIp}:`, error);
    return { success: false, error: error.message };
  }
};

// Get all traffic logs with optional filtering by time
const getAllLogs = async (since = null, limit = 1000) => {
  try {
    let query = {};
    
    if (since) {
      const sinceDate = new Date(since);
      query.timestamp = { $gt: sinceDate };
    }
    
    const logs = await TrafficLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);
      
    return { success: true, logs };
  } catch (error) {
    console.error("Error getting all logs:", error);
    return { success: false, error: error.message };
  }
};

// Delete logs older than retention period
const cleanupOldLogs = async (retentionDays = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await TrafficLog.deleteMany({ timestamp: { $lt: cutoffDate } });
    
    return { 
      success: true, 
      message: `Deleted ${result.deletedCount} logs older than ${retentionDays} days` 
    };
  } catch (error) {
    console.error("Error cleaning up old logs:", error);
    return { success: false, error: error.message };
  }
};

// Get a summary of traffic logs for processing by the alert engine
const getTrafficSummary = async (timeWindow = 300) => {
  try {
    // Calculate the cutoff time based on the maximum time window
    const cutoffTime = new Date();
    cutoffTime.setSeconds(cutoffTime.getSeconds() - timeWindow);
    
    // Get logs within the time window
    const logs = await TrafficLog.find({ 
      timestamp: { $gt: cutoffTime } 
    });
    
    // Group by deviceIp
    const deviceLogs = {};
    
    logs.forEach(log => {
      if (!deviceLogs[log.deviceIp]) {
        deviceLogs[log.deviceIp] = [];
      }
      deviceLogs[log.deviceIp].push(log);
    });
    
    return deviceLogs;
  } catch (error) {
    console.error("Error getting traffic summary:", error);
    return {};
  }
};

// Search logs with complex query
const searchLogs = async (searchQuery, limit = 1000) => {
  try {
    // Parse search query to build MongoDB query
    let query = {};
    
    // Simple implementation - extend this for more complex queries
    if (searchQuery) {
      if (searchQuery.includes('ip:')) {
        const ip = searchQuery.split('ip:')[1].trim().split(' ')[0];
        query.deviceIp = { $regex: ip, $options: 'i' };
      }
      
      if (searchQuery.includes('severity:')) {
        const severity = searchQuery.split('severity:')[1].trim().split(' ')[0].toUpperCase();
        query.severity = severity;
      }
      
      if (searchQuery.includes('protocol:')) {
        const protocol = searchQuery.split('protocol:')[1].trim().split(' ')[0].toUpperCase();
        query.protocol = { $regex: protocol, $options: 'i' };
      }
      
      if (searchQuery.includes('content:')) {
        const content = searchQuery.split('content:')[1].trim().split(' ')[0];
        query.$or = [
          { 'source.info': { $regex: content, $options: 'i' } },
          { info: { $regex: content, $options: 'i' } }
        ];
      }
    }
    
    const logs = await TrafficLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);
      
    return { 
      success: true, 
      logs,
      query: JSON.stringify(query)
    };
  } catch (error) {
    console.error("Error searching logs:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  addLog,
  getDeviceLogs,
  getAllLogs,
  cleanupOldLogs,
  getTrafficSummary,
  searchLogs
};