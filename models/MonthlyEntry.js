const mongoose = require("mongoose");

const MonthlyEntrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    wagering: { type: Number, required: true, default: 0 },
    prize: { type: Number, default: 0 },
    month: { type: String, required: true }, // format YYYY-MM
  },
  { timestamps: true }
);

module.exports = mongoose.model("MonthlyEntry", MonthlyEntrySchema);
