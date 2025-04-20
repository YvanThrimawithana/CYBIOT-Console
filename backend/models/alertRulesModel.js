const AlertRule = require('./mongoSchemas/alertRuleSchema');

// Get all alert rules
const getAllRules = async () => {
  try {
    const rules = await AlertRule.find({}).sort({ updatedAt: -1 });
    return { success: true, rules };
  } catch (error) {
    console.error("Error retrieving alert rules:", error);
    return { success: false, error: error.message };
  }
};

// Get rule by ID
const getRuleById = async (id) => {
  try {
    const rule = await AlertRule.findById(id);
    if (!rule) {
      return { success: false, error: "Rule not found" };
    }
    return { success: true, rule };
  } catch (error) {
    console.error(`Error retrieving rule ${id}:`, error);
    return { success: false, error: error.message };
  }
};

// Validate rule data
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

// Create new rule
const createRule = async (ruleData) => {
  try {
    const validation = validateRule(ruleData);
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }
    
    const newRule = new AlertRule(validation.rule);
    await newRule.save();
    
    // Process existing logs for this rule if enabled
    if (newRule.enabled) {
      setTimeout(async () => {
        try {
          const alertEngine = require("../utils/alertEngine");
          if (typeof alertEngine.processExistingLogs === 'function') {
            await alertEngine.processExistingLogs(newRule);
          }
        } catch (error) {
          console.error("Error processing existing logs:", error);
        }
      }, 500);
    }
    
    return {
      success: true,
      rule: newRule
    };
  } catch (error) {
    console.error("Error creating rule:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Update rule
const updateRule = async (id, ruleData) => {
  try {
    // Log the ID for debugging
    console.log(`Attempting to update rule with ID: ${id}`);
    
    // Guard against invalid IDs
    if (!id || id === 'undefined') {
      return {
        success: false,
        error: "Invalid rule ID provided"
      };
    }
    
    // Find rule first to check if it exists
    const existingRule = await AlertRule.findById(id);
    
    if (!existingRule) {
      return {
        success: false,
        error: "Rule not found"
      };
    }
    
    // Validate updated fields
    const validation = validateRule({
      ...existingRule.toObject(),
      ...ruleData
    });
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }
    
    // Store the old enabled state
    const wasEnabled = existingRule.enabled;
    const updatedRule = validation.rule;
    
    // Update the rule
    const rule = await AlertRule.findByIdAndUpdate(
      id,
      updatedRule,
      { new: true, runValidators: true }
    );
    
    // If the rule was disabled but now enabled, or if the condition changed while enabled,
    // process existing logs against this updated rule
    const isConditionChanged = rule.condition !== existingRule.condition;
    if (rule.enabled && (!wasEnabled || isConditionChanged)) {
      setTimeout(async () => {
        try {
          const alertEngine = require("../utils/alertEngine");
          if (typeof alertEngine.processExistingLogs === 'function') {
            await alertEngine.processExistingLogs(rule);
          }
        } catch (error) {
          console.error("Error processing existing logs:", error);
        }
      }, 500);
    }
    
    return {
      success: true,
      rule
    };
  } catch (error) {
    console.error(`Error updating rule ${id}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Delete rule
const deleteRule = async (id) => {
  try {
    // Log the ID to help with debugging
    console.log(`Attempting to delete rule with ID: ${id}`);
    
    if (!id || id === 'undefined') {
      return {
        success: false,
        error: "Invalid rule ID provided"
      };
    }
    
    const rule = await AlertRule.findByIdAndDelete(id);
    
    if (!rule) {
      return {
        success: false,
        error: "Rule not found"
      };
    }
    
    console.log(`Successfully deleted rule ${id}`);
    return {
      success: true
    };
  } catch (error) {
    console.error(`Error deleting rule ${id}:`, error);
    return {
      success: false,
      error: error.message
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