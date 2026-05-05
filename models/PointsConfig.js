const mongoose = require('mongoose');

const pointsConfigSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      enum: [
        'tournament-join',
        'tournament-match-win',
        'tournament-win',
        'slot-call-x1600',
        'giveaway-participation',
        'giveaway-win',
        'daily-login',
        'stream-watchtime',
        'stream-level',
        'kick-subscribed',
      ],
      required: true,
      unique: true,
      index: true,
    },
    points: {
      type: Number,
      required: true,
      min: 0,
    },
    description: String,
    enabled: { type: Boolean, default: true },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PointsConfig', pointsConfigSchema);
