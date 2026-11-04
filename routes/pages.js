const express = require("express");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const combos = require("../config/combos");
const { buildDashboard } = require("../services/dashboard");
const { requireStudent, requireAdmin, wrap } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.redirect(req.user.role === "admin" ? "/admin" : "/student");
});

router.get("/login", (req, res) => {
  if (req.user) return res.redirect(req.user.role === "admin" ? "/admin" : "/student");
  res.render("login", { title: "Sign in | Campus Canteen" });
});

router.get("/student", requireStudent, wrap(async (req, res) => {
  const [menu, orders] = await Promise.all([
    MenuItem.find().sort({ _id: 1 }).lean(),
    Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean()
  ]);
  const u = req.user;
  res.render("student", {
    title: "Campus Canteen",
    user: { name: u.name, roll: u.roll, phone: u.phone, email: u.email, dept: u.dept },
    menu,
    orders,
    favourites: (u.favourites || []).map(String),
    combos
  });
}));

router.get("/admin", requireAdmin, wrap(async (req, res) => {
  res.render("admin", { title: "Admin | Campus Canteen", data: await buildDashboard() });
}));

module.exports = router;
