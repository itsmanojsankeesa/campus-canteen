const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { wrap } = require("../middleware/auth");
const { EMAIL_RE, PHONE_RE, ROLL_RE } = require("../config/constants");

const router = express.Router();

// A fresh session id after sign-in stops session fixation.
const newSession = (req) => new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));

// POST /auth/register  (students only)
router.post("/register", wrap(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim();
  const roll = String(b.roll || "").trim().toUpperCase();
  const email = String(b.email || "").trim().toLowerCase();
  const phone = String(b.phone || "").trim();
  const password = String(b.password || "");

  const errors = {};
  if (name.length < 2) errors.name = "Enter your full name.";
  if (!ROLL_RE.test(roll)) errors.roll = "Roll number should be 8 to 12 letters or digits.";
  if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!PHONE_RE.test(phone)) errors.phone = "Enter a 10-digit mobile number.";
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) errors.pw = "Use 8 or more characters with letters and digits.";
  if (Object.keys(errors).length) return res.status(400).json({ error: "Please fix the highlighted fields.", errors });

  const exists = await User.findOne({ $or: [{ email }, { roll }] }).lean();
  if (exists) return res.status(409).json({ error: "An account with this email or roll number already exists." });

  try {
    const user = await User.create({ name, roll, email, phone, passwordHash: await bcrypt.hash(password, 10) });
    await newSession(req);
    req.session.userId = String(user._id);
    res.status(201).json({ redirect: "/student" });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: "An account with this email or roll number already exists." });
    throw err;
  }
}));

// POST /auth/login
router.post("/login", wrap(async (req, res) => {
  const b = req.body || {};
  const ident = String(b.ident || "").trim();
  const password = String(b.password || "");
  const role = b.role === "admin" ? "admin" : "student";

  const bad = () => res.status(401).json({ error: "Wrong details. Check your " + (role === "admin" ? "email" : "roll number or email") + " and password." });
  if (!ident || !password) return bad();

  const query = ident.includes("@") ? { email: ident.toLowerCase() } : { roll: ident.toUpperCase() };
  const user = await User.findOne(query).lean();
  if (!user || user.role !== role) return bad();
  if (!(await bcrypt.compare(password, user.passwordHash))) return bad();

  await newSession(req);
  req.session.userId = String(user._id);
  res.json({ redirect: role === "admin" ? "/admin" : "/student" });
}));

module.exports = router;
