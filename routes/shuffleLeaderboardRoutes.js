const express = require("express");
const router = express.Router();
const controller = require("../controllers/shuffleLeaderboardController");

router.get("/active", controller.getActiveLeaderboard);
router.get("/", controller.listLeaderboards);
router.post("/", controller.createLeaderboard);
router.get("/:id", controller.getLeaderboardById);
router.put("/:id", controller.updateLeaderboard);
router.delete("/:id", controller.deleteLeaderboard);
router.post("/:id/entries", controller.addEntry);
router.put("/:id/entries/:entryId", controller.updateEntry);
router.delete("/:id/entries/:entryId", controller.deleteEntry);

module.exports = router;