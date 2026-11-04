require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const { loadUser } = require("./middleware/auth");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Safe way to put data inside a <script> tag in an EJS page.
app.locals.json = (data) => JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(loadUser);

app.use("/auth", require("./routes/auth"));
app.use("/api/menu", require("./routes/menu"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/me", require("./routes/me"));
app.use("/api/admin", require("./routes/admin"));
app.use("/", require("./routes/pages"));

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// 404 and errors
app.use((req, res) => {
  if (req.originalUrl.startsWith("/api/")) return res.status(404).json({ error: "Not found." });
  res.status(404).send("Page not found. <a href=\"/\">Go home</a>");
});
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.log("Server error:", err.message);
  if (req.originalUrl.startsWith("/api/") || req.originalUrl.startsWith("/auth/")) return res.status(500).json({ error: "Something went wrong. Please try again." });
  res.status(500).send("Something went wrong. Please try again.");
});

module.exports = app;

if (require.main === module) {
  const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/campus-canteen";
  const PORT = process.env.PORT || 3000;
  mongoose
    .connect(MONGO_URL)
    .then(() => {
      console.log("MongoDB connected");
      app.listen(PORT, () => console.log("Server running on http://localhost:" + PORT));
    })
    .catch((err) => {
      console.log("MongoDB error:", err.message);
      process.exit(1);
    });
}
