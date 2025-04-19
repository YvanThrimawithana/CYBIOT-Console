const { getAllRules, getRuleById } = require("../models/alertRulesModel");
const { createAlert } = require("../models/alertsModel");
const trafficModel = require("../models/trafficModel");

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

// Evaluate if a log entry matches a condition
const evaluateCondition = (log, condition) => {
    try {
        // Check for complex conditions with AND/OR operators
        if (condition.includes(" AND ")) {
            const conditions = condition.split(" AND ");
            return conditions.every(subCondition => evaluateSimpleCondition(log, subCondition.trim()));
        } else if (condition.includes(" OR ")) {
            const conditions = condition.split(" OR ");
            return conditions.some(subCondition => evaluateSimpleCondition(log, subCondition.trim()));
        } else {
            // Simple condition
            return evaluateSimpleCondition(log, condition);
        }
    } catch (error) {
        console.error("Error evaluating condition:", error);
        return false;
    }
};

// Evaluate a simple condition without AND/OR operators
const evaluateSimpleCondition = (log, condition) => {
    // Handle field searches with colon syntax (e.g., "source.srcIp:192.168.1.1")
    if (condition.includes(":")) {
        const [fieldPath, value] = condition.split(":");
        
        // Navigate through nested properties using the field path
        const parts = fieldPath.split('.');
        let currentValue = log;
        
        for (const part of parts) {
            if (!currentValue || typeof currentValue !== 'object') {
                return false;
            }
            currentValue = currentValue[part];
        }
        
        // Check if the field value contains the search value
        if (currentValue !== undefined && currentValue !== null) {
            const fieldValueStr = String(currentValue).toLowerCase();
            const searchValueStr = value.toLowerCase();
            return fieldValueStr.includes(searchValueStr);
        }
        
        return false;
    }
    
    // Legacy condition types support for backward compatibility
    // 1. Simple IP match
    if (condition.includes("ip:")) {
        const ipToMatch = condition.split("ip:")[1].trim();
        // Check source or destination IP
        const sourceIp = log.source?.srcIp || '';
        const destIp = log.source?.dstIp || '';
        const deviceIp = log.deviceIp || '';
        
        return sourceIp.includes(ipToMatch) || 
                destIp.includes(ipToMatch) || 
                deviceIp.includes(ipToMatch);
    }
    
    // 2. Protocol match
    if (condition.includes("protocol:")) {
        const protocolToMatch = condition.split("protocol:")[1].trim().toUpperCase();
        const protocol = (log.source?.protocol || '').toUpperCase();
        return protocol.includes(protocolToMatch);
    }
    
    // 3. Content match in info field
    if (condition.includes("content:")) {
        const contentToMatch = condition.split("content:")[1].trim().toLowerCase();
        const info = (log.source?.info || '').toLowerCase();
        return info.includes(contentToMatch);
    }
    
    // 4. Generic JSON match (check entire log)
    const logString = JSON.stringify(log).toLowerCase();
    return logString.includes(condition.toLowerCase());
};

// Process a log against a specific rule
const processLogAgainstRule = (rule, deviceIp, log) => {
    // Skip if rule is disabled
    if (!rule.enabled) return false;
    
    // Check if the log matches the rule condition
    const isMatch = evaluateCondition(log, rule.condition);
    
    if (isMatch) {
        console.log(`🚨 Rule "${rule.name}" matched for device ${deviceIp}`);
        
        // Cache the event for threshold detection
        const cacheKey = `${rule.id}-${deviceIp}`;
        
        if (!eventCache[cacheKey]) {
            eventCache[cacheKey] = {
                events: [],
                lastTrigger: 0
            };
        }
        
        // Clean up old events
        cleanupCache(rule.id, deviceIp, rule.timeWindow);
        
        // Add current event
        eventCache[cacheKey].events.push({
            timestamp: Date.now(),
            log: log
        });
        
        // Check if threshold is met
        if (eventCache[cacheKey].events.length >= rule.threshold) {
            // Check if we haven't triggered recently to avoid alert storms
            const now = Date.now();
            const minTriggerInterval = 60 * 1000; // 60 seconds minimum between alerts
            
            if ((now - eventCache[cacheKey].lastTrigger) > minTriggerInterval) {
                // Update last trigger time
                eventCache[cacheKey].lastTrigger = now;
                
                // Create alert
                const alertData = {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    description: rule.description,
                    deviceIp: deviceIp,
                    severity: rule.severity,
                    matchedLogs: eventCache[cacheKey].events.map(e => e.log)
                };
                
                const result = createAlert(alertData);
                
                if (result.success && !result.deduplicated) {
                    console.log(`✅ Alert created for rule "${rule.name}" on device ${deviceIp}`);
                    return true;
                } else if (result.deduplicated) {
                    console.log(`⚠️ Alert deduplicated for rule "${rule.name}" on device ${deviceIp}`);
                } else {
                    console.error(`❌ Failed to create alert for rule "${rule.name}": ${result.error}`);
                }
            } else {
                console.log(`⚠️ Suppressing alert for rule "${rule.name}" (triggered recently)`);
            }
        }
    }
    
    return false;
};

