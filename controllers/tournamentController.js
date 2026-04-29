const axios = require("axios");
const Tournament = require("../models/Tournament");
const TournamentMatch = require("../models/TournamentMatch");
const TournamentProgress = require("../models/TournamentProgress");
const PointsTransaction = require('../models/PointsTransaction');
const { User } = require('../models/User');

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

const ROUND_LABEL_BY_PLAYER_COUNT = {
  2: "Final",
  4: "Semifinals",
  8: "Quarterfinals",
  16: "Round of 16",
  32: "Round of 32",
  64: "Round of 64",
};

const isPowerOfTwo = (value) =>
  Number.isInteger(value) && value >= 4 && (value & (value - 1)) === 0;

const getTotalRounds = (playerLimit) => Math.log2(playerLimit);

const getRoundLabel = (playerCount) =>
  ROUND_LABEL_BY_PLAYER_COUNT[playerCount] || `Round of ${playerCount}`;

const getMatchCount = (playerLimit, roundIndex) =>
  playerLimit / Math.pow(2, roundIndex + 1);

const sortMatches = (a, b) =>
  a.roundIndex === b.roundIndex
    ? a.matchIndex - b.matchIndex
    : a.roundIndex - b.roundIndex;

const buildState = async (tournamentId) => {
  const tournament = await Tournament.findById(tournamentId)
    .populate("createdBy", "kickUsername role")
    .lean();

  if (!tournament) return null;

  const [matches, players] = await Promise.all([
    TournamentMatch.find({ tournament: tournamentId })
      .sort({ roundIndex: 1, matchIndex: 1 })
      .populate("playerA")
      .populate("playerB")
      .populate("winner")
      .lean(),
    TournamentProgress.find({ tournament: tournamentId })
      .sort({ position: 1 })
      .lean(),
  ]);

  const availablePositions = Array.from(
    { length: tournament.playerLimit },
    (_, index) => index + 1
  ).filter((position) => !players.some((player) => player.position === position));

  return {
    tournament,
    matches: matches.sort(sortMatches),
    players,
    availablePositions,
    totalRounds: getTotalRounds(tournament.playerLimit),
  };
};

const createBracketSkeleton = async (tournamentId, playerLimit) => {
  const matches = [];
  const totalRounds = getTotalRounds(playerLimit);

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const playersRemaining = playerLimit / Math.pow(2, roundIndex);
    const matchCount = getMatchCount(playerLimit, roundIndex);
    const roundLabel = getRoundLabel(playersRemaining);

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      matches.push({
        tournament: tournamentId,
        roundIndex,
        matchIndex,
        roundLabel,
      });
    }
  }

  await TournamentMatch.insertMany(matches);
};

const syncTournamentLifecycle = async (tournamentId) => {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return null;

  const playerCount = await TournamentProgress.countDocuments({
    tournament: tournamentId,
  });

  if (tournament.status === "upcoming" && playerCount === tournament.playerLimit) {
    tournament.status = "ongoing";
    tournament.startedAt = tournament.startedAt || new Date();
    tournament.currentRound = 0;
    await tournament.save();
  }

  return tournament;
};

exports.createTournament = async (req, res) => {
  try {
    const { title, playerLimit, prizePool } = req.body;
    const limit = Number(playerLimit);
    const prize = Number(prizePool);

    if (!title || !isPowerOfTwo(limit)) {
      return res.status(400).json({
        message: "Title is required and playerLimit must be a power of two of 4 or greater.",
      });
    }

    const tournament = await Tournament.create({
      title,
      playerLimit: limit,
      prizePool: Number.isFinite(prize) ? prize : 0,
      createdBy: req.user.id,
      status: "upcoming",
      currentRound: 0,
    });

    await createBracketSkeleton(tournament._id, limit);

    const state = await buildState(tournament._id);
    res.status(201).json(state);
  } catch (error) {
    console.error("Create tournament error:", error);
    res.status(500).json({ message: "Failed to create tournament" });
  }
};

exports.startTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    if (tournament.status === "finished") {
      const state = await buildState(tournament._id);
      return res.json(state);
    }

    const playerCount = await TournamentProgress.countDocuments({ tournament: tournament._id });
    if (playerCount === 0) {
      return res.status(400).json({ message: "Add at least one participant before starting the tournament." });
    }

    // Allow starting with partial players - empty slots will auto-win with x0
    tournament.status = "ongoing";
    tournament.startedAt = tournament.startedAt || new Date();
    tournament.currentRound = 0;
    await tournament.save();

    const state = await buildState(tournament._id);
    res.json(state);
  } catch (error) {
    console.error("Start tournament error:", error);
    res.status(500).json({ message: "Failed to start tournament" });
  }
};

