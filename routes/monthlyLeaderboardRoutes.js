const express = require("express");
const router = express.Router();
const controller = require("../controllers/monthlyLeaderboardController");
const { verifyToken, isAdmin } = require("../middleware/auth");

// Public: list entries for a month
router.get("/:month/entries", controller.listEntries);
router.get("/:month/prizes", controller.getPrizes);

// Admin: manage entries and prizes
router.post(
  "/:month/entries",
  // verifyToken, isAdmin, // enable if auth available
  controller.createEntry
);
router.put("/entries/:id", /* verifyToken, isAdmin, */ controller.updateEntry);
router.delete("/entries/:id", /* verifyToken, isAdmin, */ controller.deleteEntry);

router.post(
  "/:month/prizes",
  // verifyToken, isAdmin,
  controller.setPrizes
);

router.post(
  "/:month/import-csv",
  // verifyToken, isAdmin,
  controller.importCsvEntries
);

module.exports = router;
