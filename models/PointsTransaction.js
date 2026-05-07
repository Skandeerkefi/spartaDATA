const mongoose = require('mongoose');

const PointsTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true }, // positive = earn, negative = spend/refund
  type: {
    type: String,
    enum: [
      'daily-login',
      'tournament-join',
      'tournament-win',
      'tournament-bet-stake',
      'tournament-bet-win',
      'slot-call-x1600',
      'giveaway-participation',
      'giveaway-win',
      'admin-adjust',
      'stream-watchtime',
      'stream-level',
      'kick-subscribed',
      'redemption',
      'redemption-refund',
      'hold',
    ],
    required: true,
  },
  meta: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('PointsTransaction', PointsTransactionSchema);
