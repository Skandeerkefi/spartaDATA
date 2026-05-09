const ShuffleLeaderboard = require("../models/ShuffleLeaderboard");

function toNumber(value, fallback = 0) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function toDate(value) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function parsePrizeSplit(value) {
	if (Array.isArray(value)) {
		return value.map((item) => toNumber(item)).filter((item) => item > 0);
	}

	if (typeof value === "string") {
		return value
			.split(",")
			.map((item) => toNumber(item.trim()))
			.filter((item) => item > 0);
	}

	return [];
}

function leaderboardTotals(entries) {
	return entries.reduce(
		(accumulator, entry) => {
			accumulator.totalWagering += toNumber(entry.wagering);
			accumulator.totalPrize += toNumber(entry.prize);
			return accumulator;
		},
		{ totalWagering: 0, totalPrize: 0 }
	);
}

function serializeLeaderboard(doc) {
	if (!doc) return null;

	const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
	const prizeSplit = Array.isArray(plain.prizeSplit) ? plain.prizeSplit.map((value) => toNumber(value)) : [];
	const sortedEntries = [...(plain.entries || [])].sort((left, right) => {
		const wageringDiff = toNumber(right.wagering) - toNumber(left.wagering);
		if (wageringDiff !== 0) return wageringDiff;
		return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
	});
	const totals = leaderboardTotals(sortedEntries);

	return {
		...plain,
		prizeSplit,
		entries: sortedEntries.map((entry, index) => ({
			...entry,
			prize: prizeSplit[index] ?? toNumber(entry.prize),
			rank: index + 1,
		})),
		...totals,
		totalPrize: toNumber(plain.totalPrize) || totals.totalPrize,
	};
}

async function findLeaderboardOr404(id, res) {
	const leaderboard = await ShuffleLeaderboard.findById(id);
	if (!leaderboard) {
		res.status(404).json({ error: "Leaderboard not found" });
		return null;
	}
	return leaderboard;
}

exports.listLeaderboards = async (req, res) => {
	try {
		const leaderboards = await ShuffleLeaderboard.find({})
			.sort({ active: -1, startDate: -1, createdAt: -1 })
			.lean();

		res.json(leaderboards.map(serializeLeaderboard));
	} catch (error) {
		console.error("Error listing shuffle leaderboards:", error);
		res.status(500).json({ error: "Failed to list leaderboards" });
	}
};

exports.getActiveLeaderboard = async (req, res) => {
	try {
		const leaderboard = await ShuffleLeaderboard.findOne({ active: true })
			.sort({ startDate: -1, createdAt: -1 });

		if (!leaderboard) {
			const fallback = await ShuffleLeaderboard.findOne({})
				.sort({ startDate: -1, createdAt: -1 });
			return res.json(fallback ? serializeLeaderboard(fallback) : null);
		}

		res.json(serializeLeaderboard(leaderboard));
	} catch (error) {
		console.error("Error fetching active shuffle leaderboard:", error);
		res.status(500).json({ error: "Failed to fetch leaderboard" });
	}
};

exports.getLeaderboardById = async (req, res) => {
	try {
		const leaderboard = await findLeaderboardOr404(req.params.id, res);
		if (!leaderboard) return;
		res.json(serializeLeaderboard(leaderboard));
	} catch (error) {
		console.error("Error fetching shuffle leaderboard:", error);
		res.status(500).json({ error: "Failed to fetch leaderboard" });
	}
};

exports.createLeaderboard = async (req, res) => {
	try {
		const { title, startDate, endDate, totalPrize, prizeSplit, active = true } = req.body || {};
		const parsedStartDate = toDate(startDate);
		const parsedEndDate = toDate(endDate);
		const parsedTotalPrize = toNumber(totalPrize);
		const parsedPrizeSplit = parsePrizeSplit(prizeSplit);

		if (!title || !String(title).trim()) {
			return res.status(400).json({ error: "Missing title" });
		}
		if (!parsedStartDate) {
			return res.status(400).json({ error: "Missing or invalid startDate" });
		}
		if (!parsedEndDate) {
			return res.status(400).json({ error: "Missing or invalid endDate" });
		}
		if (parsedEndDate < parsedStartDate) {
			return res.status(400).json({ error: "endDate must be after startDate" });
		}

		if (active) {
			await ShuffleLeaderboard.updateMany({}, { $set: { active: false } });
		}

		const leaderboard = await ShuffleLeaderboard.create({
			title: String(title).trim(),
			startDate: parsedStartDate,
			endDate: parsedEndDate,
			totalPrize: parsedTotalPrize,
			prizeSplit: parsedPrizeSplit,
			active: Boolean(active),
			entries: [],
		});

		res.status(201).json(serializeLeaderboard(leaderboard));
	} catch (error) {
		console.error("Error creating shuffle leaderboard:", error);
		res.status(500).json({ error: "Failed to create leaderboard" });
	}
};

