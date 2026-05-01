const express = require('express');
const router = express.Router();
const guessBalanceController = require('../controllers/guessBalanceController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Public: Get active event
router.get('/active', guessBalanceController.getActiveEvent);

// Public: Submit a guess
router.post('/:eventId/guess', verifyToken, guessBalanceController.submitGuess);

// Admin: Create event
router.post('/', verifyToken, isAdmin, guessBalanceController.createEvent);

// Admin: Get all events
router.get('/admin/all', verifyToken, isAdmin, guessBalanceController.getAllEvents);

// Admin: Close event (stop accepting guesses)
router.post('/:eventId/close', verifyToken, isAdmin, guessBalanceController.closeEvent);

// Admin: Reopen event
router.post('/:eventId/reopen', verifyToken, isAdmin, guessBalanceController.reopenEvent);

// Admin: Resolve event with final balance
router.post('/:eventId/resolve', verifyToken, isAdmin, guessBalanceController.resolveEvent);

// Admin: Delete event
router.delete('/:eventId', verifyToken, isAdmin, guessBalanceController.deleteEvent);

module.exports = router;
