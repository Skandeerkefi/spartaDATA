const { SlotCall } = require("../models/SlotCall");
const PointsTransaction = require('../models/PointsTransaction');
const { User } = require('../models/User');
const pointsConfigController = require('./pointsConfigController');

const awardPoints = async (userId, amount, type, meta = {}) => {
	try {
		if (!userId || !Number.isFinite(Number(amount)) || Number(amount) === 0) return;
		const user = await User.findById(userId);
		if (!user) return;
		user.pointsBalance = (user.pointsBalance || 0) + Number(amount);
		await user.save();
		await PointsTransaction.create({ user: userId, amount: Number(amount), type, meta });
	} catch (err) {
		console.error('awardPoints error (slot):', err);
	}
};

exports.createSlotCall = async (req, res) => {
	const { name, imageUrl, site } = req.body;
	if (!name) {
		return res.status(400).json({ message: "Slot name is required." });
	}

	try {
		const slotCall = new SlotCall({
			user: req.user.id,
			name,
			imageUrl: imageUrl || null,
			site: site || "Stake",
		});
		await slotCall.save();

		res.status(201).json({ message: "Slot call submitted", slotCall });
	} catch (err) {
		res.status(500).json({ error: "Slot call failed" });
	}
};

exports.getAllSlotCalls = async (req, res) => {
	try {
		const calls = await SlotCall.find()
			.populate("user", "kickUsername")
			.sort({ createdAt: -1 });
		res.json(calls);
	} catch (err) {
		res.status(500).json({ error: "Fetch failed" });
	}
};

exports.getUserSlotCalls = async (req, res) => {
	try {
		const calls = await SlotCall.find({ user: req.user.id }).sort({
			createdAt: -1,
		});
		res.json(calls);
	} catch (err) {
		res.status(500).json({ error: "Fetch failed" });
	}
};

exports.changeSlotCallStatus = async (req, res) => {
	const { status, x1600Hit } = req.body;

	if (!["accepted", "rejected", "played"].includes(status)) {
		return res.status(400).json({ message: "Invalid status." });
	}

	try {
		const updated = await SlotCall.findByIdAndUpdate(
			req.params.id,
			{ status, x1600Hit: !!x1600Hit },
			{ new: true }
		).populate("user", "kickUsername");

		if (!updated)
			return res.status(404).json({ message: "Slot call not found." });


		// Award milestone points only when call is played and x1600 hit is confirmed
		try {
			if (status === 'played' && updated.x1600Hit) {
				const x1600Points = await pointsConfigController.getPointsForAction('slot-call-x1600');
				await awardPoints(updated.user._id, x1600Points, 'slot-call-x1600', { slotCall: updated._id });
			}
		} catch (e) {
			console.error('Failed to award slot call status points:', e);
		}

		res.status(200).json({ message: `Slot call ${status}`, slotCall: updated });
	} catch (err) {
		res.status(500).json({ message: "Update failed" });
	}
};

exports.addBonusCall = async (req, res) => {
	const { id } = req.params;
	const { name } = req.body;

	if (!name) {
		return res.status(400).json({ message: "Bonus slot name required." });
	}

	try {
		const slotCall = await SlotCall.findById(id);

		if (!slotCall) {
			return res.status(404).json({ message: "Slot call not found." });
		}

		if (!slotCall.x1600Hit) {
			return res
				.status(403)
				.json({ message: "User is not eligible for a bonus call." });
		}

		if (slotCall.bonusCall) {
			return res
				.status(409)
				.json({ message: "Bonus call already submitted for this slot." });
		}

		slotCall.bonusCall = { name };
		await slotCall.save();

		res.status(200).json({ message: "Bonus call added.", slotCall });
	} catch (err) {
		res.status(500).json({ message: "Failed to add bonus call." });
	}
};
