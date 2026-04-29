const express = require("express");
const router = express.Router();

const controller = require("../controllers/bonusHuntController");
const { verifyToken, isAdmin } = require("../middleware/auth");

router.get("/current", controller.getCurrentBonusHunt);
router.get("/history", controller.getBonusHuntHistory);
router.get("/slots/search", controller.searchSlots);
router.get("/:id", controller.getBonusHuntById);

router.post("/", verifyToken, isAdmin, controller.createBonusHunt);
router.post("/:id/start", verifyToken, isAdmin, controller.startBonusHunt);
router.post("/:id/finish", verifyToken, isAdmin, controller.finishBonusHunt);
router.delete("/:id", verifyToken, isAdmin, controller.deleteBonusHunt);

router.post("/:id/games", verifyToken, isAdmin, controller.addGame);
router.patch("/:id/games/:gameId", verifyToken, isAdmin, controller.updateGame);
router.delete("/:id/games/:gameId", verifyToken, isAdmin, controller.deleteGame);
router.post("/:id/games/:gameId/result", verifyToken, isAdmin, controller.updateGameResult);

module.exports = router;
