const express = require("express");
const { 
    addDevice, 
    getDevices, 
    removeDevice, 
    getUnregisteredDevices, 
    registerUnregisteredDevice 
} = require("../controllers/deviceController");

const router = express.Router();

router.post("/add", addDevice);
router.get("/list", getDevices);
router.post("/delete", removeDevice);
router.get("/unregistered", getUnregisteredDevices);
router.post("/register", registerUnregisteredDevice);

module.exports = router;
