const axios = require("axios");
const BonusHunt = require("../models/BonusHunt");
const BonusHuntGame = require("../models/BonusHuntGame");

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildStats = (hunt, games) => {
  const totalGames = games.length;
  const completedGames = games.filter((game) => game.status === "completed").length;
  const remainingGames = Math.max(totalGames - completedGames, 0);

  const plannedBetTotal = games.reduce((sum, game) => sum + normalizeNumber(game.betSize), 0);
  const completedBetTotal = games
    .filter((game) => game.status === "completed")
    .reduce((sum, game) => sum + normalizeNumber(game.betSize), 0);

  const totalWinnings = games
    .filter((game) => game.status === "completed")
    .reduce((sum, game) => sum + normalizeNumber(game.payout), 0);

  const profitLoss = totalWinnings - normalizeNumber(hunt.startCost);
  const runAvgX = completedBetTotal > 0 ? totalWinnings / completedBetTotal : 0;
  const reqAvgBreakEvenX = plannedBetTotal > 0 ? normalizeNumber(hunt.startCost) / plannedBetTotal : 0;
  const reqAvgTargetX =
    plannedBetTotal > 0 && normalizeNumber(hunt.targetProfit) > 0
      ? (normalizeNumber(hunt.startCost) + normalizeNumber(hunt.targetProfit)) / plannedBetTotal
      : null;

  return {
    totalGames,
    completedGames,
    remainingGames,
    progressPercent: totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0,
    plannedBetTotal,
    completedBetTotal,
    totalWinnings,
    profitLoss,
    runAvgX,
    reqAvgBreakEvenX,
    reqAvgTargetX,
    targetProfit: normalizeNumber(hunt.targetProfit),
  };
};

const buildHuntView = async (huntId) => {
  const hunt = await BonusHunt.findById(huntId).populate("createdBy", "kickUsername role").lean();

  if (!hunt) return null;

  const games = await BonusHuntGame.find({ hunt: huntId }).sort({ order: 1 }).lean();
  const stats = buildStats(hunt, games);

  return { hunt, games, stats };
};

const getCurrentHuntId = async () => {
  const current = await BonusHunt.findOne({ status: { $in: ["draft", "ongoing"] } }).sort({ createdAt: -1 }).lean();
  if (current) return current._id;

  const latest = await BonusHunt.findOne().sort({ createdAt: -1 }).lean();
  return latest?._id || null;
};

const reindexGames = async (huntId) => {
  const games = await BonusHuntGame.find({ hunt: huntId }).sort({ order: 1, createdAt: 1 });
  await Promise.all(
    games.map((game, index) => {
      if (game.order !== index + 1) {
        game.order = index + 1;
        return game.save();
      }
      return Promise.resolve();
    })
  );
};

exports.createBonusHunt = async (req, res) => {
  try {
    const { title, startCost, targetProfit } = req.body;

    if (!title || title.trim().length < 2) {
      return res.status(400).json({ message: "Hunt name is required." });
    }

    const normalizedStartCost = normalizeNumber(startCost);
    if (normalizedStartCost < 0) {
      return res.status(400).json({ message: "Start cost must be a valid number." });
    }

    const hunt = await BonusHunt.create({
      title: title.trim(),
      startCost: normalizedStartCost,
      targetProfit: Math.max(normalizeNumber(targetProfit), 0),
      status: "draft",
      createdBy: req.user.id,
    });

    const view = await buildHuntView(hunt._id);
    res.status(201).json(view);
  } catch (error) {
    console.error("Create bonus hunt error:", error);
    res.status(500).json({ message: "Failed to create bonus hunt" });
  }
};

exports.getCurrentBonusHunt = async (req, res) => {
  try {
    const huntId = await getCurrentHuntId();

    if (!huntId) {
      return res.json({ hunt: null, games: [], stats: null });
    }

    const view = await buildHuntView(huntId);
    res.json(view);
  } catch (error) {
    console.error("Get current bonus hunt error:", error);
    res.status(500).json({ message: "Failed to load bonus hunt" });
  }
};

exports.getBonusHuntById = async (req, res) => {
  try {
    const view = await buildHuntView(req.params.id);
    if (!view) {
      return res.status(404).json({ message: "Bonus hunt not found" });
    }

    res.json(view);
  } catch (error) {
    console.error("Get bonus hunt error:", error);
    res.status(500).json({ message: "Failed to load bonus hunt" });
  }
};

