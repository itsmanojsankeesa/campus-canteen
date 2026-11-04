const mongoose = require("mongoose");

// Gives every order its own number, even if two students order at the same moment.
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 }
});

module.exports = mongoose.model("Counter", counterSchema);
