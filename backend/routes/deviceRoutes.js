const express = require("express");
const { addDevice, getDevices, removeDevice } = require("../controllers/deviceController");

const router = express.Router();

router.post("/add", addDevice);
router.get("/list", getDevices);
router.post("/delete", removeDevice);

module.exports = router;
