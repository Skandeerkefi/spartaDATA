const express = require("express");
const router = express.Router();

const tournamentController = require("../controllers/tournamentController");
const { verifyToken, isAdmin } = require("../middleware/auth");

router.get("/current", tournamentController.getCurrentTournament);
router.get("/:id/bets/summary", tournamentController.getBetSummary);
router.get("/slots/search", tournamentController.searchSlots);
router.get("/:id/bets/me", verifyToken, tournamentController.getMyBet);
router.get("/:id", tournamentController.getTournamentState);
router.get("/:id/me", verifyToken, tournamentController.getMyProgress);

router.post("/", verifyToken, isAdmin, tournamentController.createTournament);
router.post("/:id/start", verifyToken, isAdmin, tournamentController.startTournament);
router.post("/:id/toggle-bets", verifyToken, isAdmin, tournamentController.toggleBetsOpen);
router.post("/:id/join", verifyToken, tournamentController.joinTournament);
router.post("/:id/bets", verifyToken, tournamentController.placeBet);
router.post("/:id/slot-selection", verifyToken, tournamentController.selectSlot);
router.post("/:id/process-bye", verifyToken, isAdmin, tournamentController.processBye);
router.post(
  "/:id/matches/:matchId/result",
  verifyToken,
  isAdmin,
  tournamentController.submitMatchResult
);

router.delete(
  "/:id/participants/:participantId",
  verifyToken,
  isAdmin,
  tournamentController.removeParticipant
);

module.exports = router;
