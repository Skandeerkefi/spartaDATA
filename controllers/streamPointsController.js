const axios = require('axios');
const mongoose = require('mongoose');
const { User } = require('../models/User');
const PointsTransaction = require('../models/PointsTransaction');
const pointsConfigController = require('./pointsConfigController');

const STREAM_LEADERBOARD_URL = process.env.STREAM_LEADERBOARD_URL || 'https://botrix.live/api/public/leaderboard';
const STREAM_PLATFORM = process.env.STREAM_PLATFORM || 'kick';
const STREAM_SOURCE_USER = process.env.STREAM_LEADERBOARD_USER || process.env.STREAM_SEARCH || 'spartaaan';

function normalizeUsername(value) {
	return String(value || '').trim().toLowerCase();
}

function toNumber(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function buildSearchParams(userName) {
	const params = {
		platform: STREAM_PLATFORM,
		user: STREAM_SOURCE_USER,
	};

	if (userName) {
		params.search = normalizeUsername(userName);
	}

	return params;
}

async function fetchStreamLeaderboard(searchTerm) {
	const { data } = await axios.get(STREAM_LEADERBOARD_URL, {
		params: buildSearchParams(searchTerm),
		timeout: 15000,
	});

	const candidates = Array.isArray(data)
		? data
		: Array.isArray(data?.data)
			? data.data
			: Array.isArray(data?.results)
				? data.results
				: Array.isArray(data?.leaderboard)
					? data.leaderboard
					: [];

	return candidates;
}

function pickUserRow(rows, kickUsername) {
	const target = normalizeUsername(kickUsername);
	if (!target) return null;

	return rows.find((row) => {
		const rowName = normalizeUsername(
			row?.kickUsername || row?.username || row?.name || row?.user || row?.displayName
		);
		return rowName === target;
	});
}

function extractStreamStats(row) {
	return {
		watchtime: toNumber(
			row?.watchtime ?? row?.watchTime ?? row?.watch_time ?? row?.watch_time_minutes ?? row?.totalWatchtime
		),
		level: toNumber(row?.level ?? row?.rankLevel ?? row?.rank_level),
		name: normalizeUsername(row?.name || row?.username || row?.kickUsername || row?.displayName || ''),
	};
}

async function applyUserStreamDelta(user, currentStats, options = {}) {
	const { seedOnly = false, session = null, source = 'stream-leaderboard-sync' } = options;
	const baseline = user.streamPointsBaseline || {};
	const previousSnapshot = user.streamPointsCurrent || baseline || {};
	const previousWatchtime = toNumber(previousSnapshot.watchtime);
	const previousLevel = toNumber(previousSnapshot.level);

	const currentWatchtime = toNumber(currentStats.watchtime);
	const currentLevel = toNumber(currentStats.level);

	const watchtimeDelta = Math.max(0, currentWatchtime - previousWatchtime);
	const levelDelta = Math.max(0, currentLevel - previousLevel);
	const watchtimePoints = Math.floor(watchtimeDelta / 2) * await pointsConfigController.getPointsForAction('stream-watchtime');
	const levelPoints = levelDelta * await pointsConfigController.getPointsForAction('stream-level');
	const totalPoints = seedOnly ? 0 : watchtimePoints + levelPoints;

	if (!baseline.updatedAt) {
		user.streamPointsBaseline = {
			watchtime: currentWatchtime,
			level: currentLevel,
			name: currentStats.name,
			updatedAt: new Date(),
		};
	}

	user.streamPointsCurrent = {
		watchtime: currentWatchtime,
		level: currentLevel,
		name: currentStats.name,
		updatedAt: new Date(),
	};
	user.streamPointsTotals = {
		watchtime: (user.streamPointsTotals?.watchtime || 0) + watchtimeDelta,
		level: (user.streamPointsTotals?.level || 0) + levelDelta,
	};

	if (totalPoints > 0) {
		user.pointsBalance = (user.pointsBalance || 0) + totalPoints;
	}

	await user.save(session ? { session } : undefined);

	if (!seedOnly && totalPoints > 0) {
		await PointsTransaction.create([
			{
				user: user._id,
				amount: totalPoints,
				type: 'admin-adjust',
				meta: {
					source,
					stream: {
						name: currentStats.name,
						watchtimeDelta,
						levelDelta,
						currentWatchtime,
						currentLevel,
						watchtimePoints,
						levelPoints,
					},
				},
			},
		], session ? { session } : undefined);
	}

	return {
		seeded: seedOnly,
		appliedPoints: totalPoints,
		watchtimeDelta,
		levelDelta,
		watchtimePoints,
		levelPoints,
		baseline: user.streamPointsBaseline,
		current: user.streamPointsCurrent,
	};
}

exports.syncStreamPoints = async (req, res) => {
	try {
		const onlyUserId = req.body?.onlyUserId || req.query?.onlyUserId || null;
		const dryRun = req.body?.dryRun === true || req.query?.dryRun === 'true';
		const limit = Math.min(Math.max(Number(req.body?.limit || req.query?.limit || 500), 1), 5000);

		const usersFilter = onlyUserId ? { _id: onlyUserId } : {};
		const users = await User.find(usersFilter, {
			kickUsername: 1,
			streamPointsBaseline: 1,
			streamPointsCurrent: 1,
			streamPointsTotals: 1,
			pointsBalance: 1,
		})
			.sort({ kickUsername: 1 })
			.limit(limit)
			.lean();

		if (users.length === 0) {
			return res.json({ ok: true, processed: 0, seeded: 0, updated: 0, changes: [] });
		}

		const changes = [];
		let seeded = 0;
		let updated = 0;

		for (const user of users) {
			const leaderboardRows = await fetchStreamLeaderboard(user.kickUsername);
			const row = pickUserRow(leaderboardRows, user.kickUsername);

			if (!row) {
				changes.push({ userId: user._id, kickUsername: user.kickUsername, matched: false });
				continue;
			}

			const stats = extractStreamStats(row);
			const hasBaseline = Boolean(user.streamPointsBaseline?.updatedAt);
			if (!hasBaseline) seeded += 1;
			else updated += 1;

			if (!dryRun) {
				const session = await mongoose.startSession();
				session.startTransaction();
				try {
					const freshUser = await User.findById(user._id).session(session);
					if (!freshUser) {
						await session.abortTransaction();
						session.endSession();
						continue;
					}

					const result = await applyUserStreamDelta(freshUser, stats, {
						seedOnly: !hasBaseline,
						session,
					});

					await session.commitTransaction();
					session.endSession();
					changes.push({ userId: user._id, kickUsername: user.kickUsername, matched: true, ...result });
				} catch (err) {
					await session.abortTransaction();
					session.endSession();
					throw err;
				}
			} else {
				const watchtimePointsPer2 = await pointsConfigController.getPointsForAction('stream-watchtime');
				const levelPointsPerLevel = await pointsConfigController.getPointsForAction('stream-level');
				changes.push({
					userId: user._id,
					kickUsername: user.kickUsername,
					matched: true,
					seeded: !hasBaseline,
					appliedPoints: hasBaseline ? Math.max(0, Math.floor(Math.max(0, stats.watchtime - toNumber((user.streamPointsCurrent || user.streamPointsBaseline)?.watchtime)) / 2) * watchtimePointsPer2) + Math.max(0, stats.level - toNumber((user.streamPointsCurrent || user.streamPointsBaseline)?.level)) * levelPointsPerLevel : 0,
					baseline: {
						watchtime: stats.watchtime,
						level: stats.level,
						name: stats.name,
					},
					current: {
						watchtime: stats.watchtime,
						level: stats.level,
						name: stats.name,
					},
				});
			}
		}

		return res.json({
			ok: true,
			processed: users.length,
			seeded,
			updated,
			changes,
		});
	} catch (err) {
		console.error('syncStreamPoints error:', err.response?.data || err.message);
		return res.status(500).json({
			error: 'Failed to sync stream points',
			details: err.response?.data || err.message,
		});
	}
};

exports.listStreamUsers = async (req, res) => {
	try {
		const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 5000);
		const users = await User.find({}, {
			kickUsername: 1,
			streamPointsBaseline: 1,
			streamPointsCurrent: 1,
			streamPointsTotals: 1,
			pointsBalance: 1,
		})
			.sort({ kickUsername: 1 })
			.limit(limit)
			.lean();

		const rows = await Promise.all(users.map(async (user) => {
			const baseline = user.streamPointsBaseline || {};
			const current = user.streamPointsCurrent || baseline || {};
			const watchtimeDelta = Math.max(0, toNumber(current.watchtime) - toNumber(baseline.watchtime));
			const levelDelta = Math.max(0, toNumber(current.level) - toNumber(baseline.level));
			const watchtimePointsPer2 = await pointsConfigController.getPointsForAction('stream-watchtime');
			const levelPointsPerLevel = await pointsConfigController.getPointsForAction('stream-level');
			return {
				userId: user._id,
				kickUsername: user.kickUsername,
				baseline: {
					watchtime: toNumber(baseline.watchtime),
					level: toNumber(baseline.level),
					name: baseline.name || '',
					updatedAt: baseline.updatedAt || null,
				},
				current: {
					watchtime: toNumber(current.watchtime),
					level: toNumber(current.level),
					name: current.name || '',
					updatedAt: current.updatedAt || null,
				},
				watchtimeDelta,
				levelDelta,
				watchtimePoints: Math.floor(watchtimeDelta / 2) * watchtimePointsPer2,
				levelPoints: levelDelta * levelPointsPerLevel,
				streamPointsTotals: user.streamPointsTotals || { watchtime: 0, level: 0 },
				pointsBalance: Number(user.pointsBalance || 0),
			};
		}));

		res.json({ ok: true, rows });
	} catch (err) {
		console.error('listStreamUsers error:', err);
		res.status(500).json({ error: 'Failed to list stream users' });
	}
};
