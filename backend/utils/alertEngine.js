const AlertRule = require('../models/mongoSchemas/alertRuleSchema');
const TrafficLog = require('../models/mongoSchemas/trafficLogSchema');
const alertsModel = require('../models/alertsModel');

// Cache to store events for threshold detection
const eventCache = {
    // Structure:
    // {
    //   "ruleId-deviceIp": {
    //     events: [], // Array of events
    //     lastTrigger: timestamp // Last time rule triggered
    //   }
    // }
};

// Clean up events older than timeWindow
const cleanupCache = (ruleId, deviceIp, timeWindow) => {
    const cacheKey = `${ruleId}-${deviceIp}`;
    
    if (!eventCache[cacheKey]) return;
    
    const now = Date.now();
    const timeWindowMs = timeWindow * 1000; // Convert to milliseconds
    
    // Filter out events older than timeWindow
    eventCache[cacheKey].events = eventCache[cacheKey].events.filter(
        event => (now - event.timestamp) < timeWindowMs
    );
};

// Parse and evaluate rule condition
const evaluateCondition = (condition, log) => {
  try {
    // Handle AND conditions
    if (condition.toLowerCase().includes(' and ')) {
      const subConditions = condition.split(/\s+and\s+/i);
      return subConditions.every(subCond => evaluateCondition(subCond.trim(), log));
    }
    
    // Handle OR conditions
    if (condition.toLowerCase().includes(' or ')) {
      const subConditions = condition.split(/\s+or\s+/i);
      return subConditions.some(subCond => evaluateCondition(subCond.trim(), log));
    }
    
    // Handle field:value syntax (search-style)
    if (condition.includes(':')) {
      const [field, value] = condition.split(':').map(part => part.trim());
      const fieldPath = field.replace(/\./g, '.'); // Keep dot notation
      const cleanValue = value.replace(/^['"]|['"]$/g, '').toLowerCase(); // Remove quotes and convert to lowercase
      
      // Get the actual value from the log object
      const actualValue = getNestedValue(log, fieldPath);
      
      // If the field doesn't exist, no match
      if (actualValue === undefined) return false;
      
      // Convert to string and lowercase for case-insensitive comparison
      const actualValueStr = String(actualValue).toLowerCase();
      
      // Check if the value contains the search term
      return actualValueStr.includes(cleanValue);
    }
    
    // Fallback to the old-style equality checks
    if (condition.includes('==')) {
      const [field, value] = condition.split('==').map(part => part.trim());
      const cleanValue = value.replace(/^['"]|['"]$/g, ''); // Remove quotes
      return getNestedValue(log, field) == cleanValue;
    }
    
    if (condition.includes('!=')) {
      const [field, value] = condition.split('!=').map(part => part.trim());
      const cleanValue = value.replace(/^['"]|['"]$/g, ''); // Remove quotes
      return getNestedValue(log, field) != cleanValue;
    }
    
    if (condition.toLowerCase().includes('contains')) {
      const [field, value] = condition.split(/contains/i).map(part => part.trim());
      const cleanValue = value.replace(/^['"]|['"]$/g, ''); // Remove quotes
      const fieldValue = getNestedValue(log, field);
      return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(cleanValue.toLowerCase());
    }
    
    // For empty/invalid conditions, don't match
    return false;
  } catch (error) {
    console.error(`Error evaluating condition "${condition}":`, error);
    return false;
  }
};

// Get nested value from object
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, part) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[part]; 
  }, obj);
};

// Process a single log against all active rules
const processLog = async (log) => {
    try {
        // Get all active rules
        const result = await AlertRule.find({ enabled: true });
        const rules = result || [];
        
        console.log(`Processing log against ${rules.length} active rules`);
        
        if (!log.deviceIp && log.source && log.source.srcIp) {
            log.deviceIp = log.source.srcIp;
        }
        
        if (!log.timestamp) {
            log.timestamp = new Date();
        }
        
        const triggeredAlerts = [];
        
        // Check each rule
        for (const rule of rules) {
            const isMatch = evaluateCondition(rule.condition, log);
            console.log(`Rule ${rule.name} match: ${isMatch}`);
            
            if (isMatch) {
                // Add to event cache for this rule and device
                const cacheKey = `${rule._id}-${log.deviceIp}`;
                
                if (!eventCache[cacheKey]) {
                    eventCache[cacheKey] = {
                        events: [],
                        lastTrigger: null
                    };
                }
                
                // Add this event to the cache
                eventCache[cacheKey].events.push({
                    timestamp: Date.now(),
                    log
                });
                
                // Check if threshold is exceeded
                const timeWindowMs = rule.timeWindow * 1000;
                const now = Date.now();
                
                // Clean up old events first
                cleanupCache(rule._id, log.deviceIp, rule.timeWindow);
                
                const eventCount = eventCache[cacheKey].events.length;
                const lastTrigger = eventCache[cacheKey].lastTrigger;
                
                // Only trigger if threshold exceeded and not triggered recently
                if (eventCount >= rule.threshold && 
                    (!lastTrigger || (now - lastTrigger) > timeWindowMs)) {
                    
                    console.log(`🚨 Rule "${rule.name}" triggered! ${eventCount} events in ${rule.timeWindow}s`);
                    
                    // Create alert
                    const alert = await alertsModel.createAlert({
                        ruleId: rule._id,
                        ruleName: rule.name,
                        description: rule.description || `Multiple matching events for rule: ${rule.name}`,
                        severity: rule.severity,
                        deviceIp: log.deviceIp,
                        timestamp: new Date(),
                        matchCount: eventCount,
                        matchedLogs: eventCache[cacheKey].events.map(e => e.log)
                    });
                    
                    // Update the last trigger time
                    eventCache[cacheKey].lastTrigger = now;
                    
                    // Add to triggered alerts for this run
                    if (alert) {
                        triggeredAlerts.push(alert);
                    }
                }
            }
        }
        
        return triggeredAlerts;
    } catch (error) {
        console.error("Error processing log against rules:", error);
        return [];
    }
};

// Process a batch of logs
const processBatch = async (logs) => {
  const triggeredAlerts = [];
  
  for (const log of logs) {
    const alerts = await processLog(log);
    triggeredAlerts.push(...alerts);
  }
  
  return triggeredAlerts;
};

// Process existing logs for a newly added/enabled rule
const processExistingLogs = async (rule) => {
  try {
    // Skip if rule is disabled
    if (!rule.enabled) {
      return [];
    }
    
    // Get logs from the past time window
    const timeWindow = rule.timeWindow || 300; // Default to 5 minutes
    const cutoffTime = new Date();
    cutoffTime.setSeconds(cutoffTime.getSeconds() - timeWindow);
    
    const logs = await TrafficLog.find({ 
      timestamp: { $gt: cutoffTime } 
    }).limit(1000);
    
    if (!logs || logs.length === 0) {
      return [];
    }
    
    console.log(`Checking ${logs.length} existing logs against new rule "${rule.name}"`);
    
    const matchedLogs = logs.filter(log => evaluateCondition(rule.condition, log));
    
    // If we have enough matches to trigger an alert (based on threshold)
    if (matchedLogs.length >= rule.threshold) {
      // Group logs by device
      const deviceLogs = {};
      
      matchedLogs.forEach(log => {
        if (!deviceLogs[log.deviceIp]) {
          deviceLogs[log.deviceIp] = [];
        }
        deviceLogs[log.deviceIp].push(log);
      });
      
      // Create alert for each device that has enough matches
      const triggeredAlerts = [];
      
      for (const [deviceIp, logs] of Object.entries(deviceLogs)) {
        if (logs.length >= rule.threshold) {
          const alertData = {
            ruleId: rule._id,
            ruleName: rule.name,
            deviceIp,
            severity: rule.severity,
            description: rule.description || `Alert triggered by rule: ${rule.name}`,
            matchedLogs: logs.slice(0, 50) // Limit to 50 logs
          };
          
          const result = await alertsModel.createAlert(alertData);
          
          if (result.success) {
            triggeredAlerts.push(result.alert);
          }
        }
      }
      
      return triggeredAlerts;
    }
    
    return [];
  } catch (error) {
    console.error(`Error processing existing logs for rule "${rule.name}":`, error);
    return [];
  }
};

module.exports = {
  processLog,
  processBatch,
  processExistingLogs,
  evaluateCondition
};