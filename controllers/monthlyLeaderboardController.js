const MonthlyEntry = require("../models/MonthlyEntry");
const MonthlyConfig = require("../models/MonthlyConfig");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
}

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

exports.importCsvEntries = async (req, res) => {
  try {
    const month = req.params.month;
    const csvText = typeof req.body?.csvText === "string" ? req.body.csvText : "";

    if (!month) return res.status(400).json({ error: "Missing month" });
    if (!csvText.trim()) return res.status(400).json({ error: "Missing csvText" });

    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      return res.status(400).json({ error: "CSV must include a header row and at least one data row" });
    }

    const header = rows[0].map((value) => value.trim().toLowerCase());
    const usernameIndex = header.findIndex(
      (value) => value === "username" || value === "user name"
    );
    const wageringIndex = header.findIndex(
      (value) => value === "wager amount ($)" || value === "wager amount" || value === "wagering"
    );

    if (usernameIndex === -1) {
      return res.status(400).json({ error: "CSV is missing a Username column" });
    }

    if (wageringIndex === -1) {
      return res.status(400).json({ error: "CSV is missing a Wager Amount ($) column" });
    }

    const importedEntries = rows.slice(1)
      .map((row) => ({
        name: (row[usernameIndex] || "").trim(),
        wagering: Number(String(row[wageringIndex] || "").replace(/[^0-9.-]/g, "")) || 0,
      }))
      .filter((entry) => entry.name);

    if (importedEntries.length === 0) {
      return res.status(400).json({ error: "No valid usernames were found in the CSV" });
    }

    await MonthlyEntry.deleteMany({ month });
    const inserted = await MonthlyEntry.insertMany(
      importedEntries.map((entry) => ({ ...entry, month }))
    );

    res.json({
      ok: true,
      imported: inserted.length,
      month,
      entries: inserted,
    });
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
