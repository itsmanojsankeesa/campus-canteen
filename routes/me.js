const express = require("express");
const User = require("../models/User");
const MenuItem = require("../models/MenuItem");
const { requireLogin, wrap } = require("../middleware/auth");
const { DEPARTMENTS, EMAIL_RE, PHONE_RE } = require("../config/constants");

const router = express.Router();
router.use(requireLogin);

// PUT /api/me  - edit profile
router.put("/", wrap(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const phone = String(b.phone || "").trim();
  const dept = String(b.dept || "");

  if (name.length < 2) return res.status(400).json({ error: "Enter your full name." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!PHONE_RE.test(phone)) return res.status(400).json({ error: "Enter a 10-digit mobile number." });
  if (!DEPARTMENTS.includes(dept)) return res.status(400).json({ error: "Choose a department." });

  const other = await User.findOne({ email }).lean();
  if (other && String(other._id) !== String(req.user._id)) return res.status(409).json({ error: "That email is already used by another account." });

  await User.updateOne({ _id: req.user._id }, { $set: { name, email, phone, dept } });
  res.json({ name, email, phone, dept });
}));

// POST /api/me/favourites/:id  - add or remove a favourite
router.post("/favourites/:id", wrap(async (req, res) => {
  const id = req.params.id;
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return res.status(400).json({ error: "Not a valid item." });
  if (!(await MenuItem.findById(id).lean())) return res.status(404).json({ error: "Item not found." });

  const has = (req.user.favourites || []).map(String).includes(id);
  await User.updateOne({ _id: req.user._id }, has ? { $pull: { favourites: id } } : { $addToSet: { favourites: id } });
  res.json({ favourite: !has });
}));

module.exports = router;
