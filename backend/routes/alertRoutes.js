const express = require("express");
const { 
    getAllRules, 
    getRuleById, 
    createRule, 
    updateRule, 
    deleteRule 
} = require("../models/alertRulesModel");
const {
    getAlerts,
    getAlertById,
    updateAlertStatus,
    getAlertStats,
    getAlertsByDevice,
    generateCSVReport
} = require("../models/alertsModel");

const router = express.Router();

// Rule management routes
router.get("/rules", (req, res) => {
    const rules = getAllRules();
    res.json({ success: true, rules });
});

router.post("/rules", (req, res) => {
    const result = createRule(req.body);
    
    if (result.success) {
        res.status(201).json(result);
    } else {
        res.status(400).json(result);
    }
});

router.get("/rules/:id", (req, res) => {
    const rule = getRuleById(req.params.id);
    
    if (rule) {
        res.json({ success: true, rule });
    } else {
        res.status(404).json({ success: false, error: "Rule not found" });
    }
});

router.put("/rules/:id", (req, res) => {
    const result = updateRule(req.params.id, req.body);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(404).json(result);
    }
});

router.delete("/rules/:id", (req, res) => {
    const result = deleteRule(req.params.id);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(404).json(result);
    }
});

// Alert management routes
router.get("/alerts", (req, res) => {
    const filters = {
        status: req.query.status,
        severity: req.query.severity,
        deviceIp: req.query.deviceIp,
        since: req.query.since
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => 
        filters[key] === undefined && delete filters[key]
    );
    
    const alertResult = getAlerts(filters);
    const statResult = getAlertStats();
    const deviceResult = getAlertsByDevice();
    
    if (alertResult.success && statResult.success && deviceResult.success) {
        res.json({
            success: true,
            alerts: alertResult.alerts,
            summary: statResult.stats,
            deviceAlerts: deviceResult.deviceAlerts
        });
    } else {
        res.status(500).json({ 
            success: false, 
            error: "Failed to retrieve alerts" 
        });
    }
});

router.get("/alerts/:id", (req, res) => {
    const result = getAlertById(req.params.id);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(404).json(result);
    }
});

router.patch("/alerts/:id/status", (req, res) => {
    const { status } = req.body;
    
    if (!status || !["NEW", "ACKNOWLEDGED", "RESOLVED"].includes(status)) {
        return res.status(400).json({ 
            success: false, 
            error: "Invalid status. Must be NEW, ACKNOWLEDGED, or RESOLVED" 
        });
    }
    
    const result = updateAlertStatus(req.params.id, status);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(404).json(result);
    }
});

// CSV Report generation route
router.post("/generate-report", async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: "Email address is required" 
            });
        }
        
        const result = await generateCSVReport(email);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error("Error generating CSV report:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to generate report" 
        });
    }
});

module.exports = router;