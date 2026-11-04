// Admin dashboard: overview, orders, menu, inventory, reports.
// Data comes from the server (window.CANTEEN_ADMIN, then /api/admin/dashboard). Every change is saved with the API.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (d, s) => `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  const STAGES = ['Placed', 'Accepted', 'Preparing', 'Ready for pickup', 'Completed'];
  const NEXT = ['Accept', 'Start preparing', 'Mark ready', 'Complete'];
  const CATS = ['Breakfast', 'Meals', 'Snacks', 'Beverages', 'Fast Food', 'Desserts'];
  const money = (n) => Number(n).toLocaleString('en-IN');

  const D = window.CANTEEN_ADMIN || {};
  let lastTxt = JSON.stringify(D);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function fmtTime(iso) {
    const d = new Date(iso), now = new Date();
    const t = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    return d.toDateString() === now.toDateString() ? t : d.getDate() + ' ' + MON[d.getMonth()] + ', ' + t;
  }

  const state = {
    view: 'overview', loading: false, toast: '',
    orders: [], menu: [], inv: [], stats: { today: {}, hours: [], top: [] }, reports: { daily: [], weekly: [], monthly: [] }, today: '',
    oq: '', ostatus: 'all', osort: 'new',
    mq: '', mcat: 'all', msort: 'name', form: null, fErr: {},
    iq: '', ilow: false, isort: 'name',
    range: 'daily', from: '', to: '', confirm: null
  };

  // Turns the server data into the shapes the views below use.
  function load(d) {
    state.orders = (d.orders || []).map((o) => ({
      _id: String(o._id), id: o.orderNo, student: o.studentName, total: o.total, stage: o.stage,
      items: (o.items || []).map((i) => i.qty + ' × ' + i.name).join(', '),
      time: fmtTime(o.createdAt), pay: o.payment === 'upi' ? 'UPI' : 'Cash'
    }));
    state.menu = (d.menu || []).map((m) => ({ id: String(m._id), name: m.name, cat: m.category, price: m.price, veg: m.veg, avail: m.available, image: m.image || '' }));
    state.inv = (d.inventory || []).map((i) => ({ id: String(i._id), name: i.name, qty: i.qty, unit: i.unit, min: i.min, step: i.step }));
    state.stats = d.stats || state.stats;
    state.reports = d.reports || state.reports;
    state.today = d.today || '';
  }
  load(D);
  state.to = state.today;
  state.from = (state.reports.daily[Math.max(0, state.reports.daily.length - 7)] || {}).iso || state.today;

  // ---------- helpers ----------
  let toastTimer;
  function note(msg) {
    clearTimeout(toastTimer);
    state.toast = msg;
    renderToast();
    toastTimer = setTimeout(() => { state.toast = ''; renderToast(); }, 2200);
  }
  function renderToast() { $('toast').innerHTML = state.toast ? `<div class="toast" role="status">${esc(state.toast)}</div>` : ''; }

  function go(view, patch) {
    Object.assign(state, { view, loading: true }, patch || {});
    render();
    refresh().catch(() => {}).then(() => { state.loading = false; render(); });
  }

  function refresh() {
    return fetch('/api/admin/dashboard', { credentials: 'same-origin' })
      .then((r) => { if (r.status === 401 || r.status === 403) { window.location.href = '/login'; throw new Error('signed out'); } return r.json(); })
      .then((d) => { lastTxt = JSON.stringify(d); load(d); });
  }

  // Sends a change to the server. The server answers with fresh dashboard data.
  function api(method, url, body) {
    return fetch(url, {
      method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then((r) => r.json().catch(() => ({})).then((d) => {
      if (r.status === 401 || r.status === 403) { window.location.href = '/login'; throw new Error('Please sign in again.'); }
      if (!r.ok) throw new Error(d.error || 'Something went wrong.');
      return d;
    }));
  }
  function applied(d, msg) { lastTxt = JSON.stringify(d); load(d); state.confirm = null; state.form = null; state.fErr = {}; render(); if (msg) note(msg); }
  function failed(err) { state.confirm = null; render(); note(err.message); }

  const opt = (val, label, cur) => `<option value="${val}"${String(cur) === String(val) ? ' selected' : ''}>${label}</option>`;
  const statusName = (o) => (o.stage < 0 ? 'Cancelled' : STAGES[o.stage]);
  const pillCls = (o) => (o.stage < 0 ? 'bad' : 's' + o.stage);
  const isLow = (i) => i.qty <= i.min;
  const H1 = 'font-size: 36px; font-weight: 800; color: #12342A';
  const SUB = 'margin-top: 4px; color: #55655C';
  const empty = (t) => `<p style="padding: 40px 16px; text-align: center; color: #55655C">${t}</p>`;

  function topHtml() {
    const top = state.stats.top || [];
    if (!top.length) return '<li style="color: #55655C">No sales in the last 7 days yet.</li>';
    const max = top[0].sold;
    return top.map((t) => `<li><div style="display: flex; justify-content: space-between; gap: 12px"><b>${esc(t.name)}</b><span style="color: #55655C">${t.sold} sold</span></div><div class="meter" style="margin-top: 6px"><i style="width: ${Math.round((t.sold / max) * 100)}%"></i></div></li>`).join('');
  }

  // ---------- sidebar ----------
  function navHtml() {
    const live = state.orders.filter((o) => o.stage >= 0);
    const pending = live.filter((o) => o.stage <= 2).length;
    const low = state.inv.filter(isLow).length;
    const items = [['overview', 'Overview'], ['orders', 'Orders'], ['menu', 'Menu'], ['inventory', 'Inventory'], ['reports', 'Reports']];
    return items.map(([k, label]) => {
      const badge = k === 'orders' ? pending : k === 'inventory' ? low : 0;
      return `<button type="button" class="slink ${state.view === k ? 'on' : ''}" aria-current="${state.view === k ? 'page' : 'false'}" data-act="nav" data-arg="${k}">${label}${badge ? `<span style="margin-left: auto; background: #F08A24; color: #2B1604; font-size: 12px; font-weight: 800; border-radius: 11px; min-width: 22px; height: 22px; display: grid; place-items: center; padding: 0 6px">${badge}</span>` : ''}</button>`;
    }).join('');
  }

  // ---------- views ----------
  function overviewHtml() {
    const t = state.stats.today || {};
    const kpi = { orders: t.orders || 0, pending: t.pending || 0, done: t.done || 0, revenue: money(t.revenue || 0) };
    const lowItems = state.inv.filter(isLow);
    const hourData = (state.stats.hours || []).map((x) => [x.h, x.n]);
    const hmax = Math.max.apply(null, hourData.map((h) => h[1]).concat([1]));
    const peak = hourData.reduce((best, h) => (h[1] > best[1] ? h : best), [0, 0]);
    const hours = hourData.map(([h, n]) => ({ label: h, h: Math.max(4, Math.round((n / hmax) * 100)) + '%', cls: n > 0 && n === hmax ? 'pk' : '', title: h + ':00, ' + n + ' orders' }));
    return `<h1 style="${H1}">Overview</h1>
      <p style="${SUB}">Today's activity at a glance. New orders appear here by themselves.</p>
      ${lowItems.length ? `<div role="status" style="margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between; background: #FCE9D3; border: 1px solid #F4CFA3; color: #6B3305; border-radius: 14px; padding: 12px 16px; font-weight: 600">
        <span>${lowItems.length} ingredients are at or below their minimum level.</span>
        <button type="button" class="btn sm" data-act="lowstock">Review stock</button></div>` : ''}
      <div class="kpis" style="margin-top: 20px">
        <div class="card kpi"><p>Orders today</p><b>${kpi.orders}</b></div>
        <div class="card kpi"><p>Pending</p><b style="color: #A84A07">${kpi.pending}</b></div>
        <div class="card kpi"><p>Completed</p><b style="color: #1F5A3F">${kpi.done}</b></div>
        <div class="card kpi"><p>Revenue today</p><b>₹${kpi.revenue}</b></div>
      </div>
      <div class="grid2" style="margin-top: 20px">
        <section class="card" style="padding: 20px" aria-labelledby="h-recent">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px"><h2 id="h-recent" style="font-size: 20px; font-weight: 800">Recent orders</h2><button type="button" class="btn ghost sm" data-act="nav" data-arg="orders">View all</button></div>
          <ul style="list-style: none; padding: 0; margin-top: 12px">
            ${state.orders.slice(0, 6).map((o) => `<li style="display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #E7E0D1">
              <div style="min-width: 0"><b>${o.id}</b> <span style="color: #55655C">${esc(o.student)}</span><p style="color: #55655C; font-size: 14px">${o.time} · ₹${o.total}</p></div>
              <span class="pill ${pillCls(o)}">${statusName(o)}</span></li>`).join('')}
          </ul>
        </section>
        <section class="card" style="padding: 20px" aria-labelledby="h-hour">
          <h2 id="h-hour" style="font-size: 20px; font-weight: 800">Orders by hour</h2>
          <p style="color: #55655C; font-size: 14px">Today, from saved orders. Busiest hour highlighted.</p>
          <div class="plot" style="margin-top: 12px" role="img" aria-label="Bar chart of today's orders by hour.${peak[1] ? ' Busiest hour is ' + peak[0] + ':00 with ' + peak[1] + ' orders.' : ''}">
            ${hours.map((b) => `<div class="bar ${b.cls}" style="height: ${b.h}" title="${b.title}"></div>`).join('')}
          </div>
          <div class="xl" aria-hidden="true">${hours.map((b) => `<span>${b.label}</span>`).join('')}</div>
          <p style="color: #55655C; font-size: 13px; margin-top: 6px; text-align: center">Hour of day (24h)</p>
        </section>
      </div>
      <section class="card" style="padding: 20px; margin-top: 20px" aria-labelledby="h-top">
        <h2 id="h-top" style="font-size: 20px; font-weight: 800">Popular items this week</h2>
        <ul style="list-style: none; padding: 0; margin-top: 14px; display: flex; flex-direction: column; gap: 14px">${topHtml()}</ul>
      </section>`;
  }

  function ordersHtml() {
    const s = state;
    let rows = s.orders.slice();
    const oq = s.oq.trim().toLowerCase();
    rows = rows.filter((o) => (!oq || (o.id + ' ' + o.student).toLowerCase().indexOf(oq) >= 0) &&
      (s.ostatus === 'all' || (s.ostatus === 'x' ? o.stage < 0 : o.stage === Number(s.ostatus))));
    if (s.osort === 'old') rows.reverse();
    if (s.osort === 'amt') rows.sort((a, b) => b.total - a.total);
    return `<h1 style="${H1}">Orders</h1>
      <p style="${SUB}">Move each order through the kitchen stages. Students see the new status within a few seconds.</p>
      <div class="tools">
        <div><label class="lab" for="o-q">Search</label><input id="o-q" class="in" data-f="oq" value="${esc(s.oq)}" placeholder="Order ID or student name"></div>
        <div><label class="lab" for="o-st">Status</label><select id="o-st" class="in" data-f="ostatus">${opt('all', 'All statuses', s.ostatus)}${STAGES.map((n, i) => opt(i, n, s.ostatus)).join('')}${opt('x', 'Cancelled', s.ostatus)}</select></div>
        <div><label class="lab" for="o-sort">Sort by</label><select id="o-sort" class="in" data-f="osort">${opt('new', 'Newest first', s.osort)}${opt('old', 'Oldest first', s.osort)}${opt('amt', 'Highest amount', s.osort)}</select></div>
      </div>
      <div class="card tbl" style="margin-top: 20px" role="table" aria-label="Orders"><div>
        <div class="trow head c-orders" role="row"><span role="columnheader">Order</span><span role="columnheader">Student</span><span role="columnheader">Items</span><span role="columnheader">Total</span><span role="columnheader">Status</span><span role="columnheader">Action</span></div>
        ${rows.map((o) => {
          const open = o.stage >= 0 && o.stage < 4;
          return `<div class="trow c-orders" role="row">
            <span role="cell"><b>${o.id}</b><br><span style="color: #55655C; font-size: 13px">${o.time}</span></span>
            <span role="cell">${esc(o.student)}<br><span style="color: #55655C; font-size: 13px">${o.pay}</span></span>
            <span role="cell" style="color: #3C453F; font-size: 15px">${esc(o.items)}</span>
            <span role="cell"><b>₹${o.total}</b></span>
            <span role="cell"><span class="pill ${pillCls(o)}">${statusName(o)}</span></span>
            <span role="cell" style="display: flex; gap: 6px; align-items: center">
              ${open ? `<button type="button" class="btn sm" data-act="advance" data-arg="${o.id}">${NEXT[o.stage]}</button>
              <button type="button" class="icobtn del" aria-label="Cancel order ${o.id}" data-act="cancel" data-arg="${o.id}">${svg(P.x, 20)}</button>` : ''}
            </span></div>`;
        }).join('')}
        ${rows.length === 0 ? empty('No orders match these filters (or no orders have been placed yet).') : ''}
      </div></div>`;
  }

  function menuHtml() {
    const s = state, mq = s.mq.trim().toLowerCase();
    const sorts = { name: (a, b) => a.name.localeCompare(b.name), low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, cat: (a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name) };
    const rows = s.menu.filter((m) => (s.mcat === 'all' || m.cat === s.mcat) && (!mq || m.name.toLowerCase().indexOf(mq) >= 0)).sort(sorts[s.msort]);
    return `<div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: flex-end">
        <div><h1 style="${H1}">Menu management</h1><p style="${SUB}">${s.menu.length} items. Switch availability when something runs out.</p></div>
        <button type="button" class="btn" data-act="add">${svg(P.plus, 20)}Add item</button>
      </div>
      <div class="tools">
        <div><label class="lab" for="m-q">Search</label><input id="m-q" class="in" data-f="mq" value="${esc(s.mq)}" placeholder="Search by name"></div>
        <div><label class="lab" for="m-cat">Category</label><select id="m-cat" class="in" data-f="mcat">${opt('all', 'All categories', s.mcat)}${CATS.map((c) => opt(c, c, s.mcat)).join('')}</select></div>
        <div><label class="lab" for="m-sort">Sort by</label><select id="m-sort" class="in" data-f="msort">${opt('name', 'Name A to Z', s.msort)}${opt('low', 'Price: low to high', s.msort)}${opt('high', 'Price: high to low', s.msort)}${opt('cat', 'Category', s.msort)}</select></div>
      </div>
      <div class="card tbl" style="margin-top: 20px" role="table" aria-label="Menu items"><div>
        <div class="trow head c-menu" role="row"><span role="columnheader">Item</span><span role="columnheader">Category</span><span role="columnheader">Price</span><span role="columnheader">Type</span><span role="columnheader">Available</span><span role="columnheader">Actions</span></div>
        ${rows.map((m) => `<div class="trow c-menu" role="row">
          <span role="cell"><b>${esc(m.name)}</b></span>
          <span role="cell" style="color: #55655C">${m.cat}</span>
          <span role="cell"><b>₹${m.price}</b></span>
          <span role="cell" style="display: flex; align-items: center; gap: 8px"><span class="vi ${m.veg ? 'veg' : 'nonveg'}" aria-hidden="true"><i></i></span>${m.veg ? 'Veg' : 'Non-veg'}</span>
          <span role="cell" style="display: flex; align-items: center; gap: 6px"><button type="button" class="sw ${m.avail ? 'on' : ''}" role="switch" aria-checked="${m.avail}" aria-label="Available: ${esc(m.name)}" data-act="toggle" data-arg="${m.id}"><span></span></button><span style="font-size: 14px">${m.avail ? 'Available' : 'Sold out'}</span></span>
          <span role="cell" style="display: flex; gap: 2px">
            <button type="button" class="icobtn" aria-label="Edit ${esc(m.name)}" data-act="edit" data-arg="${m.id}">${svg(P.pencil, 20)}</button>
            <button type="button" class="icobtn del" aria-label="Delete ${esc(m.name)}" data-act="del" data-arg="${m.id}">${svg(P.trash, 20)}</button>
          </span></div>`).join('')}
        ${rows.length === 0 ? empty('No menu items match your search.') : ''}
      </div></div>`;
  }

  function inventoryHtml() {
    const s = state, iq = s.iq.trim().toLowerCase();
    const lowItems = s.inv.filter(isLow);
    const rows = s.inv.filter((i) => (!iq || i.name.toLowerCase().indexOf(iq) >= 0) && (!s.ilow || isLow(i)))
      .sort(s.isort === 'level' ? (a, b) => a.qty / a.min - b.qty / b.min : (a, b) => a.name.localeCompare(b.name));
    return `<h1 style="${H1}">Inventory</h1>
      <p style="${SUB}">Ingredient stock against minimum levels.</p>
      ${lowItems.length ? `<div role="status" style="margin-top: 20px; background: #FCE9D3; border: 1px solid #F4CFA3; color: #6B3305; border-radius: 14px; padding: 12px 16px; font-weight: 600">Low stock: ${lowItems.map((i) => i.name).join(', ')}.</div>` : ''}
      <div class="tools">
        <div><label class="lab" for="i-q">Search</label><input id="i-q" class="in" data-f="iq" value="${esc(s.iq)}" placeholder="Search ingredients"></div>
        <div><label class="lab" for="i-sort">Sort by</label><select id="i-sort" class="in" data-f="isort">${opt('name', 'Name A to Z', s.isort)}${opt('level', 'Lowest stock first', s.isort)}</select></div>
        <div style="flex: 0 0 auto"><button type="button" class="btn ghost" aria-pressed="${s.ilow}" data-act="lowtoggle">${s.ilow ? 'Showing low stock only' : 'Show low stock only'}</button></div>
      </div>
      <div class="card tbl" style="margin-top: 20px" role="table" aria-label="Inventory"><div>
        <div class="trow head c-inv" role="row"><span role="columnheader">Ingredient</span><span role="columnheader">In stock</span><span role="columnheader">Minimum</span><span role="columnheader">Level</span><span role="columnheader">Status</span><span role="columnheader">Action</span></div>
        ${rows.map((i) => {
          const pct = Math.min(100, Math.round((i.qty / (i.min * 2)) * 100)) + '%';
          return `<div class="trow c-inv" role="row">
            <span role="cell"><b>${esc(i.name)}</b></span>
            <span role="cell"><b>${i.qty}</b> ${i.unit}</span>
            <span role="cell" style="color: #55655C">${i.min} ${i.unit}</span>
            <span role="cell"><div class="meter ${isLow(i) ? 'low' : ''}" role="img" aria-label="${pct} of target stock"><i style="width: ${pct}"></i></div></span>
            <span role="cell"><span class="pill ${isLow(i) ? 's0' : ''}">${isLow(i) ? 'Low stock' : 'In stock'}</span></span>
            <span role="cell"><button type="button" class="btn ghost sm" data-act="restock" data-arg="${i.id}" aria-label="Restock ${esc(i.name)}">Restock +${i.step}</button></span></div>`;
        }).join('')}
        ${rows.length === 0 ? empty('No ingredients match.') : ''}
      </div></div>`;
  }

  function reportsHtml() {
    const s = state, ser = state.reports;
    let rows = s.range === 'daily' ? ser.daily.filter((d) => d.iso >= s.from && d.iso <= s.to) : s.range === 'weekly' ? ser.weekly : ser.monthly;
    const rangeBad = s.range === 'daily' && s.from > s.to;
    if (rangeBad) rows = [];
    const tR = rows.reduce((a, r) => a + r.revenue, 0), tO = rows.reduce((a, r) => a + r.orders, 0);
    const rmax = Math.max.apply(null, rows.map((r) => r.revenue).concat([1]));
    const unit = s.range === 'daily' ? 'day' : s.range === 'weekly' ? 'week' : 'month';
    const unitCap = s.range === 'daily' ? 'Date' : s.range === 'weekly' ? 'Week ending' : 'Month';
    const bars = rows.map((r) => ({ label: r.label, h: Math.max(4, Math.round((r.revenue / rmax) * 100)) + '%', cls: r.revenue === rmax ? 'pk' : '', title: r.label + ': ₹' + money(r.revenue) }));
    return `<h1 style="${H1}">Sales reports</h1>
      <p style="${SUB}">Figures come from saved orders. Cancelled orders are not counted.</p>
      <div class="tools">
        <div style="flex: 0 1 auto"><span class="lab">Period</span>
          <div style="display: flex; gap: 8px" role="group" aria-label="Report period">
            ${[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([k, label]) => `<button type="button" class="btn ${s.range === k ? '' : 'ghost'}" aria-pressed="${s.range === k}" data-act="range" data-arg="${k}">${label}</button>`).join('')}
          </div></div>
        ${s.range === 'daily' ? `<div><label class="lab" for="r-from">From</label><input id="r-from" type="date" class="in" data-f="from" value="${s.from}" min="${ser.daily[0] ? ser.daily[0].iso : ''}" max="${s.today}"></div>
        <div><label class="lab" for="r-to">To</label><input id="r-to" type="date" class="in" data-f="to" value="${s.to}" min="${ser.daily[0] ? ser.daily[0].iso : ''}" max="${s.today}"></div>` : ''}
      </div>
      ${rangeBad ? '<p role="alert" class="errtxt" style="margin-top: 12px; font-weight: 600">The start date must be on or before the end date.</p>' : ''}
      <div class="kpis" style="margin-top: 20px">
        <div class="card kpi"><p>Revenue</p><b>₹${money(tR)}</b></div>
        <div class="card kpi"><p>Orders</p><b>${money(tO)}</b></div>
        <div class="card kpi"><p>Average order</p><b>₹${tO ? money(Math.round(tR / tO)) : '0'}</b></div>
      </div>
      <section class="card" style="padding: 20px; margin-top: 20px" aria-labelledby="h-rev">
        <h2 id="h-rev" style="font-size: 20px; font-weight: 800">Revenue by ${unit}</h2>
        ${rows.length === 0 ? '<p style="padding: 40px 0; text-align: center; color: #55655C">No data for this date range.</p>' : ''}
        <div class="plot ${rows.length > 12 ? '' : 'sparse'}" style="margin-top: 12px" role="img" aria-label="Bar chart of revenue by ${unit}, total ₹${money(tR)}">
          ${bars.map((b) => `<div class="bar ${b.cls}" style="height: ${b.h}" title="${b.title}"></div>`).join('')}
        </div>
        ${rows.length > 0 && rows.length <= 12 ? `<div class="xl" aria-hidden="true">${bars.map((b) => `<span>${b.label}</span>`).join('')}</div>` : ''}
      </section>
      <div class="grid2" style="margin-top: 20px">
        <section class="card tbl" aria-labelledby="h-tab" role="table" aria-label="Sales table"><div>
          <h2 id="h-tab" style="font-size: 20px; font-weight: 800; padding: 18px 16px 12px">Breakdown</h2>
          <div class="trow head c-rep" role="row"><span role="columnheader">${unitCap}</span><span role="columnheader">Orders</span><span role="columnheader">Revenue</span><span role="columnheader">Avg order</span></div>
          ${rows.slice().reverse().map((r) => `<div class="trow c-rep" role="row"><span role="cell">${r.label}</span><span role="cell">${money(r.orders)}</span><span role="cell"><b>₹${money(r.revenue)}</b></span><span role="cell">₹${r.orders ? money(Math.round(r.revenue / r.orders)) : '0'}</span></div>`).join('')}
        </div></section>
        <section class="card" style="padding: 20px; align-self: start" aria-labelledby="h-top2">
          <h2 id="h-top2" style="font-size: 20px; font-weight: 800">Best sellers</h2>
          <ul style="list-style: none; padding: 0; margin-top: 14px; display: flex; flex-direction: column; gap: 14px">${topHtml()}</ul>
        </section>
      </div>`;
  }

  // ---------- dialogs ----------
  function modalHtml() {
    const f = state.form, cf = state.confirm;
    if (f) {
      const fe = state.fErr;
      return `<div class="scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title" style="font-size: 24px; font-weight: 800">${f.id ? 'Edit menu item' : 'Add menu item'}</h2>
        <form data-form="item" novalidate style="margin-top: 18px; display: flex; flex-direction: column; gap: 14px">
          <div><label class="lab" for="d-name">Item name</label><input id="d-name" class="in ${fe.name ? 'err' : ''}" data-ff="name" value="${esc(f.name)}">${fe.name ? `<p class="errtxt">${fe.name}</p>` : ''}</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 14px">
            <div><label class="lab" for="d-cat">Category</label><select id="d-cat" class="in" data-ff="cat">${CATS.map((c) => opt(c, c, f.cat)).join('')}</select></div>
            <div><label class="lab" for="d-price">Price (₹)</label><input id="d-price" class="in ${fe.price ? 'err' : ''}" inputmode="numeric" data-ff="price" value="${esc(f.price)}">${fe.price ? `<p class="errtxt">${fe.price}</p>` : ''}</div>
          </div>
          <div><label class="lab" for="d-veg">Food type</label><select id="d-veg" class="in" data-ff="veg">${opt('veg', 'Vegetarian', f.veg)}${opt('nonveg', 'Non-vegetarian', f.veg)}</select></div>
          <div><label class="lab" for="d-img">Photo link (optional)</label><input id="d-img" class="in" data-ff="image" value="${esc(f.image || '')}" placeholder="/images/masala-dosa.jpg"></div>
          ${fe.server ? `<p role="alert" class="errtxt">${esc(fe.server)}</p>` : ''}
          <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; margin-top: 8px">
            <button type="button" class="btn ghost" data-act="closeform">Cancel</button>
            <button type="submit" class="btn">${f.id ? 'Save changes' : 'Add item'}</button>
          </div>
        </form></div></div>`;
    }
    if (cf) {
      let title, text, cta;
      if (cf.kind === 'menu') {
        const m = state.menu.find((x) => x.id === cf.id);
        title = 'Delete ' + (m ? esc(m.name) : 'item') + '?'; text = 'This removes the item from the menu. Students will no longer see it.'; cta = 'Delete item';
      } else {
        title = 'Cancel order ' + cf.id + '?'; text = 'The student will see the order as cancelled. This cannot be undone.'; cta = 'Cancel order';
      }
      return `<div class="scrim"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="cf-title" aria-describedby="cf-text">
        <h2 id="cf-title" style="font-size: 24px; font-weight: 800">${title}</h2>
        <p id="cf-text" style="margin-top: 8px; color: #55655C">${text}</p>
        <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; margin-top: 24px">
          <button type="button" class="btn ghost" data-act="confirmno">Keep it</button>
          <button type="button" class="btn danger" data-act="confirmyes">${cta}</button>
        </div></div></div>`;
    }
    return '';
  }

  // ---------- render ----------
  function render() {
    const active = document.activeElement;
    const aid = active && active.id, apos = active && active.selectionStart;
    $('snav').innerHTML = navHtml();
    const v = state.view;
    $('view').innerHTML = state.loading
      ? `<div style="display: grid; place-items: center; gap: 12px; padding: 120px 0; color: #55655C" role="status"><div class="spin"></div>Loading ${v}...</div>`
      : v === 'overview' ? overviewHtml() : v === 'orders' ? ordersHtml() : v === 'menu' ? menuHtml() : v === 'inventory' ? inventoryHtml() : reportsHtml();
    $('modal').innerHTML = modalHtml();
    if (aid) {
      const el = $(aid);
      if (el) { el.focus(); try { if (apos != null) el.setSelectionRange(apos, apos); } catch (e) { /* select / date inputs */ } }
    }
  }

  // ---------- actions ----------
  const orderByNo = (no) => state.orders.find((x) => x.id === no);

  const ACTIONS = {
    nav: (a) => go(a),
    lowstock: () => go('inventory', { ilow: true }),
    lowtoggle: () => { state.ilow = !state.ilow; render(); },
    range: (a) => { state.range = a; render(); },
    advance: (a) => {
      const o = orderByNo(a);
      api('PUT', '/api/admin/orders/' + o._id + '/stage', { action: 'advance' })
        .then((d) => applied(d, o.id + ' is now ' + STAGES[o.stage + 1].toLowerCase())).catch(failed);
    },
    cancel: (a) => { state.confirm = { kind: 'order', id: a }; render(); },
    toggle: (a) => {
      const m = state.menu.find((x) => x.id === a);
      api('PATCH', '/api/admin/menu/' + a + '/available', { available: !m.avail })
        .then((d) => applied(d, m.name + (m.avail ? ' marked sold out' : ' is available again'))).catch(failed);
    },
    add: () => { state.form = { id: null, name: '', cat: 'Meals', price: '', veg: 'veg', image: '' }; state.fErr = {}; render(); const el = $('d-name'); if (el) el.focus(); },
    edit: (a) => {
      const m = state.menu.find((x) => x.id === a);
      state.form = { id: m.id, name: m.name, cat: m.cat, price: String(m.price), veg: m.veg ? 'veg' : 'nonveg', image: m.image };
      state.fErr = {}; render(); const el = $('d-name'); if (el) el.focus();
    },
    del: (a) => { state.confirm = { kind: 'menu', id: a }; render(); },
    closeform: () => { state.form = null; state.fErr = {}; render(); },
    confirmno: () => { state.confirm = null; render(); },
    confirmyes: () => {
      const cf = state.confirm;
      if (cf.kind === 'menu') {
        api('DELETE', '/api/admin/menu/' + cf.id).then((d) => applied(d, 'Menu item deleted')).catch(failed);
      } else {
        const o = orderByNo(cf.id);
        api('PUT', '/api/admin/orders/' + o._id + '/stage', { action: 'cancel' }).then((d) => applied(d, 'Order ' + o.id + ' cancelled')).catch(failed);
      }
    },
    restock: (a) => {
      const i = state.inv.find((x) => x.id === a);
      api('POST', '/api/admin/inventory/' + a + '/restock').then((d) => applied(d, i.name + ' restocked by ' + i.step + ' ' + i.unit)).catch(failed);
    }
  };

  function saveItem() {
    const f = state.form, er = {}, price = parseInt(f.price, 10);
    if ((f.name || '').trim().length < 2) er.name = 'Enter an item name.';
    if (!/^[0-9]+$/.test((f.price || '').trim()) || price < 1 || price > 2000) er.price = 'Enter a price between 1 and 2000.';
    if (Object.keys(er).length) { state.fErr = er; render(); return; }
    const body = { name: f.name.trim(), category: f.cat, price, veg: f.veg === 'veg', image: (f.image || '').trim() };
    const wasEdit = !!f.id;
    (wasEdit ? api('PUT', '/api/admin/menu/' + f.id, body) : api('POST', '/api/admin/menu', body))
      .then((d) => applied(d, body.name + (wasEdit ? ' updated' : ' added to the menu')))
      .catch((e) => { state.fErr = { server: e.message }; render(); });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const fn = ACTIONS[b.dataset.act];
    if (fn) fn(b.dataset.arg);
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f) { state[t.dataset.f] = t.value; render(); }
    else if (t.dataset.ff) { state.form[t.dataset.ff] = t.value; }   // dialog fields: no redraw while typing
  });

  document.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.dataset.form === 'item') saveItem();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.form) ACTIONS.closeform();
    else if (state.confirm) ACTIONS.confirmno();
  });

  // Check for new orders and changes every 15 seconds.
  setInterval(() => {
    if (state.form || state.confirm || state.loading) return;
    fetch('/api/admin/dashboard', { credentials: 'same-origin' })
      .then((r) => { if (r.status === 401 || r.status === 403) { window.location.href = '/login'; return null; } return r.ok ? r.json() : null; })
      .then((d) => {
        if (!d) return;
        const txt = JSON.stringify(d);
        if (txt === lastTxt) return;
        const known = new Set(state.orders.map((o) => o.id));
        lastTxt = txt;
        load(d);
        const fresh = state.orders.filter((o) => !known.has(o.id));
        render();
        if (fresh.length) note(fresh.length === 1 ? 'New order ' + fresh[0].id : fresh.length + ' new orders');
      })
      .catch(() => { /* try again next time */ });
  }, 15000);

  render();
})();
