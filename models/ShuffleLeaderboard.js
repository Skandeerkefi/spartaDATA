const mongoose = require("mongoose");

const ShuffleLeaderboardEntrySchema = new mongoose.Schema(
	{
		username: { type: String, required: true },
		wagering: { type: Number, required: true, default: 0 },
		prize: { type: Number, default: 0 },
	},
	{ timestamps: true }
);

const ShuffleLeaderboardSchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		startDate: { type: Date, required: true },
		endDate: { type: Date, required: true },
		totalPrize: { type: Number, default: 0 },
		prizeSplit: { type: [Number], default: [] },
		active: { type: Boolean, default: true },
		entries: { type: [ShuffleLeaderboardEntrySchema], default: [] },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("ShuffleLeaderboard", ShuffleLeaderboardSchema);