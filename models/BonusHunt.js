const mongoose = require("mongoose");

const bonusHuntSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    startCost: { type: Number, required: true, min: 0 },
    targetProfit: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["draft", "ongoing", "finished"],
      default: "draft",
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BonusHunt", bonusHuntSchema);
