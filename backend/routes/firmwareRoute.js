const express = require('express');
const router = express.Router();
const { 
    uploadFirmware,
    getFirmwareList,
    getFirmwareById,
    analyzeFirmware,
    getAnalysisResult,
    deleteFirmware,
    downloadFirmware,
    sendFirmwareReport
} = require('../controllers/firmwareController');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Add auth middleware to all routes
router.use(auth);

router.post('/upload', upload.single('firmware'), uploadFirmware);
router.get('/list', getFirmwareList);
router.get('/:id', getFirmwareById);
router.post('/:id/analyze', analyzeFirmware);
router.get('/:id/analysis', getAnalysisResult);
router.get('/:id/download', downloadFirmware);
router.delete('/:id', deleteFirmware);
router.post('/:id/send-report', sendFirmwareReport);

module.exports = router;