exports.getCurrentTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findOne().sort({ createdAt: -1 }).lean();
    if (!tournament) {
      return res.json({ tournament: null, matches: [], players: [], availablePositions: [], totalRounds: 0 });
    }

    const state = await buildState(tournament._id);
    res.json(state);
  } catch (error) {
    console.error("Get current tournament error:", error);
    res.status(500).json({ message: "Failed to load tournament" });
  }
};

exports.getTournamentState = async (req, res) => {
  try {
    const state = await buildState(req.params.id);
    if (!state) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    res.json(state);
  } catch (error) {
    console.error("Get tournament state error:", error);
    res.status(500).json({ message: "Failed to load tournament state" });
  }
};

exports.getMyProgress = async (req, res) => {
  try {
    const progress = await TournamentProgress.findOne({
      tournament: req.params.id,
      user: req.user.id,
    })
      .populate("lastMatch")
      .lean();

    res.json({ progress: progress || null });
  } catch (error) {
    console.error("Get my progress error:", error);
    res.status(500).json({ message: "Failed to load player progress" });
  }
};

exports.joinTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    if (tournament.status !== "upcoming") {
      return res.status(400).json({ message: "Tournament already started." });
    }

    const position = Number(req.body.position);
    if (!Number.isInteger(position) || position < 1 || position > tournament.playerLimit) {
      return res.status(400).json({ message: "Pick a valid bracket position." });
    }

    const taken = await TournamentProgress.findOne({ tournament: tournament._id, position });
    if (taken) {
      return res.status(400).json({ message: "That position is already taken." });
    }

    const existing = await TournamentProgress.findOne({
      tournament: tournament._id,
      user: req.user.id,
    });

    if (existing) {
      return res.status(400).json({ message: "You are already in this tournament." });
    }

    const progress = await TournamentProgress.create({
      tournament: tournament._id,
      user: req.user.id,
      username: req.user.kickUsername,
      position,
      currentRound: 0,
      status: "active",
    });

    const firstMatchIndex = Math.floor((position - 1) / 2);
    const match = await TournamentMatch.findOne({
      tournament: tournament._id,
      roundIndex: 0,
      matchIndex: firstMatchIndex,
    });

    if (!match) {
      return res.status(500).json({ message: "Bracket generation failed." });
    }

    if (position % 2 === 1) {
      match.playerA = progress._id;
    } else {
      match.playerB = progress._id;
    }

    if (match.playerA && match.playerB) {
      match.status = "ready";
    }

    await match.save();
    await syncTournamentLifecycle(tournament._id);

    // Award join points (small reward for joining)
    try {
      await awardPoints(progress.user, 10, 'tournament-join', { tournament: tournament._id });
    } catch (e) {
      console.error('Failed to award join points:', e);
    }

    const state = await buildState(tournament._id);
    res.status(201).json({ progress, state });
  } catch (error) {
    console.error("Join tournament error:", error);
    res.status(500).json({ message: "Failed to join tournament" });
  }
};

exports.selectSlot = async (req, res) => {
  try {
    const { roundIndex, slotId, slotName, provider, image, url } = req.body;
    const round = Number(roundIndex);

    if (!slotId || !slotName || !Number.isInteger(round)) {
      return res.status(400).json({ message: "Round and slot details are required." });
    }

    const progress = await TournamentProgress.findOne({
      tournament: req.params.id,
      user: req.user.id,
    });

    if (!progress) {
      return res.status(404).json({ message: "You are not in this tournament." });
    }

    if (progress.status !== "active") {
      return res.status(400).json({ message: "You cannot pick slots after elimination." });
    }

    if (progress.currentRound !== round) {
      return res.status(400).json({ message: "That round is not unlocked yet." });
    }

    const alreadySelected = progress.slotSelections.some(
      (selection) => selection.roundIndex === round
    );

    if (alreadySelected) {
      return res.status(400).json({ message: "This round's slot is locked." });
    }

    progress.slotSelections.push({
      roundIndex: round,
      slotId,
      slotName,
      provider,
      image,
      url,
      locked: true,
      selectedAt: new Date(),
    });

    await progress.save();
    res.json({ progress });
  } catch (error) {
    console.error("Select slot error:", error);
    res.status(500).json({ message: "Failed to save slot selection" });
  }
};

