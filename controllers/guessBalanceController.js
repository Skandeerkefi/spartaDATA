const GuessBalance = require('../models/GuessBalance');
const { User } = require('../models/User');
const PointsTransaction = require('../models/PointsTransaction');

const awardPoints = async (userId, amount, type, meta = {}) => {
  try {
    if (!userId || !Number.isFinite(Number(amount)) || Number(amount) === 0) return;
    const user = await User.findById(userId);
    if (!user) return;
    user.pointsBalance = (user.pointsBalance || 0) + Number(amount);
    await user.save();
    await PointsTransaction.create({ user: userId, amount: Number(amount), type, meta });
  } catch (err) {
    console.error('awardPoints error:', err);
  }
};

exports.createEvent = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const event = await GuessBalance.create({ title, state: 'open', createdBy: req.user.id });
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    const events = await GuessBalance.find().sort({ createdAt: -1 }).lean();
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

exports.getActiveEvent = async (req, res) => {
  try {
    const event = await GuessBalance.findOne({ state: { $in: ['open', 'closed'] } })
      .sort({ createdAt: -1 })
      .lean();
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch active event' });
  }
};

exports.submitGuess = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { guess } = req.body;

    if (typeof guess !== 'number' || guess < 0) {
      return res.status(400).json({ error: 'Guess must be a non-negative number' });
    }

    const event = await GuessBalance.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.state !== 'open') return res.status(400).json({ error: 'Event is not accepting guesses' });

    const existingGuess = event.guesses.find(g => String(g.user) === String(req.user.id));
    if (existingGuess) return res.status(400).json({ error: 'You already submitted a guess' });

    event.guesses.push({
      user: req.user.id,
      kickUsername: req.user.kickUsername,
      guess,
    });
    await event.save();

    res.json({ ok: true, guess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit guess' });
  }
};

exports.closeEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await GuessBalance.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    event.state = 'closed';
    await event.save();

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to close event' });
  }
};

exports.reopenEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await GuessBalance.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    event.state = 'open';
    await event.save();

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reopen event' });
  }
};

exports.resolveEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { finalBalance } = req.body;

    if (typeof finalBalance !== 'number' || finalBalance < 0) {
      return res.status(400).json({ error: 'Final balance must be a non-negative number' });
    }

    const event = await GuessBalance.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.guesses.length === 0) return res.status(400).json({ error: 'No guesses to resolve' });

    event.state = 'resolved';
    event.finalBalance = finalBalance;

    const sorted = [...event.guesses].sort((a, b) => Math.abs(a.guess - finalBalance) - Math.abs(b.guess - finalBalance));
    const top3 = sorted.slice(0, 3);

    const pointsMap = [event.rewardPoints.first, event.rewardPoints.second, event.rewardPoints.third];

    event.winners = [];

    for (let i = 0; i < top3.length; i++) {
      const g = top3[i];
      const points = pointsMap[i] || 0;

      event.winners.push({
        user: g.user,
        kickUsername: g.kickUsername,
        guess: g.guess,
        rank: i + 1,
        points,
      });

      if (points > 0) {
        await awardPoints(g.user, points, 'guess-balance-win', {
          event: event._id,
          rank: i + 1,
          finalBalance,
          userGuess: g.guess,
        });
      }
    }

    await event.save();

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve event' });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    await GuessBalance.findByIdAndDelete(eventId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};
