const User = require("../models/User");

// Runs on every request: finds the signed-in user from the session.
async function loadUser(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).lean();
      if (user) req.user = user;
      else req.session.userId = null;
    }
    next();
  } catch (err) {
    next(err);
  }
}

const isApi = (req) => req.originalUrl.startsWith("/api/") || req.originalUrl.startsWith("/auth/");

function requireStudent(req, res, next) {
  if (!req.user) return isApi(req) ? res.status(401).json({ error: "Please sign in." }) : res.redirect("/login");
  if (req.user.role !== "student") return isApi(req) ? res.status(403).json({ error: "Students only." }) : res.redirect("/admin");
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return isApi(req) ? res.status(401).json({ error: "Please sign in." }) : res.redirect("/login");
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return isApi(req) ? res.status(401).json({ error: "Please sign in." }) : res.redirect("/login");
  if (req.user.role !== "admin") return isApi(req) ? res.status(403).json({ error: "Admins only." }) : res.redirect("/student");
  next();
}

// Lets async route functions send their errors to the error handler.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { loadUser, requireStudent, requireLogin, requireAdmin, wrap };
