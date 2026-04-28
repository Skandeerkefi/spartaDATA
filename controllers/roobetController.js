const fetch = (...args) =>
	import("node-fetch").then(({ default: fetch }) => fetch(...args));

exports.getRoobetAffiliates = async (req, res) => {
	const { start_at, end_at } = req.query;

	if (!start_at || !end_at) {
		return res
			.status(400)
			.json({ error: "Missing start_at or end_at parameter" });
	}

	const url = `https://affiliate.roobet.com/api/affiliates?start_at=${start_at}&end_at=${end_at}&key=${process.env.ROOBET_API_KEY}`;

	try {
		const response = await fetch(url);
		const content = await response.text();

		if (!response.ok) throw new Error(content);

		res.json(JSON.parse(content));
	} catch (error) {
		console.error("Roobet API error:", error.message);
		res.status(500).json({ error: "Failed to fetch Roobet affiliates data" });
	}
};
