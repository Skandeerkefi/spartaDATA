const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const { syncStreamPoints, listStreamUsers } = require('../controllers/streamPointsController');

router.get('/admin', verifyToken, isAdmin, listStreamUsers);
router.post('/sync', verifyToken, isAdmin, syncStreamPoints);

module.exports = router;
