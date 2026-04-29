const mongoose = require("mongoose");

const tournamentMatchSchema = new mongoose.Schema(
  {
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
      index: true,
    },
    roundIndex: { type: Number, required: true },
    matchIndex: { type: Number, required: true },
    roundLabel: { type: String, required: true },
    playerA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TournamentProgress",
      default: null,
    },
    playerB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TournamentProgress",
      default: null,
    },
    betSizeA: { type: Number, default: null },
    payoutA: { type: Number, default: null },
    betSizeB: { type: Number, default: null },
    payoutB: { type: Number, default: null },
    multiplierA: { type: Number, default: null },
    multiplierB: { type: Number, default: null },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TournamentProgress",
      default: null,
    },
    status: {
      type: String,
      enum: ["waiting", "ready", "completed"],
      default: "waiting",
    },
  },
  { timestamps: true }
);

tournamentMatchSchema.index(
  { tournament: 1, roundIndex: 1, matchIndex: 1 },
  { unique: true }
);

module.exports = mongoose.model("TournamentMatch", tournamentMatchSchema);
