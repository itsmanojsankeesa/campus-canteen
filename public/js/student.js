// Student app: home, menu, cart, checkout, orders, profile.
// All data comes from the server (MongoDB) through the window.CANTEEN_* values set in student.ejs.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (d, s, o) => { o = o || {}; return `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="${o.fill || 'none'}" stroke="${o.stroke || 'currentColor'}" stroke-width="${o.w || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`; };
  const P = {
    bowl: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 7c0-1.5 1-1.5 1-3M14 7c0-1.5 1-1.5 1-3"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6"/>',
    heart: '<path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.7l8.8-8.7a5.2 5.2 0 0 0 0-7.4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'
  };

  // ---------- sample data ----------
  const TONES = { Breakfast: '#F3D9A4', Meals: '#CFE3C6', Snacks: '#F6C99B', Beverages: '#BFD9D2', 'Fast Food': '#F1B9A0', Desserts: '#EBC6D3' };
  const CATS = ['Breakfast', 'Meals', 'Snacks', 'Beverages', 'Fast Food', 'Desserts'];
  const MENU = (window.CANTEEN_MENU || []).map((x, i) => ({
    id: i + 1, dbId: String(x._id), name: x.name, cat: x.category, price: x.price, veg: x.veg,
    rating: x.rating, prep: x.prepTime, pop: x.popularity, desc: x.description,
    avail: x.available, tone: TONES[x.category] || '#EEE', image: x.image || ''
  }));
  const BY = {}, BYDB = {}, BYNAME = {};
  MENU.forEach((x) => { BY[x.id] = x; BYDB[x.dbId] = x; BYNAME[x.name] = x; });

  // Combos come from the server (config/combos.js). A combo is hidden if one of its items is missing.
  const COMBOS = (window.CANTEEN_COMBOS || [])
    .map((c) => ({ id: c.id, title: c.title, text: c.text, price: c.price, items: c.items.map((n) => (BYNAME[n] || {}).id) }))
    .filter((c) => c.items.every(Boolean));
  const STAGES = ['Placed', 'Accepted', 'Preparing', 'Ready for pickup', 'Completed'];
  const stageName = (o) => (o.stage < 0 ? 'Cancelled' : STAGES[o.stage]);
  const isActive = (o) => o.stage >= 0 && o.stage < 4;

  function fmtDate(iso) {
    const d = new Date(iso), now = new Date(), y = new Date(Date.now() - 864e5);
    const t = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    const same = (a, b) => a.toDateString() === b.toDateString();
    return same(d, now) ? 'Today, ' + t : same(d, y) ? 'Yesterday, ' + t : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + t;
  }
  // Turns a saved order from MongoDB into the shape this page uses.
  function mapOrder(o) {
    return {
      id: o.orderNo, token: o.token, date: fmtDate(o.createdAt), stage: o.stage, total: o.total,
      loc: o.pickupLocation, time: o.pickupTime, pay: o.payment,
      items: (o.items || []).map((i) => ({ id: (BYDB[String(i.menuItem)] || {}).id, name: i.name, price: i.price, qty: i.qty }))
    };
  }

  const U = window.CANTEEN_USER || {};
  const favs = {};
  (window.CANTEEN_FAVS || []).forEach((id) => { if (BYDB[id]) favs[BYDB[id].id] = true; });
  const state = {
    view: 'home', cat: 'All', q: '', vegOnly: false, stockOnly: false, maxPrice: '0', sort: 'popular',
    cart: {}, favs, toast: '', placing: false,
    name: U.name || '', roll: U.roll || '', phone: U.phone || '', email: U.email || '', dept: U.dept || 'Electronics and Communication',
    editing: false, d: {}, pErr: {}, errs: {}, loc: 'Main Canteen Counter', time: 'As soon as ready', pay: 'upi', last: null,
    orders: (window.CANTEEN_ORDERS || []).map(mapOrder)
  };

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
    Object.assign(state, { view, errs: {} }, patch || {});
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  function addMany(pairs, msg) {
    pairs.forEach(([id, n]) => { if (BY[id] && BY[id].avail) state.cart[id] = (state.cart[id] || 0) + n; });
    if (msg) note(msg);
    render();
  }
  function setQty(id, qty) {
    if (qty <= 0) delete state.cart[id]; else state.cart[id] = qty;
    render();
  }

  function calc() {
    const lines = Object.keys(state.cart).filter((id) => state.cart[id] > 0).map(Number).map((id) => {
      const it = BY[id], qty = state.cart[id];
      return Object.assign({}, it, { qty, line: it.price * qty });
    });
    const subtotal = lines.reduce((a, l) => a + l.line, 0);
    const discount = COMBOS.reduce((a, c) => {
      const k = Math.min.apply(null, c.items.map((i) => state.cart[i] || 0));
      const full = c.items.reduce((x, i) => x + BY[i].price, 0);
      return a + k * (full - c.price);
    }, 0);
    return {
      lines, subtotal, discount, total: subtotal - discount,
      count: lines.reduce((a, l) => a + l.qty, 0),
      eta: lines.length ? Math.max.apply(null, lines.map((l) => l.prep)) + 2 : 0
    };
  }

  const opt = (val, label, cur) => `<option value="${val}"${String(cur) === String(val) ? ' selected' : ''}>${label}</option>`;
  const vi = (veg) => `<span class="vi ${veg ? 'veg' : 'nonveg'}" role="img" aria-label="${veg ? 'Vegetarian' : 'Non-vegetarian'}"><i></i></span>`;
  const H1 = 'font-size: 40px; font-weight: 800; color: #12342A';
  const fieldErr = (k) => state.errs[k] ? `<p class="errtxt">${state.errs[k]}</p>` : '';

  // ---------- header ----------
  function headerHtml(c) {
    const v = state.view;
    const nav = [['home', 'Home'], ['menu', 'Menu'], ['orders', 'My Orders'], ['profile', 'Profile']];
    const initials = state.name.split(' ').map((x) => x.charAt(0)).slice(0, 2).join('').toUpperCase();
    return `<div class="wrap bar">
      <button type="button" class="brand" data-act="go" data-arg="home"><span class="logo">${svg(P.bowl, 22, { stroke: '#fff' })}</span>Campus Canteen</button>
      <nav class="nav" aria-label="Main">
        ${nav.map(([k, label]) => `<button type="button" class="navbtn ${v === k ? 'on' : ''}" aria-current="${v === k ? 'page' : 'false'}" data-act="go" data-arg="${k}">${label}</button>`).join('')}
      </nav>
      <div class="right" style="display: flex; align-items: center; gap: 10px">
        <button type="button" class="cartbtn ${v === 'cart' ? 'on' : ''}" data-act="go" data-arg="cart" aria-label="Cart, ${c.count} items">${svg(P.cart, 20)} Cart ${c.count > 0 ? `<span class="badge">${c.count}</span>` : ''}</button>
        <button type="button" class="avatar" aria-label="Open profile" data-act="go" data-arg="profile">${esc(initials)}</button>
      </div>
    </div>`;
  }

  // ---------- food card + grid ----------
  function cardHtml(it) {
    const qty = state.cart[it.id] || 0, fav = !!state.favs[it.id];
    return `<article class="card food">
      <div class="art" style="background: ${it.tone}">
        <div class="plate"><i style="background: ${it.tone}">${esc(it.name.charAt(0))}</i></div>
        ${it.image ? `<img class="photo" src="${esc(it.image)}" alt="${esc(it.name)}" loading="lazy" onerror="this.remove()">` : ''}
        ${it.pop >= 95 && it.avail ? '<span class="hot">Popular</span>' : ''}
        ${!it.avail ? '<div class="sold">Sold out</div>' : ''}
        <button type="button" class="fav ${fav ? 'on' : ''}" aria-pressed="${fav}" aria-label="${fav ? 'Remove ' + esc(it.name) + ' from favourites' : 'Save ' + esc(it.name) + ' to favourites'}" data-act="fav" data-arg="${it.id}">${svg(P.heart, 22)}</button>
      </div>
      <div class="fbody">
        <div style="display: flex; gap: 8px; align-items: center">${vi(it.veg)}<h3 style="font-size: 19px; font-weight: 700">${esc(it.name)}</h3></div>
        <p class="desc">${esc(it.desc)}</p>
        <div class="meta">
          <span>${svg(P.star, 16, { fill: '#E8A317', stroke: '#E8A317', w: 1.5 })}<b style="color: #1C2A23">${it.rating}</b></span>
          <span>${svg(P.clock, 16)}${it.prep} min</span>
          <span>${it.avail ? 'Available' : 'Sold out'}</span>
        </div>
        <div class="row" style="margin-top: 6px">
          <span class="price">₹${it.price}</span>
          ${it.avail && qty === 0 ? `<button type="button" class="btn" data-act="add" data-arg="${it.id}" aria-label="Add ${esc(it.name)} to cart">Add to cart</button>` : ''}
          ${it.avail && qty > 0 ? qtyHtml(it.id, it.name, qty) : ''}
        </div>
      </div>
    </article>`;
  }
  function qtyHtml(id, name, qty) {
    return `<div class="qty" role="group" aria-label="${esc(name)} quantity">
      <button type="button" aria-label="Decrease quantity" data-act="dec" data-arg="${id}">${svg(P.minus, 18, { w: 2.5 })}</button>
      <b>${qty}</b>
      <button type="button" aria-label="Increase quantity" data-act="inc" data-arg="${id}">${svg(P.plus, 18, { w: 2.5 })}</button>
    </div>`;
  }

  function gridHtml(isHome) {
    let list = MENU.slice();
    if (!isHome) {
      const q = state.q.trim().toLowerCase(), max = parseInt(state.maxPrice, 10);
      list = list.filter((x) => (state.cat === 'All' || x.cat === state.cat) && (!state.vegOnly || x.veg) && (!state.stockOnly || x.avail) && (!max || x.price <= max) &&
        (!q || (x.name + ' ' + x.desc + ' ' + x.cat).toLowerCase().indexOf(q) >= 0));
      const sorts = { popular: (a, b) => b.pop - a.pop, rating: (a, b) => b.rating - a.rating, low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, fast: (a, b) => a.prep - b.prep };
      list.sort(sorts[state.sort] || sorts.popular);
    } else {
      list = list.filter((x) => x.avail).sort((a, b) => b.pop - a.pop).slice(0, 4);
    }
    return `<section class="${isHome ? 'sec' : ''}" aria-labelledby="h-grid" style="padding-bottom: 8px">
      <div class="row" style="flex-wrap: wrap">
        <h2 id="h-grid" style="font-size: 28px; font-weight: 800; color: #12342A">${isHome ? 'Popular right now' : (state.cat === 'All' ? 'All items' : state.cat)}</h2>
        ${isHome ? '<button type="button" class="btn ghost" data-act="go" data-arg="menu">See full menu</button>' : `<p role="status" style="color: #55655C">${list.length} ${list.length === 1 ? 'item' : 'items'}</p>`}
      </div>
      <div class="grid" style="margin-top: 20px">${list.map(cardHtml).join('')}</div>
      ${!isHome && list.length === 0 ? `<div class="card" style="margin-top: 20px; padding: 48px 24px; text-align: center">
        <div style="width: 96px; height: 96px; margin: 0 auto; border-radius: 50%; background: #E4EFE7; display: grid; place-items: center">${svg(P.search, 40, { stroke: '#1F5A3F', w: 1.8 })}</div>
        <h3 style="margin-top: 20px; font-size: 24px; font-weight: 800">No food matches your search</h3>
        <p style="margin-top: 8px; color: #55655C">Try a different word, or remove a filter to see more items.</p>
        <button type="button" class="btn" style="margin-top: 20px" data-act="clear">Clear search and filters</button>
      </div>` : ''}
    </section>`;
  }

  // ---------- views ----------
  function homeHtml() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `<section style="display: flex; flex-wrap: wrap; gap: 32px; align-items: center; background: #1F5A3F; color: #fff; border-radius: 28px; padding: clamp(24px, 5vw, 56px); overflow: hidden">
      <div style="flex: 1 1 360px; min-width: 0">
        <p style="font-weight: 700; color: #F9C58D">${greeting}, ${esc(state.name.split(' ')[0])}</p>
        <h1 style="margin-top: 10px; font-size: clamp(34px, 5vw, 58px); line-height: 1.04; font-weight: 800">Skip the queue.<br>Lunch is ready when you are.</h1>
        <p style="margin-top: 16px; font-size: 18px; color: #D6E6DB; max-width: 460px">Pick your food, choose a pickup slot, and collect it with your token.</p>
        <form data-form="hero" style="margin-top: 28px; display: flex; flex-wrap: wrap; gap: 10px; background: #fff; border-radius: 999px; padding: 6px; max-width: 520px">
          <label for="hero-q" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Search for food</label>
          <input id="hero-q" data-f="q" data-quiet="1" value="${esc(state.q)}" placeholder="Search dosa, biryani, chai" style="flex: 1 1 180px; min-width: 0; min-height: 44px; border: 0; background: none; padding: 0 16px; color: #1C2A23; outline-offset: 2px">
          <button type="submit" class="btn or">Search</button>
        </form>
      </div>
      <div style="flex: 1 1 320px; position: relative; height: 340px; min-width: 280px" aria-hidden="true">
        <div style="position: absolute; width: 250px; height: 250px; right: 6%; top: 0; border-radius: 50%; background: #fff; display: grid; place-items: center; box-shadow: 0 24px 50px rgba(0,0,0,.25)"><div style="width: 190px; height: 190px; border-radius: 50%; background: #F3D9A4"></div></div>
        <div style="position: absolute; width: 170px; height: 170px; left: 4%; bottom: 10px; border-radius: 50%; background: #fff; display: grid; place-items: center; box-shadow: 0 20px 40px rgba(0,0,0,.25)"><div style="width: 128px; height: 128px; border-radius: 50%; background: #CFE3C6"></div></div>
        <div style="position: absolute; width: 120px; height: 120px; right: 0; bottom: 0; border-radius: 50%; background: #fff; display: grid; place-items: center; box-shadow: 0 16px 30px rgba(0,0,0,.25)"><div style="width: 88px; height: 88px; border-radius: 50%; background: #F1B9A0"></div></div>
        <div style="position: absolute; left: 0; top: 40px; background: #fff; color: #1C2A23; border-radius: 16px; padding: 12px 16px; box-shadow: 0 12px 30px rgba(0,0,0,.2)">
          <p style="font-size: 13px; color: #55655C">Average prep time</p>
          <p class="disp" style="font-size: 22px; font-weight: 800">5 to 12 min</p>
        </div>
      </div>
    </section>

    <section class="sec" aria-labelledby="h-cat">
      <h2 id="h-cat">Browse by category</h2>
      <div style="margin-top: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr)); gap: 14px">
        ${CATS.map((c) => `<button type="button" class="catcard" data-act="catcard" data-arg="${c}">
          <span style="width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-weight: 800; color: #12342A; background: ${TONES[c]}">${c.charAt(0)}</span>
          <span><b style="display: block">${c}</b><span style="color: #55655C; font-size: 14px">${MENU.filter((x) => x.cat === c).length} items</span></span>
        </button>`).join('')}
      </div>
    </section>

    ${gridHtml(true)}

    <section class="sec" aria-labelledby="h-off">
      <h2 id="h-off">Special offers</h2>
      <div style="margin-top: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 20px">
        ${COMBOS.map((o) => `<div class="offer">
          <span style="font-weight: 800; font-size: 13px; color: #A84A07; letter-spacing: .06em">COMBO</span>
          <h3 style="font-size: 22px; font-weight: 800">${o.title}</h3>
          <p style="color: #6B3305">${o.text}</p>
          <div class="row" style="margin-top: 6px">
            <span><b class="disp" style="font-size: 24px">₹${o.price}</b> <s style="color: #6B3305">₹${o.items.reduce((x, i) => x + BY[i].price, 0)}</s></span>
            <button type="button" class="btn" data-act="combo" data-arg="${o.id}">Add combo</button>
          </div>
        </div>`).join('')}
      </div>
    </section>`;
  }

  function menuHtml() {
    const hasFilters = state.cat !== 'All' || state.q.trim() !== '' || state.vegOnly || state.stockOnly || state.maxPrice !== '0' || state.sort !== 'popular';
    return `<section style="padding-top: 8px">
      <h1 style="${H1}">Menu</h1>
      <p style="margin-top: 4px; color: #55655C">Order now and pick up from the counter you choose at checkout.</p>
      <form data-form="menu" role="search" style="margin-top: 20px; position: relative; max-width: 640px">
        <label for="menu-q" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Search the menu</label>
        <span style="position: absolute; left: 16px; top: 14px; color: #55655C">${svg(P.search, 20)}</span>
        <input id="menu-q" class="in" data-f="q" value="${esc(state.q)}" placeholder="Search food items" style="padding-left: 46px">
      </form>
      <div class="chips" style="margin-top: 16px" role="group" aria-label="Category">
        ${['All'].concat(CATS).map((c) => `<button type="button" class="chip ${state.cat === c ? 'on' : ''}" aria-pressed="${state.cat === c}" data-act="cat" data-arg="${c}">${c}</button>`).join('')}
      </div>
      <div style="margin-top: 16px; display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: flex-end">
        <button type="button" class="chip ${state.vegOnly ? 'on' : ''}" aria-pressed="${state.vegOnly}" data-act="veg">Vegetarian only</button>
        <button type="button" class="chip ${state.stockOnly ? 'on' : ''}" aria-pressed="${state.stockOnly}" data-act="stock">Available now</button>
        <div style="flex: 0 1 200px">
          <label class="lab" for="f-price" style="margin-bottom: 4px">Price</label>
          <select id="f-price" class="in" data-f="maxPrice">${opt('0', 'Any price', state.maxPrice)}${opt('50', 'Under ₹50', state.maxPrice)}${opt('100', 'Under ₹100', state.maxPrice)}${opt('150', 'Under ₹150', state.maxPrice)}</select>
        </div>
        <div style="flex: 0 1 220px">
          <label class="lab" for="f-sort" style="margin-bottom: 4px">Sort by</label>
          <select id="f-sort" class="in" data-f="sort">${opt('popular', 'Most popular', state.sort)}${opt('rating', 'Top rated', state.sort)}${opt('low', 'Price: low to high', state.sort)}${opt('high', 'Price: high to low', state.sort)}${opt('fast', 'Quickest prep', state.sort)}</select>
        </div>
        ${hasFilters ? '<button type="button" class="btn ghost" data-act="clear">Clear filters</button>' : ''}
      </div>
    </section>
    ${gridHtml(false)}`;
  }

  function cartHtml(c) {
    if (!c.count) {
      return `<section style="padding-top: 8px"><h1 style="${H1}">Your cart</h1>
        <div class="card" style="margin-top: 24px; padding: 56px 24px; text-align: center">
          <div style="width: 110px; height: 110px; margin: 0 auto; border-radius: 50%; background: #FCE9D3; display: grid; place-items: center">${svg(P.cart, 48, { stroke: '#A84A07', w: 1.8 })}</div>
          <h2 style="margin-top: 20px; font-size: 26px; font-weight: 800">Your cart is empty</h2>
          <p style="margin-top: 8px; color: #55655C">Add something from the menu and it will show up here.</p>
          <button type="button" class="btn" style="margin-top: 20px" data-act="go" data-arg="menu">Browse the menu</button>
        </div></section>`;
    }
    return `<section style="padding-top: 8px"><h1 style="${H1}">Your cart</h1>
      <div class="split" style="margin-top: 24px">
        <div class="main"><ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 14px">
          ${c.lines.map((l) => `<li class="card" style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 14px">
            <div style="width: 80px; height: 80px; border-radius: 14px; display: grid; place-items: center; flex: none; background: ${l.tone}"><div class="disp" style="width: 56px; height: 56px; border-radius: 50%; background: #fff; display: grid; place-items: center; font-weight: 800; color: #12342A">${esc(l.name.charAt(0))}</div></div>
            <div style="flex: 1 1 160px; min-width: 0">
              <div style="display: flex; gap: 8px; align-items: center">${vi(l.veg)}<b style="font-size: 18px">${esc(l.name)}</b></div>
              <p style="color: #55655C">₹${l.price} each</p>
            </div>
            ${qtyHtml(l.id, l.name, l.qty)}
            <b style="min-width: 64px; text-align: right; font-size: 18px">₹${l.line}</b>
            <button type="button" class="icobtn" aria-label="Remove ${esc(l.name)} from cart" data-act="remove" data-arg="${l.id}">${svg(P.trash, 20)}</button>
          </li>`).join('')}
        </ul></div>
        <aside class="side card" style="padding: 22px" aria-label="Order summary">
          <h2 style="font-size: 22px; font-weight: 800">Order summary</h2>
          <div class="row" style="margin-top: 16px"><span style="color: #55655C">Subtotal (${c.count} items)</span><b>₹${c.subtotal}</b></div>
          ${c.discount > 0 ? `<div class="row" style="margin-top: 10px"><span style="color: #1F5A3F; font-weight: 600">Combo savings</span><b style="color: #1F5A3F">−₹${c.discount}</b></div>` : ''}
          <div class="row" style="margin-top: 10px"><span style="color: #55655C">Packing and taxes</span><b>Included</b></div>
          <div class="row" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #E7E0D1"><b style="font-size: 18px">Total</b><b class="disp" style="font-size: 28px">₹${c.total}</b></div>
          <button type="button" class="btn full" style="margin-top: 20px" data-act="go" data-arg="checkout">Proceed to checkout</button>
          <button type="button" class="btn ghost full" style="margin-top: 10px" data-act="go" data-arg="menu">Add more items</button>
        </aside>
      </div></section>`;
  }

  function checkoutHtml(c) {
    const s = state, hasErrs = Object.keys(s.errs).length > 0;
    const fs = 'border: 1px solid #E7E0D1; padding: 22px; margin: 0; min-width: 0';
    const lg = 'padding: 0 8px; font-weight: 800; font-size: 18px';
    const field = (id, key, label, auto) => `<div class="field"><label for="${id}">${label}</label><input id="${id}" class="in ${s.errs[key] ? 'err' : ''}" data-f="${key}" data-quiet="1" value="${esc(s[key])}" ${auto ? `autocomplete="${auto}"` : ''} aria-invalid="${!!s.errs[key]}">${fieldErr(key)}</div>`;
    const locs = ['Main Canteen Counter', 'Engineering Block Kiosk', 'Library Cafe Window', 'Hostel Mess Window'];
    const times = ['As soon as ready', '12:30 PM', '12:45 PM', '1:00 PM', '1:15 PM', '1:30 PM'];
    return `<section style="padding-top: 8px"><h1 style="${H1}">Checkout</h1>
      ${hasErrs ? '<div role="alert" style="margin-top: 16px; background: #FDECEA; border: 1px solid #F2B8B3; color: #8C1D18; border-radius: 12px; padding: 12px 14px; font-weight: 600">Please fix the highlighted fields before placing your order.</div>' : ''}
      <form data-form="checkout" novalidate>
        <div class="split" style="margin-top: 24px">
          <div class="main" style="display: flex; flex-direction: column; gap: 20px">
            <fieldset class="card" style="${fs}"><legend class="disp" style="${lg}">Student details</legend>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 16px">
                ${field('c-name', 'name', 'Full name', 'name')}${field('c-roll', 'roll', 'Roll number')}${field('c-phone', 'phone', 'Mobile number', 'tel')}
              </div>
            </fieldset>
            <fieldset class="card" style="${fs}"><legend class="disp" style="${lg}">Pickup</legend>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 16px">
                <div class="field"><label for="c-loc">Pickup location</label><select id="c-loc" class="in" data-f="loc" data-quiet="1">${locs.map((x) => opt(x, x, s.loc)).join('')}</select></div>
                <div class="field"><label for="c-time">Pickup time</label><select id="c-time" class="in" data-f="time" data-quiet="1">${times.map((x) => opt(x, x, s.time)).join('')}</select></div>
              </div>
            </fieldset>
            <fieldset class="card" style="${fs}"><legend class="disp" style="${lg}">Payment</legend>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 12px">
                <label class="radio ${s.pay === 'upi' ? 'on' : ''}"><input type="radio" name="pay" data-act="pay" data-arg="upi" ${s.pay === 'upi' ? 'checked' : ''}><span><b style="display: block">UPI</b><span style="color: #55655C; font-size: 14px">Pay with any UPI app</span></span></label>
                <label class="radio ${s.pay === 'cash' ? 'on' : ''}"><input type="radio" name="pay" data-act="pay" data-arg="cash" ${s.pay === 'cash' ? 'checked' : ''}><span><b style="display: block">Cash at the counter</b><span style="color: #55655C; font-size: 14px">Pay when you collect</span></span></label>
              </div>
              <p class="note" style="margin-top: 14px">Payment is simulated. Real UPI needs a payment gateway and a backend.</p>
            </fieldset>
          </div>
          <aside class="side card" style="padding: 22px" aria-label="Order summary">
            <h2 style="font-size: 22px; font-weight: 800">Order summary</h2>
            <ul style="list-style: none; padding: 0; margin-top: 14px; display: flex; flex-direction: column; gap: 10px">
              ${c.lines.map((l) => `<li class="row"><span>${l.qty} × ${esc(l.name)}</span><b>₹${l.line}</b></li>`).join('')}
            </ul>
            ${c.discount > 0 ? `<div class="row" style="margin-top: 12px"><span style="color: #1F5A3F; font-weight: 600">Combo savings</span><b style="color: #1F5A3F">−₹${c.discount}</b></div>` : ''}
            <div class="row" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #E7E0D1"><b style="font-size: 18px">Total</b><b class="disp" style="font-size: 28px">₹${c.total}</b></div>
            <p style="margin-top: 10px; color: #55655C; font-size: 14px">Estimated preparation: ${c.eta} min</p>
            <button type="submit" class="btn full" style="margin-top: 18px" ${s.placing ? 'disabled' : ''}>${s.placing ? '<span class="spin" aria-hidden="true"></span>' : ''}${s.placing ? 'Placing order...' : 'Place order · ₹' + c.total}</button>
            <button type="button" class="btn ghost full" style="margin-top: 10px" data-act="go" data-arg="cart">Back to cart</button>
          </aside>
        </div>
      </form></section>`;
  }

  function confirmHtml() {
    const l = state.last || { id: '', token: '', loc: '', time: '', total: 0, eta: 0, payLabel: '' };
    const lab = 'color: #55655C; font-size: 14px';
    return `<section style="padding-top: 24px; display: grid; place-items: center">
      <div class="card" style="width: 100%; max-width: 560px; padding: clamp(24px, 5vw, 44px); text-align: center">
        <div style="width: 84px; height: 84px; margin: 0 auto; border-radius: 50%; background: #1F5A3F; display: grid; place-items: center">${svg(P.check, 44, { stroke: '#fff', w: 3 })}</div>
        <h1 style="margin-top: 20px; font-size: 36px; font-weight: 800; color: #12342A">Order placed</h1>
        <p style="margin-top: 6px; color: #55655C" role="status">Order ${l.id} is with the kitchen.</p>
        <div style="margin-top: 24px; background: #FAF6EE; border: 1.5px dashed #C9C2B1; border-radius: 18px; padding: 20px">
          <p style="color: #55655C; font-size: 14px; font-weight: 600">Your pickup token</p>
          <p class="disp" style="font-size: 64px; font-weight: 800; color: #1F5A3F; line-height: 1.1">${l.token}</p>
        </div>
        <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; text-align: left">
          <div><p style="${lab}">Pickup at</p><b>${esc(l.loc)}</b></div>
          <div><p style="${lab}">Pickup time</p><b>${esc(l.time)}</b></div>
          <div><p style="${lab}">Total (${l.payLabel})</p><b>₹${l.total}</b></div>
          <div><p style="${lab}">Ready in about</p><b>${l.eta} min</b></div>
        </div>
        <div style="margin-top: 28px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center">
          <button type="button" class="btn" data-act="go" data-arg="orders">Track this order</button>
          <button type="button" class="btn ghost" data-act="go" data-arg="menu">Order more</button>
        </div>
      </div></section>`;
  }

  function ordersHtml() {
    const itemsText = (o) => o.items.map((i) => i.qty + ' × ' + i.name).join(', ');
    const o = state.orders.find(isActive);
    let activeHtml;
    if (o) {
      const eta = Math.max.apply(null, o.items.map((i) => (BY[i.id] || { prep: 5 }).prep)) + 2;
      const msg = o.stage === 3 ? 'Your food is ready. Show your token at the counter.' : o.stage === 2 ? 'The kitchen is preparing your order.' : 'We have your order and will confirm it shortly.';
      activeHtml = `<div class="card" style="margin-top: 24px; padding: clamp(18px, 3vw, 30px)">
        <div class="row" style="flex-wrap: wrap">
          <div><p style="color: #55655C; font-size: 14px; font-weight: 600">Current order</p><h2 style="font-size: 26px; font-weight: 800">${o.id}</h2></div>
          <span class="pill or">${stageName(o)}</span>
        </div>
        <ol class="steps" style="margin-top: 26px" aria-label="Order progress">
          ${STAGES.map((label, i) => {
            const done = i < o.stage || o.stage === 4;
            const cls = done ? 'done' : i === o.stage ? 'cur' : '';
            return `<li class="${cls}" aria-current="${i === o.stage ? 'step' : 'false'}"><div class="dot">${done ? svg(P.check, 20, { w: 3 }) : i + 1}</div>${label}</li>`;
          }).join('')}
        </ol>
        <div class="split" style="margin-top: 28px">
          <div class="main">
            <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px">
              ${o.items.map((i) => `<li class="row"><span>${i.qty} × ${esc(i.name)}</span><b>₹${i.price * i.qty}</b></li>`).join('')}
            </ul>
            <div class="row" style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #E7E0D1"><b>Total</b><b class="disp" style="font-size: 22px">₹${o.total}</b></div>
            <p style="margin-top: 12px; color: #55655C">Estimated preparation: ${eta} min. Pickup at ${esc(o.loc)}, ${esc(o.time)}.</p>
            <p style="margin-top: 6px; font-weight: 600; color: #1F5A3F">${msg}</p>
          </div>
          <div class="side" style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap">
            <div><p style="color: #55655C; font-size: 14px; font-weight: 600">Pickup token</p><p class="disp" style="font-size: 44px; font-weight: 800; color: #1F5A3F; line-height: 1.1">${o.token}</p></div>
          </div>
        </div>
        <p class="note" style="margin-top: 22px">This page updates by itself. When the status says Ready for pickup, show your token at the counter.</p>
      </div>`;
    } else {
      activeHtml = `<div class="card" style="margin-top: 24px; padding: 32px 24px; text-align: center">
        <h2 style="font-size: 22px; font-weight: 800">No order in progress</h2>
        <p style="margin-top: 6px; color: #55655C">Your next order will be tracked here.</p>
        <button type="button" class="btn" style="margin-top: 16px" data-act="go" data-arg="menu">Order something</button>
      </div>`;
    }
    const history = state.orders.filter((x) => x !== o);
    return `<section style="padding-top: 8px"><h1 style="${H1}">My orders</h1>
      ${activeHtml}
      <h2 style="margin-top: 40px; font-size: 26px; font-weight: 800; color: #12342A">Order history</h2>
      <ul style="list-style: none; padding: 0; margin-top: 16px; display: flex; flex-direction: column; gap: 12px">
        ${history.length === 0 ? '<li class="card" style="padding: 18px; color: #55655C">No past orders yet.</li>' : ''}
        ${history.map((h) => `<li class="card" style="padding: 18px; display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center">
          <div style="flex: 1 1 260px; min-width: 0">
            <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center"><b>${h.id}</b><span class="pill">${stageName(h)}</span></div>
            <p style="margin-top: 4px; color: #55655C">${h.date} · ${esc(itemsText(h))}</p>
          </div>
          <b style="font-size: 18px">₹${h.total}</b>
          <button type="button" class="btn ghost" data-act="reorder" data-arg="${h.id}">Reorder</button>
        </li>`).join('')}
      </ul>
      </section>`;
  }

  function profileHtml() {
    const s = state;
    const initials = s.name.split(' ').map((x) => x.charAt(0)).slice(0, 2).join('').toUpperCase();
    const favs = MENU.filter((x) => s.favs[x.id]);
    const pf = (id, key, label) => `<div class="field"><label for="${id}">${label}</label><input id="${id}" class="in ${s.pErr[key] ? 'err' : ''}" data-d="${key}" value="${esc(s.d[key] || '')}">${s.pErr[key] ? `<p class="errtxt">${s.pErr[key]}</p>` : ''}</div>`;
    const depts = ['Computer Science and Engineering', 'Electronics and Communication', 'Electrical and Electronics', 'Mechanical Engineering', 'Civil Engineering', 'Information Technology'];
    const dd = (t) => `<div><dt style="color: #55655C; font-size: 14px">${t[0]}</dt><dd style="margin: 0; font-weight: 600; overflow-wrap: anywhere">${esc(t[1])}</dd></div>`;
    return `<section style="padding-top: 8px"><h1 style="${H1}">Profile</h1>
      <div class="split" style="margin-top: 24px">
        <div class="main" style="display: flex; flex-direction: column; gap: 20px">
          <div class="card" style="padding: clamp(18px, 3vw, 28px)">
            <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center">
              <div class="disp" style="width: 72px; height: 72px; border-radius: 50%; background: #FCE9D3; color: #A84A07; display: grid; place-items: center; font-weight: 800; font-size: 26px">${esc(initials)}</div>
              <div style="flex: 1 1 200px; min-width: 0"><h2 style="font-size: 26px; font-weight: 800">${esc(s.name)}</h2><p style="color: #55655C">${esc(s.roll)} · ${esc(s.dept)}</p></div>
              ${!s.editing ? '<button type="button" class="btn ghost" data-act="editprofile">Edit profile</button>' : ''}
            </div>
            ${!s.editing ? `<dl style="margin: 24px 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 16px">${dd(['Department', s.dept])}${dd(['Mobile', s.phone])}${dd(['Email', s.email])}</dl>` : `
            <form data-form="profile" novalidate style="margin-top: 24px">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 16px">
                ${pf('p-name', 'name', 'Full name')}
                <div class="field"><label for="p-dept">Department</label><select id="p-dept" class="in" data-d="dept">${depts.map((x) => opt(x, x, s.d.dept)).join('')}</select></div>
                ${pf('p-phone', 'phone', 'Mobile number')}${pf('p-email', 'email', 'Email')}
              </div>
              <div style="margin-top: 20px; display: flex; flex-wrap: wrap; gap: 12px"><button type="submit" class="btn">Save changes</button><button type="button" class="btn ghost" data-act="cancelprofile">Cancel</button></div>
            </form>`}
          </div>
          <div class="card" style="padding: clamp(18px, 3vw, 28px)">
            <h2 style="font-size: 22px; font-weight: 800">Favourite items</h2>
            ${favs.length === 0 ? '<p style="margin-top: 10px; color: #55655C">Tap the heart on any food item to save it here.</p>' : ''}
            <ul style="list-style: none; padding: 0; margin-top: 14px; display: flex; flex-direction: column; gap: 10px">
              ${favs.map((f) => `<li style="display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center">
                <div style="width: 52px; height: 52px; border-radius: 12px; flex: none; background: ${f.tone}"></div>
                <div style="flex: 1 1 160px; min-width: 0"><b>${esc(f.name)}</b><p style="color: #55655C; font-size: 14px">₹${f.price} · ${f.avail ? 'Available' : 'Sold out'}</p></div>
                <button type="button" class="btn ghost" ${f.avail ? '' : 'disabled'} data-act="add" data-arg="${f.id}">Add to cart</button>
                <button type="button" class="icobtn" aria-label="Remove ${esc(f.name)} from favourites" data-act="fav" data-arg="${f.id}">${svg(P.heart, 20, { fill: '#B3261E', stroke: '#B3261E' })}</button>
              </li>`).join('')}
            </ul>
          </div>
        </div>
        <aside class="side card" style="padding: 22px">
          <h2 style="font-size: 22px; font-weight: 800">Orders</h2>
          <p style="margin-top: 6px; color: #55655C">You have placed ${s.orders.length} orders.</p>
          <button type="button" class="btn ghost full" style="margin-top: 14px" data-act="go" data-arg="orders">View order history</button>
          <hr style="border: 0; border-top: 1px solid #E7E0D1; margin: 22px 0">
          <a class="btn full" href="/logout" style="background: #fff; color: #8C1D18; border: 1.5px solid #F2B8B3">Log out</a>
        </aside>
      </div></section>`;
  }

  // ---------- render ----------
  function render() {
    const active = document.activeElement;
    const aid = active && active.id, apos = active && active.selectionStart;
    const c = calc();
    $('topbar').innerHTML = headerHtml(c);
    const v = state.view;
    $('view').innerHTML = v === 'home' ? homeHtml() : v === 'menu' ? menuHtml() : v === 'cart' ? cartHtml(c) : v === 'checkout' ? checkoutHtml(c) :
      v === 'confirm' ? confirmHtml() : v === 'orders' ? ordersHtml() : profileHtml();
    if (aid) {
      const el = $(aid);
      if (el) { el.focus(); try { if (apos != null) el.setSelectionRange(apos, apos); } catch (e) { /* select / date inputs */ } }
    }
  }

  // ---------- actions ----------
  function placeOrder() {
    const c = calc();
    if (state.placing || !c.lines.length) return;
    const er = {};
    if (state.name.trim().length < 2) er.name = 'Enter your full name.';
    if (!/^[A-Za-z0-9]{8,12}$/.test(state.roll.trim())) er.roll = 'Roll number should be 8 to 12 letters or digits.';
    if (!/^[6-9][0-9]{9}$/.test(state.phone.trim())) er.phone = 'Enter a 10-digit mobile number.';
    if (Object.keys(er).length) { state.errs = er; render(); return; }
    state.errs = {}; state.placing = true; render();
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: c.lines.map((l) => ({ id: l.dbId, qty: l.qty })),
        name: state.name, roll: state.roll, phone: state.phone,
        pickupLocation: state.loc, pickupTime: state.time, payment: state.pay
      })
    })
      .then((r) => { if (r.status === 401) { window.location.href = '/login'; } return r.json().then((data) => ({ ok: r.ok, data })); })
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'Could not place the order.');
        const order = {
          id: data.orderNo, token: data.token, date: fmtDate(new Date().toISOString()), stage: 0, total: data.total,
          loc: state.loc, time: state.time, pay: state.pay,
          items: c.lines.map((l) => ({ id: l.id, name: l.name, price: l.price, qty: l.qty }))
        };
        state.orders = [order].concat(state.orders);
        state.cart = {}; state.placing = false;
        state.last = Object.assign({}, order, { eta: data.eta, payLabel: state.pay === 'upi' ? 'UPI' : 'cash at counter' });
        go('confirm');
      })
      .catch((err) => { state.placing = false; render(); note(err.message); });
  }

  function saveProfile() {
    const d = state.d, er = {};
    if ((d.name || '').trim().length < 2) er.name = 'Enter your full name.';
    if (!/^[6-9][0-9]{9}$/.test((d.phone || '').trim())) er.phone = 'Enter a 10-digit mobile number.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((d.email || '').trim())) er.email = 'Enter a valid email address.';
    if (Object.keys(er).length) { state.pErr = er; render(); return; }
    fetch('/api/me', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ name: d.name.trim(), dept: d.dept, phone: d.phone.trim(), email: d.email.trim() })
    })
      .then((r) => { if (r.status === 401) { window.location.href = '/login'; } return r.json().then((data) => ({ ok: r.ok, data })); })
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'Could not save your profile.');
        Object.assign(state, { name: data.name, dept: data.dept, phone: data.phone, email: data.email, editing: false, pErr: {} });
        render();
        note('Profile updated');
      })
      .catch((err) => note(err.message));
  }

  const ACTIONS = {
    go: (a) => go(a),
    add: (a) => { const it = BY[a]; if (!it || !it.avail) return; state.cart[a] = (state.cart[a] || 0) + 1; note(it.name + ' added to cart'); render(); },
    inc: (a) => setQty(+a, (state.cart[a] || 0) + 1),
    dec: (a) => setQty(+a, (state.cart[a] || 0) - 1),
    remove: (a) => { const n = BY[a].name; setQty(+a, 0); note(n + ' removed'); },
    fav: (a) => {
      const it = BY[a];
      const flip = () => { if (state.favs[a]) delete state.favs[a]; else state.favs[a] = true; };
      flip();
      render();
      note(state.favs[a] ? it.name + ' saved to favourites' : it.name + ' removed from favourites');
      fetch('/api/me/favourites/' + it.dbId, { method: 'POST', credentials: 'same-origin' })
        .then((r) => { if (!r.ok) throw new Error('save failed'); })
        .catch(() => { flip(); render(); note('Could not save that favourite'); });
    },
    catcard: (a) => go('menu', { cat: a, q: '' }),
    cat: (a) => { state.cat = a; render(); },
    veg: () => { state.vegOnly = !state.vegOnly; render(); },
    stock: () => { state.stockOnly = !state.stockOnly; render(); },
    clear: () => { Object.assign(state, { cat: 'All', q: '', vegOnly: false, stockOnly: false, maxPrice: '0', sort: 'popular' }); render(); },
    combo: (a) => { const c = COMBOS.find((x) => x.id === a); addMany(c.items.map((i) => [i, 1]), c.title + ' added to cart'); },
    pay: (a) => { state.pay = a; render(); },
    reorder: (a) => {
      const o = state.orders.find((x) => x.id === a);
      const pairs = o.items.filter((i) => i.id).map((i) => [i.id, i.qty]);
      if (!pairs.length) { note('Those items are no longer on the menu'); return; }
      addMany(pairs, 'Items from ' + o.id + ' added to cart');
      go('cart');
    },
    editprofile: () => { state.editing = true; state.pErr = {}; state.d = { name: state.name, dept: state.dept, phone: state.phone, email: state.email }; render(); },
    cancelprofile: () => { state.editing = false; state.pErr = {}; render(); }
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const fn = ACTIONS[b.dataset.act];
    if (fn) fn(b.dataset.arg);
  });

  // Fields marked data-quiet only save the value (no redraw), so typing never loses focus.
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f) { state[t.dataset.f] = t.value; if (!t.dataset.quiet) render(); }
    else if (t.dataset.d) { state.d[t.dataset.d] = t.value; }
  });

  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.dataset.form;
    if (f === 'hero') go('menu', { cat: 'All' });
    else if (f === 'checkout') placeOrder();
    else if (f === 'profile') saveProfile();
  });

  // Live order status: ask the server every 10 seconds.
  function pollOrders() {
    fetch('/api/orders/mine', { credentials: 'same-origin' })
      .then((r) => { if (r.status === 401) { window.location.href = '/login'; return null; } return r.ok ? r.json() : null; })
      .then((list) => {
        if (!list) return;
        const next = list.map(mapOrder);
        const key = (arr) => JSON.stringify(arr.map((o) => [o.id, o.stage]));
        const changed = key(next) !== key(state.orders);
        next.forEach((n) => {
          const old = state.orders.find((o) => o.id === n.id);
          if (old && old.stage !== n.stage) note('Order ' + n.id + ' is now ' + stageName(n).toLowerCase());
        });
        if (changed && !state.placing) { state.orders = next; render(); }
      })
      .catch(() => { /* try again next time */ });
  }
  setInterval(pollOrders, 10000);

  render();
})();
