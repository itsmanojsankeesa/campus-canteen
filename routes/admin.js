const express = require("express");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const User = require("../models/User");
const Ingredient = require("../models/Ingredient");
const { buildDashboard } = require("../services/dashboard");
const { requireAdmin, wrap } = require("../middleware/auth");
const { CATEGORIES } = require("../config/constants");

const router = express.Router();
router.use(requireAdmin);

const validId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id));

// Reads and checks the menu form. Returns { error } or { data }.
function readMenuForm(b) {
  b = b || {};
  const name = String(b.name || "").trim();
  const price = Number(b.price);
  const image = String(b.image || "").trim();
  if (name.length < 2) return { error: "Enter an item name." };
  if (!CATEGORIES.includes(b.category)) return { error: "Choose a category." };
  if (!Number.isInteger(price) || price < 1 || price > 2000) return { error: "Enter a price between 1 and 2000." };
  if (image && !/^(\/|https:\/\/)[^\s"'<>]{1,300}$/.test(image)) return { error: "The photo link must start with / or https://" };
  return { data: { name, category: b.category, price, veg: b.veg !== false, image } };
}

// GET /api/admin/dashboard
router.get("/dashboard", wrap(async (req, res) => {
  res.json(await buildDashboard());
}));

// PUT /api/admin/orders/:id/stage   body: { action: "advance" | "cancel" }
router.put("/orders/:id/stage", wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Not a valid order." });
  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.stage < 0 || order.stage >= 4) return res.status(400).json({ error: "This order is already finished." });

  const action = (req.body || {}).action;
  if (action !== "advance" && action !== "cancel") return res.status(400).json({ error: "Unknown action." });

  await Order.updateOne({ _id: order._id }, { $set: { stage: action === "advance" ? order.stage + 1 : -1 } });
  res.json(await buildDashboard());
}));

// POST /api/admin/menu
router.post("/menu", wrap(async (req, res) => {
  const r = readMenuForm(req.body);
  if (r.error) return res.status(400).json({ error: r.error });
  await MenuItem.create(r.data);
  res.status(201).json(await buildDashboard());
}));

// PUT /api/admin/menu/:id
router.put("/menu/:id", wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Not a valid item." });
  const r = readMenuForm(req.body);
  if (r.error) return res.status(400).json({ error: r.error });
  const updated = await MenuItem.findByIdAndUpdate(req.params.id, { $set: r.data }, { returnDocument: "after", runValidators: true });
  if (!updated) return res.status(404).json({ error: "Item not found." });
  res.json(await buildDashboard());
}));

// PATCH /api/admin/menu/:id/available   body: { available: true | false }
router.patch("/menu/:id/available", wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Not a valid item." });
  const updated = await MenuItem.findByIdAndUpdate(req.params.id, { $set: { available: (req.body || {}).available === true } }, { returnDocument: "after" });
  if (!updated) return res.status(404).json({ error: "Item not found." });
  res.json(await buildDashboard());
}));

// DELETE /api/admin/menu/:id
router.delete("/menu/:id", wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Not a valid item." });
  const gone = await MenuItem.findByIdAndDelete(req.params.id);
  if (!gone) return res.status(404).json({ error: "Item not found." });
  await User.updateMany({}, { $pull: { favourites: req.params.id } });
  res.json(await buildDashboard());
}));

// POST /api/admin/inventory/:id/restock
router.post("/inventory/:id/restock", wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Not a valid ingredient." });
  const item = await Ingredient.findById(req.params.id).lean();
  if (!item) return res.status(404).json({ error: "Ingredient not found." });
  await Ingredient.updateOne({ _id: item._id }, { $inc: { qty: item.step } });
  res.json(await buildDashboard());
}));

module.exports = router;
