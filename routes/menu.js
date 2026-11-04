const express = require("express");
const MenuItem = require("../models/MenuItem");
const { wrap } = require("../middleware/auth");

const router = express.Router();

// GET /api/menu  (public)
router.get("/", wrap(async (req, res) => {
  res.json(await MenuItem.find().sort({ popularity: -1 }).lean());
}));

module.exports = router;
