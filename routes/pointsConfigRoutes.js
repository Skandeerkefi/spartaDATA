const express = require('express');
const router = express.Router();

const pointsConfigController = require('../controllers/pointsConfigController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Get all configurations (admin only)
router.get('/', verifyToken, isAdmin, pointsConfigController.getAllConfigs);

// Get configuration history (admin only)
router.get('/history', verifyToken, isAdmin, pointsConfigController.getConfigHistory);

// Update a single configuration (admin only)
router.post('/update', verifyToken, isAdmin, pointsConfigController.updatePoints);

// Update multiple configurations at once (admin only)
router.post('/update-multiple', verifyToken, isAdmin, pointsConfigController.updateMultipleConfigs);

// Reset all to defaults (admin only)
router.post('/reset-defaults', verifyToken, isAdmin, pointsConfigController.resetToDefaults);

module.exports = router;
