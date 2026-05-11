const mongoose = require("mongoose");

const tournamentBetSchema = new mongoose.Schema(
  {
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
      index: true,
    },
    bettor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bettorUsername: { type: String, required: true },
    targetProgress: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TournamentProgress",
      required: true,
      index: true,
    },
    targetUsername: { type: String, required: true },
    stake: { type: Number, required: true, min: 1, max: 500 },
    potentialPayout: { type: Number, required: true, min: 2 },
    status: {
      type: String,
      enum: ["pending", "won", "lost"],
      default: "pending",
      index: true,
    },
    resolvedReason: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    settledMatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TournamentMatch",
      default: null,
    },
  },
  { timestamps: true }
);

tournamentBetSchema.index({ tournament: 1, bettor: 1 }, { unique: true });

module.exports = mongoose.model("TournamentBet", tournamentBetSchema);