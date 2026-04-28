// leaderboardTest.js
async function fetchLeaderboard() {
	try {
		const params = new URLSearchParams({
			code: "mistertee",
			gt: new Date("2025").getTime(),
			lt: Date.now(),
			by: "wager",
			sort: "desc",
			search: "",
			take: 10,
			skip: 0,
		});

		const url = `https://api.csgowin.com/api/affiliate/external?${params}`;
		console.log("Fetching URL:", url);

		const response = await fetch(url, {
			headers: {
				"x-apikey": "108adfb76a",
			},
		});

		console.log("HTTP status:", response.status);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		console.log("Leaderboard data:", data);
	} catch (error) {
		console.error("Error fetching leaderboard:", error.message);
	}
}

fetchLeaderboard();
