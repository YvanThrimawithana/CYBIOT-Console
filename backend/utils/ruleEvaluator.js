const { getAllRules } = require('../models/alertRulesModel');
const { createAlert } = require('../models/alertsModel');

// Evaluate if a log entry matches a rule condition
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

// Evaluate a set of logs against all rules
const evaluateLogs = (logs, deviceIp) => {
    const allRules = getAllRules().filter(rule => rule.enabled);
    const generatedAlerts = [];
    
    // Track rule matches to handle thresholds
    const ruleMatches = {};
    
    // First pass: count matches for each rule
    for (const log of logs) {
        for (const rule of allRules) {
            const isMatch = evaluateCondition(log, rule.condition);
            
            if (isMatch) {
                if (!ruleMatches[rule.id]) {
                    ruleMatches[rule.id] = {
                        rule,
                        count: 0,
                        logs: []
                    };
                }
                
                ruleMatches[rule.id].count++;
                ruleMatches[rule.id].logs.push(log);
            }
        }
    }
    
    // Second pass: generate alerts for rules that meet the threshold
    for (const ruleId in ruleMatches) {
        const { rule, count, logs } = ruleMatches[ruleId];
        
        // If match count is at least the threshold, generate an alert
        if (count >= rule.threshold) {
            const alertData = {
                ruleId: rule.id,
                ruleName: rule.name,
                description: rule.description,
                deviceIp,
                severity: rule.severity,
                matchedLogs: logs.slice(0, 10) // Limit to prevent huge payloads
            };
            
            const result = createAlert(alertData);
            
            if (result.success && !result.deduplicated) {
                console.log(`✅ Alert created for rule "${rule.name}" on device ${deviceIp}`);
                generatedAlerts.push(result.alert);
            }
        }
    }
    
    return generatedAlerts;
};

module.exports = {
    evaluateCondition,
    evaluateLogs
};