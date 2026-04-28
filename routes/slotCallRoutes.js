const express = require("express");
const router = express.Router();
const { SlotCall } = require("../models/SlotCall"); // make sure this is imported

const {
	createSlotCall,
	getAllSlotCalls,
	getUserSlotCalls,
	changeSlotCallStatus,
	addBonusCall,
} = require("../controllers/slotCallController");

const { verifyToken, isAdmin } = require("../middleware/auth");

router.post("/", verifyToken, createSlotCall);
router.get("/", verifyToken, isAdmin, getAllSlotCalls);
router.get("/my", verifyToken, getUserSlotCalls);
router.post("/:id/status", verifyToken, isAdmin, changeSlotCallStatus);
router.post("/:id/bonus-call", verifyToken, addBonusCall); // Only if x250 is true

// Delete slot call by ID - only admin
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
	try {
		const slotCallId = req.params.id;
		const deleted = await SlotCall.findByIdAndDelete(slotCallId);

		if (!deleted) {
			return res.status(404).json({ message: "Slot call not found" });
		}

		res.json({ message: "Slot call deleted successfully" });
	} catch (err) {
		console.error("Error deleting slot call:", err);
		res.status(500).json({ message: "Server error while deleting slot call" });
	}
});

module.exports = router;
