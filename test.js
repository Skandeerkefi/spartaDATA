// testLeaderboard.js

const apikey = "108adfb76a"; // 🔑 replace with your API key

async function testLeaderboard() {
	try {
		// Leaderboard parameters
		const params = new URLSearchParams({
			code: "mistertee", // your affiliate code
			by: "wager", // sort/filter option
			sort: "desc", // descending order
			take: 10, // number of results
			skip: 0, // pagination offset
		});

		const url = `https://csgowin.com/api/affiliate/external?${params.toString()}`;
		console.log("Fetching leaderboard from:", url);

		const res = await fetch(url, {
			headers: {
				"x-apikey": apikey,
			},
		});

		if (!res.ok) {
			throw new Error(`❌ HTTP Error ${res.status} - ${res.statusText}`);
		}

		const data = await res.json();
		console.log("✅ Leaderboard data:");
		console.table(data);
	} catch (err) {
		console.error("🚨 Error fetching leaderboard:", err);
	}
}

// Run the test
testLeaderboard();
