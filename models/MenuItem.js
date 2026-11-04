const mongoose = require("mongoose");
const { CATEGORIES } = require("../config/constants");

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: CATEGORIES },
    price: { type: Number, required: true, min: 1, max: 2000 },
    veg: { type: Boolean, default: true },
    available: { type: Boolean, default: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" }, // e.g. /images/masala-dosa.jpg
    rating: { type: Number, default: 4 },
    prepTime: { type: Number, default: 5 }, // minutes
    popularity: { type: Number, default: 50 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuItem", menuItemSchema);
