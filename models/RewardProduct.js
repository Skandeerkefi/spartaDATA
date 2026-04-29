const mongoose = require('mongoose');

const RewardProductSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  cost: { type: Number, required: true },
  sku: { type: String },
  stock: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  requiresApproval: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('RewardProduct', RewardProductSchema);
