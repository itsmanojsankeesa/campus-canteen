// Combo offers. The student page shows them and the server uses the same list
// to work out the discount, so prices cannot be changed in the browser.
module.exports = [
  { id: "c1", title: "Chai and Samosa", text: "The classic evening break.", items: ["Samosa", "Masala Chai"], price: 35 },
  { id: "c2", title: "South Indian Pair", text: "Idli Sambar with a Filter Coffee.", items: ["Idli Sambar", "Filter Coffee"], price: 55 },
  { id: "c3", title: "Lunch Special", text: "Veg Thali with a Gulab Jamun.", items: ["Veg Thali", "Gulab Jamun"], price: 110 }
];