exports.getBonusHuntHistory = async (req, res) => {
  try {
    const hunts = await BonusHunt.find({ status: "finished" })
      .sort({ finishedAt: -1, createdAt: -1 })
      .limit(20)
      .populate("createdBy", "kickUsername role")
      .lean();

    const history = await Promise.all(
      hunts.map(async (hunt) => {
        const games = await BonusHuntGame.find({ hunt: hunt._id }).sort({ order: 1 }).lean();
        const stats = buildStats(hunt, games);

        return {
          hunt,
          games,
          stats,
        };
      })
    );

    res.json({ history });
  } catch (error) {
    console.error("Get bonus hunt history error:", error);
    res.status(500).json({ message: "Failed to load bonus hunt history" });
  }
};

exports.addGame = async (req, res) => {
  try {
    const hunt = await BonusHunt.findById(req.params.id);
    if (!hunt) {
      return res.status(404).json({ message: "Bonus hunt not found" });
    }

    if (hunt.status !== "draft") {
      return res.status(400).json({ message: "Games can only be added before the hunt starts." });
    }

    const { slotId, slotName, provider, image, url, betSize, bonusType, note } = req.body;

    if (!slotName) {
      return res.status(400).json({ message: "Slot selection is required." });
    }

    // Use slotName as fallback if slotId is empty
    const finalSlotId = slotId || slotName;

    const normalizedBetSize = normalizeNumber(betSize);
    if (normalizedBetSize <= 0) {
      return res.status(400).json({ message: "Bet size must be greater than zero." });
    }

    const gameCount = await BonusHuntGame.countDocuments({ hunt: hunt._id });

    const game = await BonusHuntGame.create({
      hunt: hunt._id,
      order: gameCount + 1,
      slotId: finalSlotId,
      slotName,
      provider: provider || "",
      image: image || "",
      url: url || "",
      betSize: normalizedBetSize,
      bonusType: bonusType === "super" ? "super" : "normal",
      note: note || "",
      status: "draft",
      locked: false,
      createdBy: req.user.id,
    });

    const view = await buildHuntView(hunt._id);
    res.status(201).json({ game, ...view });
  } catch (error) {
    console.error("Add bonus hunt game error:", error);
    res.status(500).json({ message: "Failed to add game" });
  }
};

exports.updateGame = async (req, res) => {
  try {
    const hunt = await BonusHunt.findById(req.params.id);
    if (!hunt) {
      return res.status(404).json({ message: "Bonus hunt not found" });
    }

    if (hunt.status !== "draft") {
      return res.status(400).json({ message: "Games can only be edited before the hunt starts." });
    }

    const game = await BonusHuntGame.findOne({
      _id: req.params.gameId,
      hunt: hunt._id,
    });

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const { slotId, slotName, provider, image, url, betSize, bonusType, note } = req.body;

    if (slotId !== undefined) game.slotId = slotId;
    if (slotName !== undefined) game.slotName = slotName;
    if (provider !== undefined) game.provider = provider;
    if (image !== undefined) game.image = image;
    if (url !== undefined) game.url = url;
    if (betSize !== undefined) game.betSize = normalizeNumber(betSize);
    if (bonusType === "super" || bonusType === "normal") game.bonusType = bonusType;
    if (note !== undefined) game.note = note;

    await game.save();

    const view = await buildHuntView(hunt._id);
    res.json({ game, ...view });
  } catch (error) {
    console.error("Update bonus hunt game error:", error);
    res.status(500).json({ message: "Failed to update game" });
  }
};

