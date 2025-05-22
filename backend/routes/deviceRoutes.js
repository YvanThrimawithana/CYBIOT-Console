const express = require("express");
const { 
    addDevice, 
    getDevices, 
    removeDevice, 
    getUnregisteredDevices, 
    registerUnregisteredDevice,
    updateDeviceFirmware,
    revertFirmware
} = require("../controllers/deviceController");

const router = express.Router();

router.post("/add", addDevice);
router.get("/list", getDevices);
router.post("/delete", removeDevice);
router.get("/unregistered", getUnregisteredDevices);
router.post("/register", registerUnregisteredDevice);
router.post("/update-firmware", updateDeviceFirmware);
router.post("/revert-firmware", revertFirmware);

module.exports = router;
