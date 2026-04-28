const axios = require("axios");

// Helper function to blur usernames
function blurUsername(username) {
  if (!username || username.length <= 2) return "***";
  const firstChar = username.charAt(0);
  const lastChar = username.charAt(username.length - 1);
  const blurredPart = "*".repeat(Math.max(0, username.length - 2));
  return firstChar + blurredPart + lastChar;
}

// Helper function to get start of day in ISO format
function getStartOfDay(dateStr) {
  return new Date(dateStr + "T00:00:00.000Z").toISOString();
}

// Helper function to get end of day in ISO format
function getEndOfDay(dateStr) {
  return new Date(dateStr + "T23:59:59.999Z").toISOString();
}

// Filter out dice from house games
function filterDice(player) {
  if (!player.favoriteGameId) return true; // include if no game info
  return !player.favoriteGameId.includes("housegames:dice");
}

const leaderboardController = {
  getLeaderboard: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const params = {
        userId: process.env.USER_ID,
        categories: "slots,provably fair", // Only Slots & Provably Fair
      };

      if (startDate) params.startDate = getStartOfDay(startDate);
      if (endDate) params.endDate = getEndOfDay(endDate);

      const response = await axios.get(
        `${process.env.API_BASE_URL}/affiliate/v2/stats`,
        {
          params,
          headers: {
            Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
          },
        }
      );

      const processedData = response.data
        .filter(filterDice) // remove dice games
        .map((player) => ({
          uid: player.uid,
          username: blurUsername(player.username),
          wagered: player.wagered,
          weightedWagered: player.weightedWagered,
          favoriteGameId: player.favoriteGameId,
          favoriteGameTitle: player.favoriteGameTitle,
          rankLevel: player.rankLevel,
          rankLevelImage: player.rankLevelImage,
          highestMultiplier: player.highestMultiplier,
        }));

      // Sort by weightedWagered descending
      processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);

      res.json({
        disclosure:
          "Only Slots and Provably Fair (house) games are included. Dice games are excluded.",
        data: processedData,
      });
    } catch (error) {
      console.error("Error fetching leaderboard data:", error.message);
      res.status(500).json({
        error: "Failed to fetch leaderboard data",
        details: error.response?.data || error.message,
      });
    }
  },

  getLeaderboardByDate: async (req, res) => {
    try {
      const { startDate, endDate } = req.params;

      const params = {
        userId: process.env.USER_ID,
        categories: "slots,provably fair",
      };

      if (startDate) params.startDate = getStartOfDay(startDate);
      if (endDate) params.endDate = getEndOfDay(endDate);

      const response = await axios.get(
        `${process.env.API_BASE_URL}/affiliate/v2/stats`,
        {
          params,
          headers: {
            Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
          },
        }
      );

      const processedData = response.data
        .filter(filterDice)
        .map((player) => ({
          uid: player.uid,
          username: blurUsername(player.username),
          wagered: player.wagered,
          weightedWagered: player.weightedWagered,
          favoriteGameId: player.favoriteGameId,
          favoriteGameTitle: player.favoriteGameTitle,
          rankLevel: player.rankLevel,
          rankLevelImage: player.rankLevelImage,
          highestMultiplier: player.highestMultiplier,
        }));

      processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);

      res.json({
        disclosure:
          "Only Slots and Provably Fair (house) games are included. Dice games are excluded.",
        data: processedData,
      });
    } catch (error) {
      console.error("Error fetching leaderboard data:", error.message);
      res.status(500).json({
        error: "Failed to fetch leaderboard data",
        details: error.response?.data || error.message,
      });
    }
  },
};

module.exports = leaderboardController;
