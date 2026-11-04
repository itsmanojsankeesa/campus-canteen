// Run once:  npm run seed
// Fills the menu and the stock list, and makes the admin account.
// It does NOT touch students or orders.
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const MenuItem = require("./models/MenuItem");
const Ingredient = require("./models/Ingredient");
const User = require("./models/User");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/campus-canteen";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@college.edu").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// name, category, price, veg, rating, prepTime, popularity, description, available
const menuRows = [
  ["Masala Dosa", "Breakfast", 55, true, 4.6, 8, 95, "Crisp rice crepe with spiced potato, sambar and two chutneys."],
  ["Idli Sambar", "Breakfast", 40, true, 4.4, 6, 82, "Three steamed idlis with hot sambar and coconut chutney."],
  ["Poha", "Breakfast", 35, true, 4.1, 5, 60, "Flattened rice with onion, peanuts, lemon and curry leaves.", false],
  ["Egg Bhurji Pav", "Breakfast", 60, false, 4.3, 10, 70, "Spiced scrambled eggs with two buttered pavs."],
  ["Veg Thali", "Meals", 90, true, 4.5, 12, 90, "Rice, two curries, dal, roti, curd and pickle."],
  ["Chicken Biryani", "Meals", 130, false, 4.7, 15, 99, "Dum-cooked basmati with tender chicken, raita on the side."],
  ["Rajma Chawal", "Meals", 80, true, 4.2, 10, 74, "Slow-cooked kidney beans over steamed rice."],
  ["Curd Rice", "Meals", 60, true, 4.0, 6, 55, "Cooling curd rice tempered with mustard and ginger."],
  ["Samosa", "Snacks", 25, true, 4.4, 4, 88, "Two crisp pastries filled with spiced potato and peas."],
  ["Veg Puff", "Snacks", 20, true, 4.0, 3, 58, "Flaky baked puff with a mildly spiced vegetable filling."],
  ["Veg Burger", "Fast Food", 65, true, 4.2, 8, 72, "Crispy patty, lettuce and sauce in a toasted bun."],
  ["Chicken Roll", "Fast Food", 85, false, 4.5, 9, 86, "Grilled chicken, onions and mint chutney in a paratha wrap."],
  ["Hakka Noodles", "Fast Food", 80, true, 4.3, 10, 68, "Wok-tossed noodles with crunchy vegetables.", false],
  ["Masala Chai", "Beverages", 15, true, 4.7, 3, 97, "Ginger and cardamom tea, brewed strong."],
  ["Filter Coffee", "Beverages", 20, true, 4.5, 3, 84, "South Indian decoction with frothy hot milk."],
  ["Fresh Lime Soda", "Beverages", 30, true, 4.2, 3, 62, "Sweet, salted or mixed. Served over ice."],
  ["Cold Coffee", "Beverages", 45, true, 4.4, 5, 78, "Chilled blended coffee with a scoop of ice cream."],
  ["Gulab Jamun", "Desserts", 30, true, 4.5, 2, 80, "Two soft milk dumplings in cardamom syrup."],
  ["Ice Cream Cup", "Desserts", 35, true, 4.1, 2, 65, "Vanilla or chocolate scoops in a cup."]
];

// name, qty, unit, low-stock level, restock step
const stockRows = [
  ["Basmati rice", 42, "kg", 20, 25], ["Cooking oil", 14, "L", 15, 20], ["Potatoes", 38, "kg", 25, 30],
  ["Chicken", 9, "kg", 12, 15], ["Milk", 30, "L", 20, 20], ["Tea leaves", 6, "kg", 4, 5],
  ["Coffee powder", 3, "kg", 3, 5], ["Wheat flour", 25, "kg", 15, 25], ["Idli and dosa batter", 18, "L", 10, 20],
  ["Eggs", 120, "pcs", 60, 120], ["Onions", 20, "kg", 15, 20], ["Gas cylinders", 3, "pcs", 2, 2]
];

// Photo paths. Put your photos in public/images with these names (see public/images/README.txt).
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-");

(async () => {
  try {
    await mongoose.connect(MONGO_URL);

    await MenuItem.deleteMany({});
    await MenuItem.insertMany(menuRows.map(([name, category, price, veg, rating, prepTime, popularity, description, available]) => ({
      name, category, price, veg, rating, prepTime, popularity, description,
      available: available !== false,
      image: "/images/" + slug(name) + ".jpg"
    })));
    console.log("Menu: " + menuRows.length + " items added");

    await Ingredient.deleteMany({});
    await Ingredient.insertMany(stockRows.map(([name, qty, unit, min, step]) => ({ name, qty, unit, min, step })));
    console.log("Stock: " + stockRows.length + " ingredients added");

    if (await User.findOne({ email: ADMIN_EMAIL })) {
      console.log("Admin account already exists: " + ADMIN_EMAIL);
    } else {
      await User.create({ name: "Canteen Admin", email: ADMIN_EMAIL, role: "admin", passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10) });
      console.log("Admin account made: " + ADMIN_EMAIL + " / " + ADMIN_PASSWORD + "  (change this password before using the site for real)");
    }
  } catch (err) {
    console.log("Seed error:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
