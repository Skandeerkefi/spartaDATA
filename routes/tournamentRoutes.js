const express = require("express");
const router = express.Router();

const tournamentController = require("../controllers/tournamentController");
const { verifyToken, isAdmin } = require("../middleware/auth");

router.get("/current", tournamentController.getCurrentTournament);
router.get("/slots/search", tournamentController.searchSlots);
router.get("/:id", tournamentController.getTournamentState);
router.get("/:id/me", verifyToken, tournamentController.getMyProgress);

router.post("/", verifyToken, isAdmin, tournamentController.createTournament);
router.post("/:id/join", verifyToken, tournamentController.joinTournament);
router.post("/:id/slot-selection", verifyToken, tournamentController.selectSlot);
router.post(
  "/:id/matches/:matchId/result",
  verifyToken,
  isAdmin,
  tournamentController.submitMatchResult
);

module.exports = router;
