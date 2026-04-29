const express = require("express");
const {
	createGWS,
	joinGWS,
	updateGWS,
	drawWinner,
	deleteGWS,
	getAllGWS,
} = require("../controllers/gwsController");

const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", getAllGWS);
router.post("/", verifyToken, isAdmin, createGWS);
router.post("/:id/join", verifyToken, joinGWS);
router.patch("/:id", verifyToken, isAdmin, updateGWS);
router.post("/:id/draw", verifyToken, isAdmin, drawWinner);
router.delete("/:id", verifyToken, isAdmin, deleteGWS);

module.exports = router;
