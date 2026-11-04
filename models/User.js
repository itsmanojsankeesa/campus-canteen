const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Students have a roll number. The admin account does not (sparse keeps the index happy).
    roll: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true, default: "" },
    dept: { type: String, default: "Electronics and Communication" },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "admin"], default: "student" },
    favourites: [{ type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
