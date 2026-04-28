const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	kickUsername: { type: String, required: true, unique: true }, // your internal platform username
	rainbetUsername: { type: String, required: true, unique: true }, // Rainbet username, required for giveaways
	password: { type: String, required: true },
	role: { type: String, enum: ["user", "admin"], default: "user" },
});

const User = mongoose.model("User", userSchema);
module.exports = { User };
