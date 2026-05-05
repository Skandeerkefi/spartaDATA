const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	kickUsername: { type: String, required: true, unique: true }, // your internal platform username
	rainbetUsername: { type: String, required: true, unique: true }, // Rainbet username, required for giveaways
	password: { type: String, required: true },
	role: { type: String, enum: ["user", "admin"], default: "user" },
	pointsBalance: { type: Number, default: 0 },
	kickSubscribed: { type: Boolean, default: false },
	streamPointsBaseline: {
		watchtime: { type: Number, default: 0 },
		level: { type: Number, default: 0 },
		name: { type: String, default: "" },
		updatedAt: { type: Date },
	},
	streamPointsCurrent: {
		watchtime: { type: Number, default: 0 },
		level: { type: Number, default: 0 },
		name: { type: String, default: "" },
		updatedAt: { type: Date },
	},
	streamPointsTotals: {
		watchtime: { type: Number, default: 0 },
		level: { type: Number, default: 0 },
	},
	lastDailyAward: { type: Date },
	dailyStreak: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);
module.exports = { User };
