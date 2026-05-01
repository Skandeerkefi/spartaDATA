const mongoose = require('mongoose');

const guessBalanceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  state: { type: String, enum: ['open', 'closed', 'resolved'], default: 'open' },
  guesses: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kickUsername: { type: String, required: true },
    guess: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
  finalBalance: { type: Number, default: 0 },
  winners: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    kickUsername: String,
    guess: Number,
    rank: Number,
    points: Number,
  }],
  rewardPoints: {
    first: { type: Number, default: 1000 },
    second: { type: Number, default: 500 },
    third: { type: Number, default: 250 },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('GuessBalance', guessBalanceSchema);