exports.deleteGame = async (req, res) => {
  try {
    const hunt = await BonusHunt.findById(req.params.id);
    if (!hunt) {
      return res.status(404).json({ message: "Bonus hunt not found" });
    }

    if (hunt.status !== "draft") {
      return res.status(400).json({ message: "Games can only be removed before the hunt starts." });
    }

    const deleted = await BonusHuntGame.findOneAndDelete({
      _id: req.params.gameId,
      hunt: hunt._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Game not found" });
    }

    await reindexGames(hunt._id);
    const view = await buildHuntView(hunt._id);
    res.json(view);
  } catch (error) {
    console.error("Delete bonus hunt game error:", error);
    res.status(500).json({ message: "Failed to delete game" });
  }
};

exports.startBonusHunt = async (req, res) => {
  try {
    const hunt = await BonusHunt.findById(req.params.id);
    if (!hunt) {
      return res.status(404).json({ message: "Bonus hunt not found" });
    }

    if (hunt.status !== "draft") {
      return res.status(400).json({ message: "Bonus hunt is already running or finished." });
    }

    const gameCount = await BonusHuntGame.countDocuments({ hunt: hunt._id });
    if (gameCount === 0) {
      return res.status(400).json({ message: "Add at least one game before starting the hunt." });
    }

    await BonusHuntGame.updateMany({ hunt: hunt._id }, { locked: true });

    hunt.status = "ongoing";
    hunt.startedAt = new Date();
    await hunt.save();

    const view = await buildHuntView(hunt._id);
    res.json(view);
  } catch (error) {
    console.error("Start bonus hunt error:", error);
    res.status(500).json({ message: "Failed to start hunt" });
  }
};

exports.finishBonusHunt = async (req, res) => {
  try {
    const hunt = await BonusHunt.findById(req.params.id);
    if (!hunt) {
      return res.status(404).json({ message: "Bonus hunt not found" });
    }

    if (hunt.status === "finished") {
      const view = await buildHuntView(hunt._id);
      return res.json(view);
    }

    hunt.status = "finished";
    hunt.finishedAt = new Date();
    await hunt.save();

    const view = await buildHuntView(hunt._id);
    res.json(view);
  } catch (error) {
    console.error("Finish bonus hunt error:", error);
    res.status(500).json({ message: "Failed to finish hunt" });
  }
};

exports.deleteBonusHunt = async (req, res) => {
  try {
    const hunt = await BonusHunt.findById(req.params.id);
    if (!hunt) {
      return res.status(404).json({ message: "Bonus hunt not found" });
    }

    if (hunt.status === "ongoing") {
      return res.status(400).json({ message: "You cannot delete a live bonus hunt." });
    }

    await BonusHuntGame.deleteMany({ hunt: hunt._id });
    await BonusHunt.findByIdAndDelete(hunt._id);

    res.json({ ok: true });
  } catch (error) {
    console.error("Delete bonus hunt error:", error);
    res.status(500).json({ message: "Failed to delete bonus hunt" });
  }
};

exports.updateGameResult = async (req, res) => {
  try {
    const hunt = await BonusHunt.findById(req.params.id);
    if (!hunt) {
      return res.status(404).json({ message: "Bonus hunt not found" });
    }

    if (hunt.status !== "ongoing") {
      return res.status(400).json({ message: "Results can only be entered while the hunt is ongoing." });
    }

    const game = await BonusHuntGame.findOne({
      _id: req.params.gameId,
      hunt: hunt._id,
    });

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const payout = normalizeNumber(req.body.payout);
    if (payout < 0) {
      return res.status(400).json({ message: "Payout must be a valid number." });
    }

    game.payout = payout;
    game.multiplier = game.betSize > 0 ? payout / game.betSize : 0;
    game.status = "completed";
    game.playedAt = new Date();
    game.locked = true;
    await game.save();

    const games = await BonusHuntGame.find({ hunt: hunt._id }).sort({ order: 1 }).lean();
    const completedGames = games.filter((item) => item.status === "completed").length;
    const allCompleted = games.length > 0 && completedGames === games.length;

    if (allCompleted) {
      hunt.status = "finished";
      hunt.finishedAt = new Date();
      await hunt.save();
    }

    const view = await buildHuntView(hunt._id);
    res.json({ game, ...view });
  } catch (error) {
    console.error("Update bonus hunt result error:", error);
    res.status(500).json({ message: "Failed to save result" });
  }
};

exports.searchSlots = async (req, res) => {
  try {
    const query = req.query.q || "";
    const site = req.query.site || "Stake";

    const url = `https://bonushunt.gg/api/slots?q=${encodeURIComponent(query)}&site=${encodeURIComponent(site)}`;
    const { data } = await axios.get(url, { timeout: 15000 });

    const rawSlots = Array.isArray(data)
      ? data
      : data?.results || data?.slots || data?.data || [];

    const slots = rawSlots
      .map((slot) => ({
        id: slot.id || slot._id || slot.slug || slot.name || slot.title || "",
        name: slot.name || slot.title || slot.slotName || slot.slot_name || slot.gameName || "Unknown Slot",
        image:
          slot.image ||
          slot.imageUrl ||
          slot.thumbnail ||
          slot.thumb ||
          slot.cover ||
          slot.art ||
          "",
        site: slot.site || site,
        provider: slot.provider || slot.providerName || "",
        raw: slot,
      }))
      .filter((slot) => slot.name && slot.name !== "Unknown Slot");

    res.json(slots);
  } catch (error) {
    console.error("Bonus hunt slot search error:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to search slots" });
  }
};
