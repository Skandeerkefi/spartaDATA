const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/users/:userId', verifyToken, pointsController.getUserPoints);
router.post('/users/:userId/transactions', verifyToken, pointsController.createTransaction); // internal/system/admin
router.post('/users/:userId/adjust', verifyToken, isAdmin, pointsController.adjustBalance);
router.get('/transactions', verifyToken, isAdmin, pointsController.listTransactions);
router.get('/leaderboard', verifyToken, isAdmin, pointsController.getLeaderboard);
router.post('/daily', verifyToken, pointsController.dailyLogin);

module.exports = router;
