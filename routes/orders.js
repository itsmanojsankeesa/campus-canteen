const express = require("express");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Counter = require("../models/Counter");
const combos = require("../config/combos");
const { requireStudent, wrap } = require("../middleware/auth");
const { PHONE_RE, ROLL_RE } = require("../config/constants");

const router = express.Router();
router.use(requireStudent);

const LOCATIONS = ["Main Canteen Counter", "Engineering Block Kiosk", "Library Cafe Window", "Hostel Mess Window"];
const TIMES = ["As soon as ready", "12:30 PM", "12:45 PM", "1:00 PM", "1:15 PM", "1:30 PM"];

function comboDiscount(lines) {
  const qty = {};
  const price = {};
  lines.forEach((l) => {
    qty[l.name] = (qty[l.name] || 0) + l.qty;
    price[l.name] = l.price;
  });
  return combos.reduce((sum, c) => {
    const times = Math.min(...c.items.map((n) => qty[n] || 0));
    if (!times) return sum;
    const full = c.items.reduce((x, n) => x + price[n], 0);
    return sum + times * (full - c.price);
  }, 0);
}

// POST /api/orders  - place an order
router.post("/", wrap(async (req, res) => {
  const { items, name, roll, phone, pickupLocation, pickupTime, payment } = req.body || {};
  const fail = (msg) => res.status(400).json({ error: msg });

  if (!Array.isArray(items) || items.length === 0) return fail("Your cart is empty.");
  if (items.length > 40) return fail("Too many items in one order.");
  if (String(name || "").trim().length < 2) return fail("Enter your full name.");
  if (!ROLL_RE.test(String(roll || "").trim())) return fail("Roll number should be 8 to 12 letters or digits.");
  if (!PHONE_RE.test(String(phone || "").trim())) return fail("Enter a 10-digit mobile number.");
  if (!["upi", "cash"].includes(payment)) return fail("Choose a payment method.");
  if (!LOCATIONS.includes(pickupLocation)) return fail("Choose a pickup location.");
  if (!TIMES.includes(pickupTime)) return fail("Choose a pickup time.");

  const ids = items.map((i) => String(i.id));
  if (new Set(ids).size !== ids.length) return fail("The same item appears twice in your cart.");
  if (!ids.every((id) => /^[0-9a-fA-F]{24}$/.test(id))) return fail("An item in your cart is not valid.");

  // Names and prices come from MongoDB, never from the browser.
  const found = await MenuItem.find({ _id: { $in: ids } }).lean();
  const byId = {};
  found.forEach((m) => { byId[String(m._id)] = m; });

  const lines = [];
  for (const i of items) {
    const m = byId[String(i.id)];
    const qty = Number(i.qty);
    if (!m) return fail("An item in your cart no longer exists.");
    if (!m.available) return fail(m.name + " is sold out.");
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return fail("Quantity must be between 1 and 20.");
    lines.push({ menuItem: m._id, name: m.name, price: m.price, qty });
  }

  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const discount = comboDiscount(lines);
  const total = subtotal - discount;
  const eta = Math.max(...lines.map((l) => byId[String(l.menuItem)].prepTime || 5)) + 2;

  const counter = await Counter.findOneAndUpdate({ _id: "order" }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  const seq = 413 + counter.seq; // first order is CC-0414

  const order = await Order.create({
    orderNo: "CC-" + String(seq).padStart(4, "0"),
    token: "A-" + (seq % 100),
    user: req.user._id,
    studentName: String(name).trim(),
    roll: String(roll).trim().toUpperCase(),
    phone: String(phone).trim(),
    items: lines,
    discount,
    total,
    pickupLocation,
    pickupTime,
    payment
  });

  res.status(201).json({ orderNo: order.orderNo, token: order.token, total, discount, eta });
}));

// GET /api/orders/mine  - the student's own orders (the page checks this every few seconds)
router.get("/mine", wrap(async (req, res) => {
  res.json(await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean());
}));

module.exports = router;
