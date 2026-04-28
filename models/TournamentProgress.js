const mongoose = require("mongoose");

const slotSelectionSchema = new mongoose.Schema(
  {
    roundIndex: { type: Number, required: true },
    slotId: { type: String, required: true },
    slotName: { type: String, required: true },
    provider: { type: String },
    image: { type: String },
    url: { type: String },
    selectedAt: { type: Date, default: Date.now },
    locked: { type: Boolean, default: true },
  },
  { _id: false }
);

const tournamentProgressSchema = new mongoose.Schema(
  {
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    username: { type: String, required: true },
    position: { type: Number, required: true },
    currentRound: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "eliminated", "winner"],
      default: "active",
    },
    eliminatedRound: { type: Number, default: null },
    eliminatedMatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TournamentMatch",
      default: null,
    },
    lastMatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TournamentMatch",
      default: null,
    },
    slotSelections: [slotSelectionSchema],
  },
  { timestamps: true }
);

tournamentProgressSchema.index({ tournament: 1, user: 1 }, { unique: true });
tournamentProgressSchema.index({ tournament: 1, position: 1 }, { unique: true });

module.exports = mongoose.model("TournamentProgress", tournamentProgressSchema);