exports.submitMatchResult = async (req, res) => {
  try {
    const {
      betSizeA,
      payoutA,
      betSizeB,
      payoutB,
      winnerParticipantId,
    } = req.body;
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    const match = await TournamentMatch.findById(req.params.matchId)
      .populate("playerA")
      .populate("playerB");

    if (!match || String(match.tournament) !== String(tournament._id)) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (match.status === "completed") {
      return res.status(400).json({ message: "Match already completed." });
    }

    // Allow matches with only one player (the other gets x0 auto-bye)
    const hasPlayerA = !!match.playerA;
    const hasPlayerB = !!match.playerB;

    if (!hasPlayerA && !hasPlayerB) {
      return res.status(400).json({ message: "At least one player must be assigned before submitting a result." });
    }

    const parsedBetSizeA = Number(betSizeA);
    const parsedPayoutA = Number(payoutA);
    const parsedBetSizeB = Number(betSizeB);
    const parsedPayoutB = Number(payoutB);

    // For bye matches (no opponent), absent player gets x0
    let scoreA, scoreB;
    
    if (hasPlayerA && hasPlayerB) {
      // Both players present - require full result
      scoreA = parsedBetSizeA > 0 ? parsedPayoutA / parsedBetSizeA : Number.NaN;
      scoreB = parsedBetSizeB > 0 ? parsedPayoutB / parsedBetSizeB : Number.NaN;

      if (
        !Number.isFinite(parsedBetSizeA) ||
        !Number.isFinite(parsedPayoutA) ||
        !Number.isFinite(parsedBetSizeB) ||
        !Number.isFinite(parsedPayoutB) ||
        parsedBetSizeA <= 0 ||
        parsedBetSizeB <= 0 ||
        parsedPayoutA < 0 ||
        parsedPayoutB < 0 ||
        !Number.isFinite(scoreA) ||
        !Number.isFinite(scoreB)
      ) {
        return res.status(400).json({ message: "Bet size and payout are required for both players." });
      }
    } else if (hasPlayerA && !hasPlayerB) {
      // Only player A - check player A's data, auto x0 for player B
      if (!Number.isFinite(parsedBetSizeA) || !Number.isFinite(parsedPayoutA) || parsedBetSizeA <= 0) {
        return res.status(400).json({ message: "Bet size and payout are required for the present player." });
      }
      scoreA = parsedPayoutA / parsedBetSizeA;
      scoreB = 0; // Bye - auto x0
      // Set defaults for missing player data
      match.betSizeB = parsedBetSizeA;
      match.payoutB = 0;
    } else {
      // Only player B - check player B's data, auto x0 for player A
      if (!Number.isFinite(parsedBetSizeB) || !Number.isFinite(parsedPayoutB) || parsedBetSizeB <= 0) {
        return res.status(400).json({ message: "Bet size and payout are required for the present player." });
      }
      scoreB = parsedPayoutB / parsedBetSizeB;
      scoreA = 0; // Bye - auto x0
      // Set defaults for missing player data
      match.betSizeA = parsedBetSizeB;
      match.payoutA = 0;
    }

    let winnerProgressId = winnerParticipantId || null;
    if (!winnerProgressId) {
      if (!hasPlayerA && !hasPlayerB) {
        return res.status(400).json({ message: "Cannot determine winner when no players are present." });
      }
      if (scoreA === scoreB && hasPlayerA && hasPlayerB) {
        return res.status(400).json({ message: "Calculated multipliers cannot tie. Adjust the bet size or payout." });
      }
      // If only one player, they auto-win. Otherwise, higher score wins.
      if (hasPlayerA && !hasPlayerB) {
        winnerProgressId = match.playerA._id;
      } else if (!hasPlayerA && hasPlayerB) {
        winnerProgressId = match.playerB._id;
      } else {
        winnerProgressId = scoreA > scoreB ? match.playerA._id : match.playerB._id;
      }
    }

    if (hasPlayerA && hasPlayerB) {
      if (
        String(winnerProgressId) !== String(match.playerA._id) &&
        String(winnerProgressId) !== String(match.playerB._id)
      ) {
        return res.status(400).json({ message: "Winner must be one of the match participants." });
      }
    } else if (hasPlayerA) {
      if (String(winnerProgressId) !== String(match.playerA._id)) {
        return res.status(400).json({ message: "Winner must be player A (the only present player)." });
      }
    } else {
      if (String(winnerProgressId) !== String(match.playerB._id)) {
        return res.status(400).json({ message: "Winner must be player B (the only present player)." });
      }
    }

    match.betSizeA = match.betSizeA !== undefined ? match.betSizeA : parsedBetSizeA;
    match.payoutA = match.payoutA !== undefined ? match.payoutA : parsedPayoutA;
    match.betSizeB = match.betSizeB !== undefined ? match.betSizeB : parsedBetSizeB;
    match.payoutB = match.payoutB !== undefined ? match.payoutB : parsedPayoutB;
    match.multiplierA = scoreA;
    match.multiplierB = scoreB;
    match.winner = winnerProgressId;
    match.status = "completed";
    await match.save();

    const totalRounds = getTotalRounds(tournament.playerLimit);
    const loserProgressId = hasPlayerA && hasPlayerB
      ? (String(winnerProgressId) === String(match.playerA._id) ? match.playerB._id : match.playerA._id)
      : (hasPlayerA ? match.playerB?._id : match.playerA?._id);

    // Award match-win points to the winner (small amount), and if final, award tournament-win bonus
    try {
      await awardPoints(winnerProgressId, 5, 'tournament-match-win', { tournament: tournament._id, match: match._id });
      if (match.roundIndex === totalRounds - 1) {
        await awardPoints(winnerProgressId, 500, 'tournament-win', { tournament: tournament._id });
      }
    } catch (e) {
      console.error('Failed to award tournament points:', e);
    }

    const winnerUpdate = {
      status: match.roundIndex === totalRounds - 1 ? "winner" : "active",
      currentRound:
        match.roundIndex === totalRounds - 1
          ? totalRounds
          : match.roundIndex + 1,
      lastMatch: match._id,
    };

    await TournamentProgress.findByIdAndUpdate(winnerProgressId, winnerUpdate);

    // Only update loser if they exist (not a bye match)
    if (loserProgressId) {
      await TournamentProgress.findByIdAndUpdate(loserProgressId, {
        status: "eliminated",
        eliminatedRound: match.roundIndex,
        eliminatedMatch: match._id,
        lastMatch: match._id,
      });
    }

    if (match.roundIndex === totalRounds - 1) {
      tournament.status = "finished";
      tournament.finishedAt = new Date();
      tournament.currentRound = totalRounds;
      await tournament.save();
      const state = await buildState(tournament._id);
      return res.json({ match, state });
    }

    const nextRoundIndex = match.roundIndex + 1;
    const nextMatchIndex = Math.floor(match.matchIndex / 2);
    const nextSlot = match.matchIndex % 2 === 0 ? "playerA" : "playerB";

    const nextMatch = await TournamentMatch.findOne({
      tournament: tournament._id,
      roundIndex: nextRoundIndex,
      matchIndex: nextMatchIndex,
    });

    if (!nextMatch) {
      return res.status(500).json({ message: "Unable to locate the next match." });
    }

    if (nextMatch[nextSlot] && String(nextMatch[nextSlot]) !== String(winnerProgressId)) {
      return res.status(400).json({ message: "Next round slot is already occupied." });
    }

    nextMatch[nextSlot] = winnerProgressId;
    if (nextMatch.playerA && nextMatch.playerB) {
      nextMatch.status = "ready";
    }

    await nextMatch.save();
    tournament.currentRound = nextRoundIndex;
    await tournament.save();

    const state = await buildState(tournament._id);
    res.json({ match, nextMatch, state });
  } catch (error) {
    console.error("Submit match result error:", error);
    res.status(500).json({ message: "Failed to submit result" });
  }
};

