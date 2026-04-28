// models/CSGOWinLeaderboard.js
const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema({
	username: String,
	wager: Number,
	rank: Number,
	updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CSGOWinLeaderboard", leaderboardSchema);
