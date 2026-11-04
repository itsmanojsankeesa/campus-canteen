const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Ingredient = require("../models/Ingredient");

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const label = (d) => d.getDate() + " " + MON[d.getMonth()];

// Everything the admin page needs, worked out from the saved orders.
async function buildDashboard() {
  const now = new Date();
  const today = startOfDay(now);
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const [recent, forReports, menu, inventory] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).limit(300).lean(),
    Order.find({ createdAt: { $gte: sixMonthsAgo }, stage: { $ne: -1 } }).lean(),
    MenuItem.find().sort({ _id: 1 }).lean(),
    Ingredient.find().sort({ name: 1 }).lean()
  ]);

  // Today's numbers
  const todays = recent.filter((o) => new Date(o.createdAt) >= today);
  const live = todays.filter((o) => o.stage >= 0);
  const stats = {
    today: {
      orders: live.length,
      pending: live.filter((o) => o.stage <= 2).length,
      done: live.filter((o) => o.stage === 4).length,
      revenue: live.reduce((a, o) => a + o.total, 0)
    },
    hours: [],
    top: []
  };
  for (let h = 8; h <= 17; h++) {
    stats.hours.push({ h, n: live.filter((o) => new Date(o.createdAt).getHours() === h).length });
  }

  // Best sellers in the last 7 days
  const sold = {};
  forReports.forEach((o) => {
    const daysAgo = Math.round((today - startOfDay(new Date(o.createdAt))) / DAY);
    if (daysAgo < 7) (o.items || []).forEach((i) => { sold[i.name] = (sold[i.name] || 0) + i.qty; });
  });
  stats.top = Object.keys(sold).map((name) => ({ name, sold: sold[name] })).sort((a, b) => b.sold - a.sold).slice(0, 5);

  // Reports: 30 days, 8 weeks, 6 months
  const daily = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getTime() - (29 - i) * DAY);
    daily.push({ iso: iso(d), label: label(d), orders: 0, revenue: 0 });
  }
  const weekly = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(today.getTime() - 7 * (7 - i) * DAY);
    weekly.push({ label: label(d), orders: 0, revenue: 0 });
  }
  const monthly = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    monthly.push({ label: MON[d.getMonth()], orders: 0, revenue: 0 });
  }
  forReports.forEach((o) => {
    const when = new Date(o.createdAt);
    const daysAgo = Math.round((today - startOfDay(when)) / DAY);
    const add = (row) => { row.orders += 1; row.revenue += o.total; };
    if (daysAgo >= 0 && daysAgo < 30) add(daily[29 - daysAgo]);
    if (daysAgo >= 0 && daysAgo < 56) add(weekly[7 - Math.floor(daysAgo / 7)]);
    const monthsAgo = (today.getFullYear() * 12 + today.getMonth()) - (when.getFullYear() * 12 + when.getMonth());
    if (monthsAgo >= 0 && monthsAgo < 6) add(monthly[5 - monthsAgo]);
  });

  return { orders: recent, menu, inventory, stats, reports: { daily, weekly, monthly }, today: iso(today) };
}

module.exports = { buildDashboard };
