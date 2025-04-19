const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
// Remove the direct import to avoid circular dependency
// Instead, we'll use a deferred execution approach

// Define the paths
const dataDir = path.join(__dirname, "../data");
const rulesPath = path.join(dataDir, "alertRules.json");

// Ensure the data directory exists
const ensureDataDirectory = () => {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
};

// Initialize the rules file if it doesn't exist
const initializeRulesFile = () => {
    if (!fs.existsSync(rulesPath)) {
        // Create a sample rule for detecting traffic from a specific IP
        const sampleRules = [
            {
                id: uuidv4(),
                name: "Suspicious IP Detection",
                description: "Detects traffic from suspicious IP address",
                condition: "ip:192.168.1.3",
                severity: "HIGH",
                enabled: true,
                threshold: 1,
                timeWindow: 300 // 5 minutes in seconds
            },
            {
                id: uuidv4(),
                name: "SSH Brute Force Attempt",
                description: "Detects potential SSH brute force attacks",
                condition: "content:ssh",
                severity: "HIGH",
                enabled: true,
                threshold: 5,
                timeWindow: 300
            }
        ];
        
        fs.writeFileSync(rulesPath, JSON.stringify(sampleRules, null, 2), "utf8");
    }
};

// Read rules safely with error handling
const readRules = () => {
    try {
        ensureDataDirectory();
        initializeRulesFile();
        const data = fs.readFileSync(rulesPath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading alert rules:", error);
        return [];
    }
};

// Write rules safely with error handling
const writeRules = (rules) => {
    try {
        ensureDataDirectory();
        fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("Error writing alert rules:", error);
        return false;
    }
};

const getAllRules = () => {
    return readRules();
};

const getRuleById = (id) => {
    const rules = readRules();
    return rules.find(rule => rule.id === id);
};

const validateRule = (rule) => {
    // Required fields
    if (!rule.name || typeof rule.name !== 'string') {
        return { valid: false, error: "Rule name is required and must be a string" };
    }
    
    if (!rule.condition || typeof rule.condition !== 'string') {
        return { valid: false, error: "Rule condition is required and must be a string" };
    }
    
    // Optional fields with defaults
    const validated = {
        ...rule,
        description: rule.description || "",
        severity: rule.severity || "MEDIUM",
        enabled: rule.enabled !== undefined ? rule.enabled : true,
        threshold: rule.threshold || 1,
        timeWindow: rule.timeWindow || 300
    };
    
    return { valid: true, rule: validated };
};

const createRule = (ruleData) => {
    try {
        const validation = validateRule(ruleData);
        
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error
            };
        }
        
        const rules = readRules();
        
        const newRule = {
            id: uuidv4(),
            ...validation.rule,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        rules.push(newRule);
        
        if (writeRules(rules)) {
            // Immediately process existing logs against this new rule
            // This allows the rule to take effect without server restart
            if (newRule.enabled) {
                console.log(`✅ Processing existing logs against new rule: ${newRule.name}`);
                setTimeout(() => {
                    try {
                        // Import the module dynamically to avoid circular dependency
                        const alertEngine = require("../utils/alertEngine");
                        if (typeof alertEngine.processExistingLogs === 'function') {
                            alertEngine.processExistingLogs(newRule);
                        } else {
                            console.error("processExistingLogs is not a function");
                        }
                    } catch (error) {
                        console.error("Error processing existing logs:", error);
                    }
                }, 500); // Small delay to ensure rule is saved before processing
            }
            
            return {
                success: true,
                rule: newRule
            };
        } else {
            return {
                success: false,
                error: "Failed to save rule"
            };
        }
    } catch (error) {
        console.error("Error creating rule:", error);
        return {
            success: false,
            error: "Server error"
        };
    }
};

const updateRule = (id, ruleData) => {
    try {
        const rules = readRules();
        const ruleIndex = rules.findIndex(rule => rule.id === id);
        
        if (ruleIndex === -1) {
            return {
                success: false,
                error: "Rule not found"
            };
        }
        
        // Validate updated fields
        const validation = validateRule({
            ...rules[ruleIndex],
            ...ruleData
        });
        
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error
            };
        }
        
        // Store the old enabled state
        const wasEnabled = rules[ruleIndex].enabled;
        
        // Update the rule
        rules[ruleIndex] = {
            ...rules[ruleIndex],
            ...validation.rule,
            id: id, // Ensure ID doesn't change
            updatedAt: new Date().toISOString()
        };
        
        // Save rules
        if (writeRules(rules)) {
            // If the rule was disabled but now enabled, or if the condition changed while enabled,
            // process existing logs against this updated rule
            const isConditionChanged = rules[ruleIndex].condition !== ruleData.condition;
            if (rules[ruleIndex].enabled && (!wasEnabled || isConditionChanged)) {
                console.log(`✅ Processing existing logs against updated rule: ${rules[ruleIndex].name}`);
                setTimeout(() => {
                    try {
                        // Import the module dynamically to avoid circular dependency
                        const alertEngine = require("../utils/alertEngine");
                        if (typeof alertEngine.processExistingLogs === 'function') {
                            alertEngine.processExistingLogs(rules[ruleIndex]);
                        } else {
                            console.error("processExistingLogs is not a function");
                        }
                    } catch (error) {
                        console.error("Error processing existing logs:", error);
                    }
                }, 500); // Small delay to ensure rule is saved before processing
            }
            
            return {
                success: true,
                rule: rules[ruleIndex]
            };
        } else {
            return {
                success: false,
                error: "Failed to update rule"
            };
        }
    } catch (error) {
        console.error("Error updating rule:", error);
        return {
            success: false,
            error: "Server error"
        };
    }
};

const deleteRule = (id) => {
    try {
        const rules = readRules();
        const newRules = rules.filter(rule => rule.id !== id);
        
        if (newRules.length === rules.length) {
            return {
                success: false,
                error: "Rule not found"
            };
        }
        
        // Save rules
        if (writeRules(newRules)) {
            return {
                success: true
            };
        } else {
            return {
                success: false,
                error: "Failed to delete rule"
            };
        }
    } catch (error) {
        console.error("Error deleting rule:", error);
        return {
            success: false,
            error: "Server error"
        };
    }
};

module.exports = {
    getAllRules,
    getRuleById,
    createRule,
    updateRule,
    deleteRule
};