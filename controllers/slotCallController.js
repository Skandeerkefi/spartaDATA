const { SlotCall } = require("../models/SlotCall");

exports.createSlotCall = async (req, res) => {
	const { name } = req.body;
	if (!name) {
		return res.status(400).json({ message: "Slot name is required." });
	}

	try {
		const slotCall = new SlotCall({
			user: req.user.id,
			name,
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
	const { status, x250Hit } = req.body;
	const { id } = req.params;

	if (!["accepted", "rejected", "played"].includes(status)) {
		return res.status(400).json({ message: "Invalid status." });
	}

	try {
		const updated = await SlotCall.findByIdAndUpdate(
			id,
			{ status, x250Hit: !!x250Hit },
			{ new: true }
		).populate("user", "kickUsername");

		if (!updated)
			return res.status(404).json({ message: "Slot call not found." });

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

		if (!slotCall.x250Hit) {
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
