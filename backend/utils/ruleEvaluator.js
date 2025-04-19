const { getAllRules } = require("../models/alertRulesModel");
const { createAlert } = require("../models/alertsModel");
const { evaluateCondition } = require("./alertEngine");

// Function to evaluate all existing logs against current rules
const evaluateLogs = (logs, deviceIp) => {
    // Get all active rules
    const rules = getAllRules().filter(rule => rule.enabled);
    const matchedRules = [];
    
    // Keep track of which logs match which rules for threshold checking
    const ruleMatches = {};
    
    // Process each log against each rule
    logs.forEach(log => {
        rules.forEach(rule => {
            // Skip if rule is disabled
            if (!rule.enabled) return;
            
            // Check if the log matches the rule condition
            const isMatch = evaluateCondition(log, rule.condition);
            
            if (isMatch) {
                // Initialize array for this rule if it doesn't exist
                if (!ruleMatches[rule.id]) {
                    ruleMatches[rule.id] = [];
                }
                
                // Add log to the matched logs for this rule
                ruleMatches[rule.id].push(log);
            }
        });
    });
    
    // Check thresholds for matched rules
    Object.entries(ruleMatches).forEach(([ruleId, matchedLogs]) => {
        const rule = rules.find(r => r.id === ruleId);
        
        if (rule && matchedLogs.length >= rule.threshold) {
            // Create alert for this rule
            const alertData = {
                ruleId: rule.id,
                ruleName: rule.name,
                description: rule.description,
                deviceIp: deviceIp,
                severity: rule.severity,
                matchedLogs: matchedLogs.slice(0, 10) // Limit to 10 logs to avoid huge alerts
            };
            
            const result = createAlert(alertData);
            
            if (result.success) {
                console.log(`✅ Alert created for rule "${rule.name}" on device ${deviceIp}`);
                matchedRules.push({
                    rule,
                    matchCount: matchedLogs.length,
                    alert: result.alert
                });
            }
        }
    });
    
    return matchedRules;
};

module.exports = { evaluateLogs };