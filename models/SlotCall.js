const mongoose = require("mongoose");

const bonusCallSchema = new mongoose.Schema({
	name: { type: String, required: true },
	createdAt: { type: Date, default: Date.now },
});

const slotCallSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	name: { type: String, required: true },
	imageUrl: { type: String, default: null },
	site: { type: String, default: "Stake" },
	status: {
		type: String,
		enum: ["pending", "accepted", "rejected", "played"],
		default: "pending",
	},
	x1600Hit: { type: Boolean, default: false },
	bonusCall: bonusCallSchema, // optional bonus call
	createdAt: { type: Date, default: Date.now },
});

const SlotCall = mongoose.model("SlotCall", slotCallSchema);
module.exports = { SlotCall };
