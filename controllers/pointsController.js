const { User } = require('../models/User');
const mongoose = require('mongoose');
const PointsTransaction = require('../models/PointsTransaction');


// Get user balance and recent transactions
exports.getUserPoints = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const transactions = await PointsTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ balance: user.pointsBalance || 0, transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Earn/spend points (system/admin)
exports.createTransaction = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, type, meta } = req.body;
    if (typeof amount !== 'number') return res.status(400).json({ error: 'amount must be a number' });
    if (!type) return res.status(400).json({ error: 'type is required' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: 'User not found' });
      }

      user.pointsBalance = (user.pointsBalance || 0) + Number(amount);
      await user.save({ session });

      const tx = await PointsTransaction.create([{ user: userId, amount, type, meta }], { session });
      await session.commitTransaction();
      session.endSession();
      res.json({ ok: true, tx: tx[0], balance: user.pointsBalance });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Admin adjust
exports.adjustBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, note } = req.body;
    if (typeof amount !== 'number') return res.status(400).json({ error: 'amount must be a number' });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: 'User not found' });
      }

      user.pointsBalance = (user.pointsBalance || 0) + Number(amount);
      await user.save({ session });

      const tx = await PointsTransaction.create([{ user: userId, amount, type: 'admin-adjust', meta: { note } }], { session });
      await session.commitTransaction();
      session.endSession();
      res.json({ ok: true, tx: tx[0], balance: user.pointsBalance });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Admin list transactions
exports.listTransactions = async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = {};
    if (userId) filter.user = userId;
    const txs = await PointsTransaction.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
    res.json(txs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Admin points leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const users = await User.find({}, {
      kickUsername: 1,
      rainbetUsername: 1,
      pointsBalance: 1,
    })
      .sort({ pointsBalance: -1, kickUsername: 1 })
      .limit(limit)
      .lean();

    const leaderboard = users.map((u, index) => ({
      rank: index + 1,
      userId: u._id,
      kickUsername: u.kickUsername,
      rainbetUsername: u.rainbetUsername,
      pointsBalance: Number(u.pointsBalance || 0),
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Daily login award
exports.dailyLogin = async (req, res) => {
  try {
    const userId = req.user.id;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: 'User not found' });
      }

      const now = new Date();
      const last = user.lastDailyAward ? new Date(user.lastDailyAward) : null;

      // Normalize dates to UTC day
      const sameDay = last && last.getUTCFullYear() === now.getUTCFullYear() && last.getUTCMonth() === now.getUTCMonth() && last.getUTCDate() === now.getUTCDate();
      if (sameDay) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Daily reward already claimed today' });
      }

      // Check if yesterday for streak
      let streak = 1;
      if (last) {
        const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
        const lastDay = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
        if (lastDay.getTime() === yesterday.getTime()) {
          streak = (user.dailyStreak || 0) + 1;
        }
      }

      // Base reward and streak bonus every 7 days
      const base = 5;
      const bonus = streak > 0 && streak % 7 === 0 ? 2 : 0;
      const total = base + bonus;

      user.pointsBalance = (user.pointsBalance || 0) + total;
      user.lastDailyAward = now;
      user.dailyStreak = streak;
      await user.save({ session });

      await PointsTransaction.create([{ user: userId, amount: total, type: 'daily-login', meta: { streak } }], { session });

      await session.commitTransaction();
      session.endSession();

      res.json({ ok: true, awarded: total, streak, balance: user.pointsBalance });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
