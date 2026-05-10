const { User } = require('../models/User');
const mongoose = require('mongoose');
const PointsTransaction = require('../models/PointsTransaction');
const pointsConfigController = require('./pointsConfigController');


// Get user balance and recent transactions
exports.getUserPoints = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const transactions = await PointsTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({
      balance: user.pointsBalance || 0,
      transactions,
      streamPointsBaseline: user.streamPointsBaseline || null,
      streamPointsCurrent: user.streamPointsCurrent || null,
      streamPointsTotals: user.streamPointsTotals || null,
    });
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
    const { userId, user, type } = req.query;
    const filter = {};
    const userIds = [];
    let userQueryProvided = false;

    if (userId) userIds.push(userId);

    if (user) {
      const trimmedUser = String(user).trim();
      if (trimmedUser) {
        userQueryProvided = true;
        const idFilter = mongoose.Types.ObjectId.isValid(trimmedUser) ? [{ _id: trimmedUser }] : [];
        const matchedUsers = await User.find({
          $or: [
            { kickUsername: { $regex: trimmedUser, $options: 'i' } },
            { rainbetUsername: { $regex: trimmedUser, $options: 'i' } },
            ...idFilter,
          ],
        }, { _id: 1 }).lean();

        userIds.push(...matchedUsers.map((matchedUser) => String(matchedUser._id)));
      }
    }

    if (userQueryProvided && userIds.length === 0) {
      return res.json([]);
    }

    if (userIds.length > 0) {
      filter.user = { $in: [...new Set(userIds)] };
    }

    if (type) filter.type = type;

    const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 2000);
    const txs = await PointsTransaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'kickUsername rainbetUsername role')
      .lean();
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

// Get all users with details (for admin management)
exports.getAllUsers = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 2000);
    const users = await User.find({}, {
      kickUsername: 1,
      rainbetUsername: 1,
      pointsBalance: 1,
      role: 1,
      kickSubscribed: 1,
    })
      .sort({ kickUsername: 1 })
      .limit(limit)
      .lean();

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Admin: set user's kick subscription state (and award points if subscribing)
exports.setUserSubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    const { kickSubscribed } = req.body;

    if (typeof kickSubscribed !== 'boolean') return res.status(400).json({ error: 'kickSubscribed must be boolean' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: 'User not found' });
      }

      const wasSubscribed = !!user.kickSubscribed;
      user.kickSubscribed = kickSubscribed;

      // If admin sets subscribed true and user was not subscribed before, award configured points
      if (kickSubscribed && !wasSubscribed) {
        const points = await pointsConfigController.getPointsForAction('kick-subscribed');
        if (points > 0) {
          user.pointsBalance = (user.pointsBalance || 0) + Number(points);
          await PointsTransaction.create([{ user: userId, amount: points, type: 'kick-subscribed', meta: { source: 'admin' } }], { session });
        }
      }

      await user.save({ session });
      await session.commitTransaction();
      session.endSession();

      res.json({ ok: true, userId, kickSubscribed: user.kickSubscribed, balance: user.pointsBalance });
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

// Change user role
exports.changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "user" or "admin"' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json({ ok: true, userId, kickUsername: user.kickUsername, role });
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

      // Base reward and streak bonus every 7 days (using dynamic config)
      const base = await pointsConfigController.getPointsForAction('daily-login');
      const bonus = streak > 0 && streak % 7 === 0 ? base : 0;
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
