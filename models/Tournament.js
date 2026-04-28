const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    playerLimit: { type: Number, required: true },
    prizePool: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "finished"],
      default: "upcoming",
    },
    currentRound: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tournament", tournamentSchema);
