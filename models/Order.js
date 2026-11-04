const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true }, // CC-0414
    token: { type: String, required: true }, // A-14
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentName: { type: String, required: true },
    roll: { type: String, required: true },
    phone: { type: String, required: true },
    // Name and price are copied at order time, so old orders stay correct if the menu changes.
    items: [
      {
        _id: false,
        menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
        name: String,
        price: Number,
        qty: Number
      }
    ],
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    pickupLocation: { type: String, default: "Main Canteen Counter" },
    pickupTime: { type: String, default: "As soon as ready" },
    payment: { type: String, enum: ["upi", "cash"], default: "upi" },
    // 0 Placed, 1 Accepted, 2 Preparing, 3 Ready for pickup, 4 Completed, -1 Cancelled
    stage: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
