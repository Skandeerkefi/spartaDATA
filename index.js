const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cron = require("node-cron");
const { drawWinnerAuto } = require("./controllers/gwsController"); // You create this
dotenv.config();
const GWS = require("./models/GWS");
const fetch = (...args) =>
	import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = 3000;
const axios = require("axios");
// Schedule job to run every minute
cron.schedule("* * * * *", async () => {
	console.log("Running giveaway auto-draw job...");
	const now = new Date();

	try {
		const giveawaysToDraw = await GWS.find({
			state: "active",
			endTime: { $lte: now },
		}).populate("participants");

		for (const gws of giveawaysToDraw) {
			await drawWinnerAuto(gws); // call the helper above
			console.log(`Giveaway ${gws._id} winner drawn automatically.`);
		}
	} catch (err) {
		console.error("Error during auto draw:", err);
	}
});

// Logging Middleware
app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
	const originalSend = res.send;
	res.send = function (body) {
		console.log(
			`[${new Date().toISOString()}] Response Headers:`,
			res.getHeaders()
		);
		return originalSend.call(this, body);
	};
	next();
});

// CORS Middleware
const allowedOrigins = [
	"http://localhost:5173",
	"https://mister-tee.vercel.app",
	"misterteedata.railway.internal",
	"https://mister-tee.vercel.app/Leaderboards",
	"https://www.misterteerewards.com",
	"https://bswrxsti-787m61xns-skanderkefi88-8456s-projects.vercel.app",
	"https://www.bswrxsti.net",
	"https://bswrxstidata-production.up.railway.app",	
];

app.use(
	cors({
		origin: function (origin, callback) {
			// allow requests with no origin like curl or Postman
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			} else {
				return callback(new Error("CORS policy: This origin is not allowed"));
			}
		},
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "x-creator-auth", "Accept"],
		credentials: true,
	})
);

app.use(express.json());

// MongoDB Connection
mongoose
	.connect(process.env.MONGO_URI)
	.then(() => console.log("✅ MongoDB connected"))
	.catch((err) => console.error("❌ MongoDB connection error:", err));

// Models
const { User } = require("./models/User");
const { SlotCall } = require("./models/SlotCall");

// Middleware
const { verifyToken, isAdmin } = require("./middleware/auth");

// Routes
const slotCallRoutes = require("./routes/slotCallRoutes");

// Auth Routes
app.post("/api/auth/register", async (req, res) => {
	const { kickUsername, rainbetUsername, password, confirmPassword } = req.body;

	if (password !== confirmPassword) {
		return res.status(400).json({ message: "Passwords do not match." });
	}

	const existing = await User.findOne({ kickUsername });
	const existingRainbet = await User.findOne({ rainbetUsername });
	if (existing || existingRainbet)
		return res.status(400).json({ message: "Username already exists." });

	const hashed = await bcrypt.hash(password, 10);
	const newUser = new User({ kickUsername, rainbetUsername, password: hashed });
	await newUser.save();

	res.status(201).json({ message: "User registered." });
});
// Packdraw leaderboard proxy
app.get("/api/packdraw", async (req, res) => {
	try {
		const after = req.query.after;
		if (!after) {
			return res.status(400).json({ error: "Missing ?after=YYYY-MM-DD" });
		}

		const url = `https://packdraw.com/api/v1/affiliates/leaderboard?after=${after}&apiKey=844edef3-207a-454a-b78b-bc76a2d61a5e`;

		const response = await fetch(url);
		const text = await response.text();

		if (!response.ok) {
			return res.status(response.status).json({ error: text });
		}

		res.json(JSON.parse(text));
	} catch (err) {
		console.error("Packdraw Proxy Error:", err);
		res.status(500).json({ error: "Failed to reach Packdraw API" });
	}
});


app.post("/api/auth/login", async (req, res) => {
	const { kickUsername, password } = req.body;

	const user = await User.findOne({ kickUsername });
	if (!user) return res.status(404).json({ message: "User not found." });

	const match = await bcrypt.compare(password, user.password);
	if (!match) return res.status(401).json({ message: "Invalid credentials." });

	const token = jwt.sign(
		{ id: user._id, role: user.role, kickUsername: user.kickUsername },
		process.env.JWT_SECRET,
		{ expiresIn: "7d" }
	);

	res.json({
		token,
		user: { id: user._id, kickUsername: user.kickUsername, role: user.role },
	});
});

// Slot Call Routes
app.use("/api/slot-calls", slotCallRoutes);

// Affiliates Route
app.get("/api/affiliates", async (req, res) => {
	const { start_at, end_at } = req.query;

	if (!start_at || !end_at) {
		return res
			.status(400)
			.json({ error: "Missing start_at or end_at parameter" });
	}

	const url = `https://services.rainbet.com/v1/external/affiliates?start_at=${start_at}&end_at=${end_at}&key=${process.env.RAINBET_API_KEY}`;

	try {
		const response = await fetch(url);
		const content = await response.text();
		if (!response.ok) throw new Error(content);
		res.json(JSON.parse(content));
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch affiliates data" });
	}
});

const gwsRoutes = require("./routes/gwsRoutes");
app.use("/api/gws", gwsRoutes);

// Start Server
app.listen(PORT, () =>
	console.log(`✅ Server is running at http://localhost:${PORT}`)
);
const leaderboardRoutes = require("./routes/leaderboard");
// Routes
app.use("/api/leaderboard", leaderboardRoutes);

// Basic health check endpoint
app.get("/health", (req, res) => {
	res
		.status(200)
		.json({ status: "OK", message: "Roobet Leaderboard API is running" });
});
// Rain.gg API Config
const API_URL = "https://api.rain.gg/v1/affiliates/leaderboard";
const API_KEY = process.env.RAIN_API_KEY; // store your key in .env

// Leaderboard route
app.get("/rain", async (req, res) => {
	try {
		const { start_date, end_date, type, code } = req.query;

		// Validate required params
		if (!start_date || !end_date || !type) {
			return res.status(400).json({
				error: "Missing required params: start_date, end_date, type",
			});
		}

		// Make request to Rain.gg
		const response = await axios.get(API_URL, {
			headers: {
				"x-api-key": API_KEY,
			},
			params: {
				start_date,
				end_date,
				type, // must be 'wagered' or 'deposited'
				code, // optional
			},
		});

		// Return data
		res.json(response.data);
	} catch (err) {
		// Log detailed error
		if (err.response) {
			console.error(
				"Rain.gg API Error:",
				err.response.status,
				JSON.stringify(err.response.data, null, 2)
			);
			res.status(err.response.status).json(err.response.data);
		} else {
			console.error("Unexpected Error:", err.message);
			res.status(500).json({ error: err.message });
		}
	}
});


