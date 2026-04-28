const MonthlyEntry = require("../models/MonthlyEntry");
const MonthlyConfig = require("../models/MonthlyConfig");

exports.createEntry = async (req, res) => {
  try {
    const month = req.params.month;
    const { name, wagering } = req.body;
    if (!name) return res.status(400).json({ error: "Missing name" });

    const entry = new MonthlyEntry({ name, wagering: Number(wagering) || 0, month });
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.listEntries = async (req, res) => {
  try {
    const month = req.params.month || req.query.month;
    const filter = month ? { month } : {};
    const entries = await MonthlyEntry.find(filter).sort({ wagering: -1, createdAt: 1 });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateEntry = async (req, res) => {
  try {
    const id = req.params.id;
    const update = req.body;
    const entry = await MonthlyEntry.findByIdAndUpdate(id, update, { new: true });
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteEntry = async (req, res) => {
  try {
    const id = req.params.id;
    await MonthlyEntry.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Prizes
exports.setPrizes = async (req, res) => {
  try {
    const month = req.params.month;
    const { prizes } = req.body;
    if (!Array.isArray(prizes)) return res.status(400).json({ error: "prizes must be an array" });

    const cfg = await MonthlyConfig.findOneAndUpdate(
      { month },
      { prizes },
      { upsert: true, new: true }
    );
    res.json(cfg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPrizes = async (req, res) => {
  try {
    const month = req.params.month || req.query.month;
    if (!month) return res.status(400).json({ error: "Missing month" });
    const cfg = await MonthlyConfig.findOne({ month });
    res.json(cfg || { month, prizes: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