exports.searchSlots = async (req, res) => {
  try {
    const query = req.query.q || "";
    const site = req.query.site || "Stake";
    const url = `https://bonushunt.gg/api/slots?q=${encodeURIComponent(
      query
    )}&site=${encodeURIComponent(site)}`;

    const { data } = await axios.get(url, { timeout: 15000 });
    const slots = Array.isArray(data)
      ? data
      : data?.results || data?.slots || data?.data || [];

    res.json(slots);
  } catch (error) {
    console.error("Slot search error:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to search slots" });
  }
};

exports.removeParticipant = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    const progress = await TournamentProgress.findById(req.params.participantId);
    if (!progress || String(progress.tournament) !== String(tournament._id)) {
      return res.status(404).json({ message: "Participant not found in tournament" });
    }

    // Find and update all matches involving this participant
    const matches = await TournamentMatch.find({ tournament: tournament._id });
    for (const match of matches) {
      let wasInMatch = false;
      if (String(match.playerA) === String(progress._id)) {
        match.playerA = null;
        wasInMatch = true;
      }
      if (String(match.playerB) === String(progress._id)) {
        match.playerB = null;
        wasInMatch = true;
      }
      if (wasInMatch) {
        match.status = match.playerA && match.playerB ? "ready" : "waiting";
        match.winner = null;
        await match.save();
      }
    }

    // Delete the participant
    await TournamentProgress.findByIdAndDelete(req.params.participantId);

    // Rebuild tournament state
    const state = await buildState(tournament._id);
    res.json({ ok: true, state });
  } catch (error) {
    console.error("Remove participant error:", error);
    res.status(500).json({ message: "Failed to remove participant" });
  }
};
