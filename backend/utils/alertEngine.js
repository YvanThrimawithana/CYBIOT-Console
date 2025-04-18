const { getAllRules, getRuleById } = require("../models/alertRulesModel");
const { createAlert } = require("../models/alertsModel");

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
        // Handle different condition types
        
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
        
    } catch (error) {
        console.error("Error evaluating condition:", error);
        return false;
    }
};

// Process a single traffic log against all rules
const processLog = (deviceIp, log) => {
    try {
        // Get all active rules
        const rules = getAllRules().filter(rule => rule.enabled);
        
        rules.forEach(rule => {
            // Skip if rule is disabled
            if (!rule.enabled) return;
            
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
        });
    } catch (error) {
        console.error("Error processing log against rules:", error);
    }
};

module.exports = { processLog };