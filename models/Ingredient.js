const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  qty: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true }, // kg, L, pcs
  min: { type: Number, required: true }, // low-stock level
  step: { type: Number, required: true } // amount added by the Restock button
});

module.exports = mongoose.model("Ingredient", ingredientSchema);