exports.updateLeaderboard = async (req, res) => {
	try {
		const leaderboard = await findLeaderboardOr404(req.params.id, res);
		if (!leaderboard) return;

		const { title, startDate, endDate, active } = req.body || {};
		const { totalPrize, prizeSplit } = req.body || {};
		if (title !== undefined) leaderboard.title = String(title).trim() || leaderboard.title;

		const parsedStartDate = startDate !== undefined ? toDate(startDate) : null;
		const parsedEndDate = endDate !== undefined ? toDate(endDate) : null;
		if (startDate !== undefined && !parsedStartDate) {
			return res.status(400).json({ error: "Missing or invalid startDate" });
		}
		if (endDate !== undefined && !parsedEndDate) {
			return res.status(400).json({ error: "Missing or invalid endDate" });
		}

		if (parsedStartDate) leaderboard.startDate = parsedStartDate;
		if (parsedEndDate) leaderboard.endDate = parsedEndDate;
		if (leaderboard.endDate < leaderboard.startDate) {
			return res.status(400).json({ error: "endDate must be after startDate" });
		}

		if (totalPrize !== undefined) leaderboard.totalPrize = toNumber(totalPrize, leaderboard.totalPrize);
		if (prizeSplit !== undefined) leaderboard.prizeSplit = parsePrizeSplit(prizeSplit);

		if (active !== undefined) {
			leaderboard.active = Boolean(active);
			if (leaderboard.active) {
				await ShuffleLeaderboard.updateMany({ _id: { $ne: leaderboard._id } }, { $set: { active: false } });
			}
		}

		await leaderboard.save();
		res.json(serializeLeaderboard(leaderboard));
	} catch (error) {
		console.error("Error updating shuffle leaderboard:", error);
		res.status(500).json({ error: "Failed to update leaderboard" });
	}
};

exports.deleteLeaderboard = async (req, res) => {
	try {
		const leaderboard = await findLeaderboardOr404(req.params.id, res);
		if (!leaderboard) return;

		await leaderboard.deleteOne();
		res.json({ ok: true });
	} catch (error) {
		console.error("Error deleting shuffle leaderboard:", error);
		res.status(500).json({ error: "Failed to delete leaderboard" });
	}
};

exports.addEntry = async (req, res) => {
	try {
		const leaderboard = await findLeaderboardOr404(req.params.id, res);
		if (!leaderboard) return;

		const { username, wagering = 0, prize = 0 } = req.body || {};
		if (!username || !String(username).trim()) {
			return res.status(400).json({ error: "Missing username" });
		}

		leaderboard.entries.push({
			username: String(username).trim(),
			wagering: toNumber(wagering),
			prize: toNumber(prize),
		});

		await leaderboard.save();
		res.status(201).json(serializeLeaderboard(leaderboard));
	} catch (error) {
		console.error("Error adding shuffle leaderboard entry:", error);
		res.status(500).json({ error: "Failed to add entry" });
	}
};

exports.updateEntry = async (req, res) => {
	try {
		const leaderboard = await findLeaderboardOr404(req.params.id, res);
		if (!leaderboard) return;

		const entry = leaderboard.entries.id(req.params.entryId);
		if (!entry) {
			return res.status(404).json({ error: "Entry not found" });
		}

		const { username, wagering, prize } = req.body || {};
		if (username !== undefined) entry.username = String(username).trim() || entry.username;
		if (wagering !== undefined) entry.wagering = toNumber(wagering, entry.wagering);
		if (prize !== undefined) entry.prize = toNumber(prize, entry.prize);

		await leaderboard.save();
		res.json(serializeLeaderboard(leaderboard));
	} catch (error) {
		console.error("Error updating shuffle leaderboard entry:", error);
		res.status(500).json({ error: "Failed to update entry" });
	}
};

exports.deleteEntry = async (req, res) => {
	try {
		const leaderboard = await findLeaderboardOr404(req.params.id, res);
		if (!leaderboard) return;

		const entry = leaderboard.entries.id(req.params.entryId);
		if (!entry) {
			return res.status(404).json({ error: "Entry not found" });
		}

		entry.deleteOne();
		await leaderboard.save();
		res.json(serializeLeaderboard(leaderboard));
	} catch (error) {
		console.error("Error deleting shuffle leaderboard entry:", error);
		res.status(500).json({ error: "Failed to delete entry" });
	}
};