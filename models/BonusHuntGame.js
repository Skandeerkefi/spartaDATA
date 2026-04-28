const mongoose = require("mongoose");

const bonusHuntGameSchema = new mongoose.Schema(
  {
    hunt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BonusHunt",
      required: true,
      index: true,
    },
    order: { type: Number, required: true },
    slotId: { type: String, required: true },
    slotName: { type: String, required: true },
    provider: { type: String, default: "" },
    image: { type: String, default: "" },
    url: { type: String, default: "" },
    betSize: { type: Number, required: true, min: 0 },
    bonusType: {
      type: String,
      enum: ["normal", "super"],
      default: "normal",
    },
    note: { type: String, default: "" },
    payout: { type: Number, default: null },
    multiplier: { type: Number, default: null },
    status: {
      type: String,
      enum: ["draft", "completed"],
      default: "draft",
    },
    locked: { type: Boolean, default: false },
    playedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

bonusHuntGameSchema.index({ hunt: 1, order: 1 }, { unique: true });

module.exports = mongoose.model("BonusHuntGame", bonusHuntGameSchema);
