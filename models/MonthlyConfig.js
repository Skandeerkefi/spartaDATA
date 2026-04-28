const mongoose = require("mongoose");

const MonthlyConfigSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true }, // YYYY-MM
    prizes: [{ type: Number }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("MonthlyConfig", MonthlyConfigSchema);
