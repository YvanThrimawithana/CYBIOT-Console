const express = require('express');
const router = express.Router();
const offenseController = require('../controllers/offenseController');

router.get('/', offenseController.getAllOffenses);
router.get('/:id', offenseController.getOffenseById);
router.post('/', offenseController.createOffense);
router.put('/:id', offenseController.updateOffense);
router.delete('/:id', offenseController.deleteOffense);

// Generate CSV report and send via email
router.post('/generate-csv-report', offenseController.generateCSVReport);

module.exports = router;