// Process a single traffic log against all rules
const processLog = (deviceIp, log) => {
    try {
        // Get all active rules
        const rules = getAllRules().filter(rule => rule.enabled);
        let alertsCreated = 0;
        
        // Process the log against each rule in parallel for better performance
        const results = rules.map(rule => processLogAgainstRule(rule, deviceIp, log));
        alertsCreated = results.filter(Boolean).length;
        
        return alertsCreated;
    } catch (error) {
        console.error("Error processing log against rules:", error);
        return 0;
    }
};

// Process existing logs against a specific rule
const processExistingLogs = async (rule) => {
    try {
        if (!rule.enabled) {
            console.log(`⚠️ Rule ${rule.name} is disabled, skipping processing of existing logs`);
            return 0;
        }
        
        console.log(`🔍 Processing existing logs against rule "${rule.name}"...`);
        
        // Get all traffic logs from the traffic model
        const trafficSummary = trafficModel.getTrafficSummary();
        let alertsCreated = 0;
        
        // Process logs for each device
        for (const [deviceIp, logs] of Object.entries(trafficSummary)) {
            if (!Array.isArray(logs) || logs.length === 0) continue;
            
            console.log(`📊 Processing ${logs.length} logs for device ${deviceIp}...`);
            
            // Process only logs from the last timeWindow seconds
            const now = Date.now();
            const timeWindowMs = (rule.timeWindow || 300) * 1000;
            const recentLogs = logs.filter(log => 
                (now - new Date(log.timestamp).getTime()) < timeWindowMs
            );
            
            console.log(`📊 Found ${recentLogs.length} recent logs within time window`);
            
            // For performance reasons, limit the number of logs to process
            const logsToProcess = recentLogs.slice(0, 1000); // Process up to 1000 logs per device
            
            // Process each log against this rule
            let matchCount = 0;
            logsToProcess.forEach(log => {
                if (processLogAgainstRule(rule, deviceIp, log)) {
                    alertsCreated++;
                    matchCount++;
                }
            });
            
            console.log(`✅ Processed ${logsToProcess.length} logs for device ${deviceIp}, found ${matchCount} matches`);
        }
        
        console.log(`✅ Finished processing existing logs against rule "${rule.name}", created ${alertsCreated} alerts`);
        return alertsCreated;
    } catch (error) {
        console.error(`Error processing existing logs against rule ${rule.name}:`, error);
        return 0;
    }
};

// Process all existing logs against all rules
const processAllExistingLogs = async () => {
    try {
        const rules = getAllRules().filter(rule => rule.enabled);
        console.log(`🔍 Processing existing logs against ${rules.length} rules...`);
        
        let totalAlerts = 0;
        
        for (const rule of rules) {
            const alertsCreated = await processExistingLogs(rule);
            totalAlerts += alertsCreated;
        }
        
        console.log(`✅ Finished processing all existing logs, created ${totalAlerts} alerts`);
        return totalAlerts;
    } catch (error) {
        console.error("Error processing all existing logs:", error);
        return 0;
    }
};

module.exports = { 
    processLog, 
    evaluateCondition,
    processExistingLogs,
    processAllExistingLogs
};