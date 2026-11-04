// Sign in and register page. Talks to /auth/login and /auth/register on the server.
(function () {
  'use strict';

  const card = document.getElementById('card');
  const state = { role: 'student', mode: 'login', showPw: false, vals: {}, errs: {}, serverErr: '', busy: false };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EYE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>';

  function reset(patch) {
    Object.assign(state, { errs: {}, serverErr: '', busy: false, showPw: false, vals: {} }, patch);
    render();
  }

  function validate() {
    const { role, mode, vals } = state;
    const v = (k) => (vals[k] || '').trim();
    const e = {};
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email'));
    if (role === 'admin') {
      if (!emailOk) e.email = 'Enter a valid staff email, like name@college.edu.';
      if ((vals.pw || '').length < 6) e.pw = 'Password must be at least 6 characters.';
    } else if (mode === 'login') {
      if (!v('ident')) e.ident = 'Enter your roll number or college email.';
      if ((vals.pw || '').length < 6) e.pw = 'Password must be at least 6 characters.';
    } else {
      if (v('name').length < 2) e.name = 'Enter your full name.';
      if (!/^[A-Za-z0-9]{8,12}$/.test(v('roll'))) e.roll = 'Roll number should be 8 to 12 letters or digits.';
      if (!emailOk) e.email = 'Enter a valid email address.';
      if (!/^[6-9][0-9]{9}$/.test(v('phone'))) e.phone = 'Enter a 10-digit mobile number.';
      const pw = vals.pw || '';
      if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) e.pw = 'Use 8 or more characters with letters and digits.';
      if (!vals.pw2 || vals.pw2 !== pw) e.pw2 = 'Passwords do not match.';
    }
    return e;
  }

  function fieldList() {
    const isAdmin = state.role === 'admin';
    const reg = !isAdmin && state.mode === 'register';
    const f = (id, label, type, extra) => Object.assign({ id, label, type, auto: 'off', ph: '' }, extra);
    if (isAdmin) return [f('email', 'Staff email', 'email', { auto: 'username', ph: 'name@college.edu' }), f('pw', 'Password', 'password', { auto: 'current-password' })];
    if (reg) return [
      f('name', 'Full name', 'text', { auto: 'name' }),
      f('roll', 'Roll number', 'text', { ph: 'e.g. 24B61A0412' }),
      f('email', 'College email', 'email', { auto: 'email' }),
      f('phone', 'Mobile number', 'tel', { auto: 'tel', ph: '10 digits' }),
      f('pw', 'Password', 'password', { auto: 'new-password' }),
      f('pw2', 'Confirm password', 'password', { auto: 'new-password' })
    ];
    return [f('ident', 'Roll number or college email', 'text', { auto: 'username' }), f('pw', 'Password', 'password', { auto: 'current-password' })];
  }

  function fieldHtml(f) {
    const err = state.errs[f.id] || '';
    const isPw = f.type === 'password';
    const type = isPw && state.showPw ? 'text' : f.type;
    return `<div>
      <label class="lab" for="f-${f.id}">${f.label}</label>
      <div style="position: relative">
        <input class="in ${err ? 'err' : ''}" id="f-${f.id}" data-k="${f.id}" type="${type}" value="${esc(state.vals[f.id] || '')}" autocomplete="${f.auto}" placeholder="${f.ph}" aria-invalid="${!!err}">
        ${isPw ? `<button type="button" class="eye" data-act="pw" aria-label="${state.showPw ? 'Hide password' : 'Show password'}" aria-pressed="${state.showPw}">${EYE}</button>` : ''}
      </div>
      ${err ? `<p class="errtxt">${err}</p>` : ''}
    </div>`;
  }

  function render() {
    const s = state;
    const isAdmin = s.role === 'admin';
    const isStudent = !isAdmin;
    const reg = isStudent && s.mode === 'register';
    const hasErrors = Object.keys(s.errs).length > 0;

    const active = document.activeElement && document.activeElement.id;

    card.innerHTML = `
      <div class="seg" role="group" aria-label="Account type">
        <button type="button" class="${isStudent ? 'on' : ''}" data-act="student" aria-pressed="${isStudent}">Student</button>
        <button type="button" class="${isAdmin ? 'on' : ''}" data-act="admin" aria-pressed="${isAdmin}">Canteen admin</button>
      </div>

      <h2 style="margin-top: 28px; font-size: 30px; font-weight: 800; color: #12342A">${isAdmin ? 'Admin sign in' : reg ? 'Create your account' : 'Welcome back'}</h2>
      <p style="margin-top: 6px; color: #55655C">${isAdmin ? 'Manage orders, menu and stock for the canteen.' : reg ? 'Register with your college details to start ordering.' : 'Sign in to order food for pickup.'}</p>

      ${hasErrors || s.serverErr ? `<div role="alert" style="margin-top: 20px; background: #FDECEA; border: 1px solid #F2B8B3; color: #8C1D18; border-radius: 12px; padding: 12px 14px; font-weight: 600">${s.serverErr ? esc(s.serverErr) : 'Please fix the highlighted fields and try again.'}</div>` : ''}

      <form id="auth-form" novalidate style="margin-top: 24px; display: flex; flex-direction: column; gap: 18px">
        ${fieldList().map(fieldHtml).join('')}
        <button type="submit" class="btn" style="margin-top: 4px" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Please wait...' : isAdmin ? 'Sign in to dashboard' : reg ? 'Create account' : 'Sign in'}</button>
      </form>

      ${isStudent ? `<p style="margin-top: 20px; text-align: center; color: #55655C">${reg ? 'Already registered?' : 'New to the canteen?'} <button type="button" class="linkbtn" data-act="switch">${reg ? 'Sign in' : 'Create an account'}</button></p>` : ''}
      ${isAdmin ? '<p style="margin-top: 20px; text-align: center; color: #55655C; font-size: 14px">Staff accounts are created by the college office.</p>' : ''}
    `;

    if (active) {
      const el = document.getElementById(active);
      if (el) el.focus();
    }
  }

  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'student') reset({ role: 'student', mode: 'login' });
    else if (a === 'admin') reset({ role: 'admin', mode: 'login' });
    else if (a === 'switch') reset({ mode: state.mode === 'register' ? 'login' : 'register' });
    else if (a === 'pw') { state.showPw = !state.showPw; render(); }
  });

  // Typing only updates state, so the input never loses focus.
  card.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (k) state.vals[k] = e.target.value;
  });

  card.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.busy) return;
    const errs = validate();
    state.serverErr = '';
    if (Object.keys(errs).length) { state.errs = errs; render(); return; }
    state.errs = {};

    const v = state.vals;
    const isAdmin = state.role === 'admin';
    const register = !isAdmin && state.mode === 'register';
    const url = register ? '/auth/register' : '/auth/login';
    const body = register
      ? { name: v.name, roll: v.roll, email: v.email, phone: v.phone, password: v.pw }
      : { role: state.role, ident: isAdmin ? v.email : v.ident, password: v.pw };

    state.busy = true;
    render();
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      .then((r) => r.json().catch(() => ({})).then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.redirect) { window.location.href = data.redirect; return; }
        state.busy = false;
        state.errs = data.errors || {};
        state.serverErr = data.error || 'Something went wrong. Please try again.';
        render();
      })
      .catch(() => {
        state.busy = false;
        state.serverErr = 'Could not reach the server. Check that it is running.';
        render();
      });
  });

  render();
})();
