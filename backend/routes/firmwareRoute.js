const express = require('express');
const router = express.Router();
const { 
    uploadFirmware,
    getFirmwareList,
    getFirmwareById,
    analyzeFirmware,
    getAnalysisResult 
} = require('../controllers/firmwareController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('firmware'), uploadFirmware);
router.get('/list', getFirmwareList);
router.get('/:id', getFirmwareById);
router.post('/:id/analyze', analyzeFirmware);
router.get('/:id/analysis', getAnalysisResult);

module.exports = router;
