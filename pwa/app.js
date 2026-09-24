const API = '/api';
const content = document.getElementById('content');
const tabButtons = document.querySelectorAll('[data-tab]');
const moreSheet = document.getElementById('more-sheet');

// ---------- Jalali (Persian) calendar conversion, self-contained (no CDN dependency) ----------
// Standard public-domain algorithm (Kazimierz Borkowski / jalaali-js).
const Jalali = (() => {
  const div = (a, b) => ~~(a / b);
  const mod = (a, b) => a - ~~(a / b) * b;
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

  function jalCal(jy) {
    const bl = breaks.length;
    let gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump, n, i;
    for (i = 1; i < bl; i += 1) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }

  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5)
      + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }

  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let jd, jm, k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) {
        jm = 1 + div(k, 31);
        jd = mod(k, 31) + 1;
        return { jy, jm, jd };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy, jm, jd };
  }

  return {
    toJalaali: (gy, gm, gd) => d2j(g2d(gy, gm, gd)),
    toGregorian: (jy, jm, jd) => d2g(j2d(jy, jm, jd)),
    monthLength: (jy, jm) => (jm <= 6 ? 31 : jm <= 11 ? 30 : (jalCal(jy).leap === 0 ? 30 : 29)),
  };
})();
const JALALI_MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

// Reliable Jalali date formatting -- Intl's 'fa-IR' locale doesn't consistently
// render the Persian calendar across browsers/webviews, so we do it ourselves.
function formatJalaliDate(dateObj) {
  const j = Jalali.toJalaali(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
  return `${j.jd} ${JALALI_MONTH_NAMES[j.jm - 1]} ${j.jy}`;
}
function formatJalaliDateTime(dateObj) {
  const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${formatJalaliDate(dateObj)} - ${time}`;
}

// Small inline Jalali calendar picker: renders a month grid into `containerId`, writes
// the selected Gregorian date (yyyy-mm-dd) into `hiddenInputId` for form submission.
function createJalaliCalendar(containerId, hiddenInputId, initialDate) {
  const container = document.getElementById(containerId);
  const hidden = document.getElementById(hiddenInputId);
  const now = initialDate || new Date();
  const state = Jalali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

  function toIso(jy, jm, jd) {
    const g = Jalali.toGregorian(jy, jm, jd);
    return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
  }

  function draw() {
    const len = Jalali.monthLength(state.jy, state.jm);
    const days = Array.from({ length: len }, (_, i) => i + 1);
    container.innerHTML = `
      <div class="row">
        <button type="button" class="secondary" data-nav="-1" style="width:auto;padding:6px 12px">‹</button>
        <strong>${JALALI_MONTH_NAMES[state.jm - 1]} ${state.jy}</strong>
        <button type="button" class="secondary" data-nav="1" style="width:auto;padding:6px 12px">›</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:8px">
        ${days.map((d) => `<button type="button" data-day="${d}" style="padding:8px 0;border-radius:8px;border:1px solid var(--border);background:${d === state.jd ? 'var(--gold)' : 'transparent'};cursor:pointer">${d}</button>`).join('')}
      </div>
    `;
    hidden.value = toIso(state.jy, state.jm, state.jd);
    container.querySelector('[data-nav="-1"]').addEventListener('click', () => nav(-1));
    container.querySelector('[data-nav="1"]').addEventListener('click', () => nav(1));
    container.querySelectorAll('[data-day]').forEach((b) => {
      b.addEventListener('click', () => { state.jd = Number(b.dataset.day); draw(); });
    });
  }

  function nav(delta) {
    state.jm += delta;
    if (state.jm < 1) { state.jm = 12; state.jy -= 1; }
    if (state.jm > 12) { state.jm = 1; state.jy += 1; }
    const len = Jalali.monthLength(state.jy, state.jm);
    if (state.jd > len) state.jd = len;
    draw();
  }

  draw();
}

function toman(rial) {
  return Math.round(rial).toLocaleString('en-US');
}

// Live-format a text input with thousand separators as the user types (numeric inputs
// don't support commas, so these must be type="text" with inputmode="numeric").
function wireThousandsInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    const digits = el.value.replace(/\D/g, '');
    el.value = digits ? Number(digits).toLocaleString('en-US') : '';
  });
}
function numFromInput(id) {
  return Number((document.getElementById(id).value || '').replace(/,/g, ''));
}

// Wraps a button's click handler so a second tap during the request is ignored,
// and the button visibly shows it's working (prevents duplicate submits like
// double-created debts/transactions from repeated taps).
function onClickLocked(button, handler) {
  button.addEventListener('click', async (e) => {
    if (button.disabled) return;
    const original = button.textContent;
    button.disabled = true;
    button.dataset.prevOpacity = button.style.opacity || '';
    button.style.opacity = '.6';
    button.textContent = '⏳ در حال پردازش...';
    try {
      await handler(e);
    } finally {
      // Skip restoring if the button (or its container) was removed by a re-render.
      if (document.body.contains(button)) {
        button.disabled = false;
        button.style.opacity = button.dataset.prevOpacity;
        button.textContent = original;
      }
    }
  });
}

async function api(path, opts) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 401) {
    showAuthScreen('login');
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

// ---------- Auth ----------
let currentUser = null;
const authScreen = document.getElementById('auth-screen');
const authForm = document.getElementById('auth-form');
const appRoot = document.getElementById('app-root');

function showApp() {
  authScreen.hidden = true;
  appRoot.hidden = false;
}

function showAuthScreen(mode) {
  currentUser = null;
  appRoot.hidden = true;
  authScreen.hidden = false;
  renderAuthForm(mode || 'login');
}

// Renders the "یا با گوگل وارد شو" divider + button into #google-btn-slot, if the
// server has a GOOGLE_CLIENT_ID configured. Google's script posts an ID token to
// our callback, which we forward to the backend for verification -- the frontend
// never checks the token itself.
function renderGoogleButton(config) {
  const slot = document.getElementById('google-btn-slot');
  if (!slot || !config.google_client_id || !window.google?.accounts?.id) return;
  slot.innerHTML = `
    <div class="row" style="margin-top:14px;gap:10px">
      <div style="flex:1;height:1px;background:var(--border-soft)"></div>
      <span class="muted" style="font-size:.7rem">یا</span>
      <div style="flex:1;height:1px;background:var(--border-soft)"></div>
    </div>
    <div id="google-btn-target" style="margin-top:10px;display:flex;justify-content:center"></div>
  `;
  window.google.accounts.id.initialize({
    client_id: config.google_client_id,
    callback: async (response) => {
      const errorEl = document.getElementById('auth-error');
      try {
        const res = await fetch(`${API}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) { if (errorEl) errorEl.textContent = data.error || 'ورود با گوگل ناموفق بود'; return; }
        await bootstrapApp();
      } catch (e) {
        if (errorEl) errorEl.textContent = 'اتصال برقرار نشد';
      }
    },
  });
  window.google.accounts.id.renderButton(document.getElementById('google-btn-target'), { theme: 'filled_black', size: 'large', width: 280 });
}

function renderAuthForm(mode) {
  const isLogin = mode === 'login';

  authForm.innerHTML = `<div class="muted" style="font-size:.8rem">در حال بارگذاری...</div>`;
  fetch(`${API}/auth/config`).then((r) => r.json()).catch(() => ({ otp_enabled: false, google_client_id: null })).then((config) => {
    if (isLogin) {
      authForm.innerHTML = `
        <input id="auth-phone" placeholder="شماره موبایل (09xxxxxxxxx)" inputmode="tel" autocomplete="tel" />
        <input id="auth-password" type="password" placeholder="رمز عبور" autocomplete="current-password" />
        <div id="auth-error" style="color:var(--red);font-size:.8rem;margin-top:6px"></div>
        <button class="action" id="auth-submit">ورود</button>
        <button class="action secondary" id="auth-toggle">حساب نداری؟ ثبت‌نام کن</button>
        <div id="google-btn-slot"></div>
      `;
      document.getElementById('auth-toggle').addEventListener('click', () => renderAuthForm('register'));
      onClickLocked(document.getElementById('auth-submit'), async () => {
        const phone = document.getElementById('auth-phone').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorEl = document.getElementById('auth-error');
        errorEl.textContent = '';
        if (!phone || !password) { errorEl.textContent = 'شماره موبایل و رمز عبور رو وارد کن'; return; }
        try {
          const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password }),
          });
          const data = await res.json();
          if (!res.ok) { errorEl.textContent = data.error || 'خطایی پیش اومد'; return; }
          await bootstrapApp();
        } catch (e) {
          errorEl.textContent = 'اتصال برقرار نشد';
        }
      });
      renderGoogleButton(config);
      return;
    }

    // Registration step 1: phone + password. Whether this leads to an OTP step (step 2)
    // or registers right away depends on the server's /auth/config (OTP_ENABLED) --
    // OTP is off until ASA SMS is fully wired up, without deleting any of that code.
    const otpEnabled = !!config.otp_enabled;
    authForm.innerHTML = `
      <input id="auth-phone" placeholder="شماره موبایل (09xxxxxxxxx)" inputmode="tel" autocomplete="tel" />
      <input id="auth-password" type="password" placeholder="رمز عبور (حداقل ۶ کاراکتر)" autocomplete="new-password" />
      <div id="auth-error" style="color:var(--red);font-size:.8rem;margin-top:6px"></div>
      <button class="action" id="auth-submit">${otpEnabled ? 'دریافت کد تأیید' : 'ثبت‌نام'}</button>
      <button class="action secondary" id="auth-toggle">قبلاً ثبت‌نام کردی؟ وارد شو</button>
      <div id="google-btn-slot"></div>
    `;
    document.getElementById('auth-toggle').addEventListener('click', () => renderAuthForm('login'));
    onClickLocked(document.getElementById('auth-submit'), async () => {
      const phone = document.getElementById('auth-phone').value.trim();
      const password = document.getElementById('auth-password').value;
      const errorEl = document.getElementById('auth-error');
      errorEl.textContent = '';
      if (!phone || !password || password.length < 6) { errorEl.textContent = 'شماره موبایل و رمز عبور (حداقل ۶ کاراکتر) رو وارد کن'; return; }
      try {
        if (otpEnabled) {
          const res = await fetch(`${API}/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
          });
          const data = await res.json();
          if (!res.ok) { errorEl.textContent = data.error || 'ارسال کد ناموفق بود'; return; }
          renderOtpStep(phone, password);
        } else {
          const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password }),
          });
          const data = await res.json();
          if (!res.ok) { errorEl.textContent = data.error || 'خطایی پیش اومد'; return; }
          await bootstrapApp();
        }
      } catch (e) {
        errorEl.textContent = 'اتصال برقرار نشد';
      }
    });
    renderGoogleButton(config);
  });
}

// Registration step 2: enter the code that was texted to the phone from step 1.
// Registration step 2: an animated 5-box OTP entry. Digits orbit around the
// center and collapse into a checkmark ring on success, mirroring the reference
// design the user provided -- adapted from 4 to 5 digits and wired to the real
// /auth/register + /auth/request-otp endpoints instead of a stub.
function renderOtpStep(phone, password) {
  const LENGTH = 5;
  authForm.innerHTML = `
    <div class="otp-card" id="otp-card">
      <div class="otp-title" id="otp-title">بیا شماره‌ات رو تأیید کنیم</div>
      <div class="otp-sub" id="otp-sub">یه کد ۵ رقمی به ${phone} فرستادیم.<br>به‌محض کامل شدن، خودکار تأیید می‌شه.</div>
      <div class="otp-error" id="otp-error"></div>
      <div class="otp-stage" id="otp-stage">
        <div class="otp-ring" id="otp-ring">
          <div class="otp-halo"></div>
          <div class="otp-core">
            <svg class="otp-check" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
      <div class="otp-foot">
        <div class="otp-resend-line">کد نیومد؟<button class="otp-resend" id="otp-resend" type="button">ارسال دوباره</button></div>
        <div class="otp-secured">تأیید شد ✓</div>
      </div>
    </div>
    <button class="action secondary otp-back" id="otp-back-btn">بازگشت</button>
  `;

  const card = document.getElementById('otp-card');
  const stage = document.getElementById('otp-stage');
  const ring = document.getElementById('otp-ring');
  const title = document.getElementById('otp-title');
  const sub = document.getElementById('otp-sub');
  const errorEl = document.getElementById('otp-error');
  const resendBtn = document.getElementById('otp-resend');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('otp-back-btn').addEventListener('click', () => renderAuthForm('register'));

  const SPACING = 54;
  const rowPos = (i) => ({ x: (i - (LENGTH - 1) / 2) * SPACING, y: 0 });
  // Final rest positions: 5 points evenly spaced around a circle, starting at the top.
  const FINAL_ANGLES = [-90, -18, 54, 126, 198].map((a) => a * Math.PI / 180);

  const inputs = [];
  let busy = false;

  for (let i = 0; i < LENGTH; i++) {
    const inp = document.createElement('input');
    inp.className = 'otp-digit font-num';
    inp.type = 'text';
    inp.inputMode = 'numeric';
    inp.maxLength = 1;
    inp.autocomplete = i === 0 ? 'one-time-code' : 'off';
    inp.setAttribute('aria-label', `رقم ${i + 1}`);
    stage.appendChild(inp);
    inputs.push(inp);
  }

  function place(el, x, y, r = 0, s = 1, o = 1) {
    el.style.transform = `translate(${x}px, ${y}px) rotate(${r}rad) scale(${s})`;
    el.style.opacity = o;
  }
  const layoutRow = () => inputs.forEach((el, i) => { const p = rowPos(i); place(el, p.x, p.y); });

  const codeValue = () => inputs.map((i) => i.value).join('');
  const firstEmpty = () => inputs.findIndex((i) => !i.value);

  function fill(start, digits) {
    let idx = start;
    for (const d of digits) {
      if (idx >= LENGTH) break;
      inputs[idx++].value = d;
    }
    const next = firstEmpty();
    if (next === -1) submit();
    else inputs[next].focus();
  }

  inputs.forEach((inp, i) => {
    inp.addEventListener('focus', () => {
      const fe = firstEmpty();
      if (fe !== -1 && fe < i) inputs[fe].focus();
      else requestAnimationFrame(() => inp.select());
    });
    inp.addEventListener('input', () => {
      const digits = inp.value.replace(/\D/g, '');
      inp.value = '';
      if (digits) fill(i, digits);
    });
    inp.addEventListener('keydown', (e) => {
      if (busy) { e.preventDefault(); return; }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (inp.value) inp.value = '';
        else if (i > 0) { inputs[i - 1].value = ''; inputs[i - 1].focus(); }
      } else if (e.key === 'ArrowLeft' && i > 0) {
        e.preventDefault(); inputs[i - 1].focus();
      } else if (e.key === 'ArrowRight' && i < LENGTH - 1 && inp.value) {
        e.preventDefault(); inputs[i + 1].focus();
      }
    });
    inp.addEventListener('paste', (e) => {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
      if (digits) fill(0, digits);
    });
  });

  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const clamp = (t) => Math.min(1, Math.max(0, t));
  const lerp = (a, b, t) => a + (b - a) * t;

  function animate(duration, frame) {
    return new Promise((res) => {
      const t0 = performance.now();
      const tick = (now) => {
        const t = clamp((now - t0) / duration);
        frame(t);
        if (t < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function orbit() {
    const TOTAL = 2300, GATHER = 450;
    const SPIN = Math.PI * 2 * 1.25;
    return animate(TOTAL, (t) => {
      const ms = t * TOTAL;
      const g = easeOut(clamp(ms / GATHER));
      const p = ease(t);
      const radius = lerp(18, 58, easeOut(clamp(ms / 900))) - 18 * ease(clamp((ms - 1500) / 800));
      inputs.forEach((el, i) => {
        const theta = FINAL_ANGLES[i] + SPIN * (1 - p);
        const c = { x: Math.cos(theta) * radius, y: Math.sin(theta) * radius };
        const r0 = rowPos(i);
        const x = lerp(r0.x, c.x, g);
        const y = lerp(r0.y, c.y, g);
        const rot = g * (theta - FINAL_ANGLES[i]) * 0.55;
        place(el, x, y, rot);
      });
    });
  }

  function collapse() {
    const from = inputs.map((el, i) => ({
      x: Math.cos(FINAL_ANGLES[i]) * 40, y: Math.sin(FINAL_ANGLES[i]) * 40,
    }));
    return animate(420, (t) => {
      const e = ease(t);
      inputs.forEach((el, i) => place(el, lerp(from[i].x, 0, e), lerp(from[i].y, 0, e), 0, lerp(1, .3, e), 1 - e));
    });
  }

  function swapText(t, s) {
    title.style.opacity = sub.style.opacity = 0;
    setTimeout(() => {
      title.textContent = t;
      sub.innerHTML = s;
      title.style.opacity = sub.style.opacity = '';
    }, 250);
  }

  async function submit() {
    if (busy) return;
    busy = true;
    errorEl.textContent = '';
    inputs.forEach((i) => { i.readOnly = true; i.blur(); });

    let ok = false, errMsg = '';
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, otp: codeValue() }),
      });
      const data = await res.json();
      ok = res.ok;
      errMsg = data.error || 'کد اشتباهه یا منقضی شده';
    } catch (e) {
      errMsg = 'اتصال برقرار نشد';
    }

    if (!ok) {
      errorEl.textContent = errMsg;
      inputs.forEach((i) => i.classList.add('error'));
      await wait(450);
      inputs.forEach((i) => { i.classList.remove('error'); i.value = ''; i.readOnly = false; });
      busy = false;
      inputs[0].focus();
      return;
    }

    card.classList.add('done');
    if (!reduced) {
      inputs.forEach((i) => i.classList.add('fly'));
      await orbit();
      await wait(250);
      card.classList.add('verifying');
      await collapse();
    } else {
      inputs.forEach((i) => { i.style.opacity = 0; });
    }

    ring.classList.add('show');
    card.classList.add('show-secured');
    await wait(reduced ? 0 : 650);
    card.classList.remove('verifying');
    card.classList.add('success');
    swapText('با موفقیت تأیید شد', 'حسابت ساخته شد، داریم واردت می‌کنیم…');
    await wait(700);
    await bootstrapApp();
  }

  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    try {
      const res = await fetch(`${API}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) errorEl.textContent = data.error || 'ارسال کد ناموفق بود';
    } catch (e) {
      errorEl.textContent = 'اتصال برقرار نشد';
    }
    let s = 60;
    resendBtn.textContent = `ارسال دوباره (${s})`;
    const id = setInterval(() => {
      s--;
      if (s <= 0) { clearInterval(id); resendBtn.disabled = false; resendBtn.textContent = 'ارسال دوباره'; }
      else resendBtn.textContent = `ارسال دوباره (${s})`;
    }, 1000);
  });

  layoutRow();
  inputs[0].focus();
}

async function checkAuth() {
  try {
    const res = await fetch(`${API}/auth/me`);
    if (!res.ok) return false;
    currentUser = await res.json();
    return true;
  } catch (e) {
    return false;
  }
}

function openAccountSettingsModal() {
  const webhookUrl = `${location.origin}/api/webhook/sms/${currentUser.api_key}`;
  manualModal.innerHTML = `
    <div class="card">
      <strong>حساب کاربری</strong>
      <div class="muted" style="margin-top:8px;font-size:.8rem">شماره موبایل</div>
      <div class="font-num">${currentUser.phone}</div>

      <div class="muted" style="margin-top:12px;font-size:.8rem">آدرس وب‌هوک پیامک بانکی (برای iOS Shortcuts)</div>
      <textarea readonly class="sms-text" style="min-height:50px;font-size:.7rem" id="acc-webhook-url">${webhookUrl}</textarea>
      <button class="action secondary" id="acc-copy-webhook">کپی آدرس</button>

      <div class="muted" style="margin-top:12px;font-size:.8rem">تاپیک ntfy برای نوتیفیکیشن‌های خودت (اختیاری — خالی بذار یعنی همون پیش‌فرض سرور)</div>
      <input id="acc-ntfy-topic" placeholder="مثلاً pw-username-123" value="${currentUser.ntfy_topic || ''}" />
      <button class="action secondary" id="acc-save-ntfy">ذخیره</button>

      <button class="action danger" id="acc-logout" style="margin-top:16px">خروج از حساب</button>
      <button class="action secondary" id="acc-cancel">بستن</button>
    </div>
  `;
  manualModal.hidden = false;
  document.getElementById('acc-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  document.getElementById('acc-copy-webhook').addEventListener('click', () => {
    navigator.clipboard?.writeText(webhookUrl);
  });
  onClickLocked(document.getElementById('acc-save-ntfy'), async () => {
    const ntfy_topic = document.getElementById('acc-ntfy-topic').value.trim();
    await api('/auth/me/ntfy-topic', { method: 'PUT', body: JSON.stringify({ ntfy_topic }) });
    currentUser.ntfy_topic = ntfy_topic;
    manualModal.hidden = true;
  });
  onClickLocked(document.getElementById('acc-logout'), async () => {
    await fetch(`${API}/auth/logout`, { method: 'POST' });
    manualModal.hidden = true;
    showAuthScreen('login');
  });
}

function setActiveTab(tab) {
  tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  moreSheet.hidden = true;
  render(tab);
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});

document.getElementById('btn-more').addEventListener('click', () => { moreSheet.hidden = false; });
document.getElementById('btn-more-close').addEventListener('click', () => { moreSheet.hidden = true; });
moreSheet.addEventListener('click', (e) => { if (e.target === moreSheet) moreSheet.hidden = true; });
document.getElementById('btn-account-settings').addEventListener('click', () => {
  moreSheet.hidden = true;
  openAccountSettingsModal();
});

const PRIVACY_KEY = 'pw-privacy-mode';
const btnPrivacy = document.getElementById('btn-privacy');
let privacyOn = false;

// Masks only the digit groups inside an element (walking all descendant text
// nodes), so surrounding labels like "ریال" and the element's own color stay
// visible — only the actual numbers turn into dots.
function walkTextNodes(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}
function maskEl(el) {
  if (el.dataset.masked === '1') return;
  el.dataset.masked = '1';
  const nodes = walkTextNodes(el);
  el.__origTexts = nodes.map((n) => n.textContent);
  nodes.forEach((n) => { n.textContent = n.textContent.replace(/[\d,]+/g, '••••'); });
}
function unmaskEl(el) {
  if (el.dataset.masked !== '1') return;
  delete el.dataset.masked;
  const nodes = walkTextNodes(el);
  nodes.forEach((n, i) => { if (el.__origTexts && el.__origTexts[i] !== undefined) n.textContent = el.__origTexts[i]; });
  delete el.__origTexts;
}
function applyPrivacyMode(on) {
  privacyOn = on;
  document.querySelectorAll('.privacy-target').forEach(on ? maskEl : unmaskEl);
  btnPrivacy.classList.toggle('active', on);
  btnPrivacy.textContent = on ? '🙈' : '🐵';
  btnPrivacy.title = on ? 'نمایش ارقام' : 'محو کردن ارقام';
}
btnPrivacy.addEventListener('click', () => {
  const on = !privacyOn;
  localStorage.setItem(PRIVACY_KEY, on ? '1' : '0');
  applyPrivacyMode(on);
});

const THEME_KEY = 'pw-theme';
const btnTheme = document.getElementById('btn-theme');
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  btnTheme.textContent = theme === 'light' ? '☀️' : '🌙';
  btnTheme.title = theme === 'light' ? 'حالت تاریک' : 'حالت روشن';
}
btnTheme.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});
// Mask any newly-rendered .privacy-target elements immediately, before paint,
// so switching tabs never flashes real numbers even for a frame.
new MutationObserver(() => {
  if (privacyOn) document.querySelectorAll('.privacy-target:not([data-masked="1"])').forEach(maskEl);
}).observe(content, { childList: true, subtree: true });

async function updatePendingBadge() {
  try {
    const pending = await api('/transactions?status=pending');
    [document.getElementById('pending-badge'), document.getElementById('pending-badge-top')].forEach((badge) => {
      badge.hidden = pending.length === 0;
      badge.textContent = pending.length;
    });
  } catch (e) { /* ignore */ }
}

async function render(tab) {
  content.innerHTML = '<p class="muted">در حال بارگذاری...</p>';
  updatePendingBadge();
  try {
    if (tab === 'overview') return renderOverview();
    if (tab === 'pending') return renderPending();
    if (tab === 'transactions') return renderTransactions();
    if (tab === 'accounts') return renderAccounts();
    if (tab === 'installments') return renderInstallments();
    if (tab === 'investments') return renderInvestments();
    if (tab === 'categories') return renderCategories();
    if (tab === 'analytics') return renderAnalytics();
    if (tab === 'debts') return renderDebts();
    if (tab === 'reminders') return renderReminders();
    if (tab === 'trash') return renderTrash();
  } catch (e) {
    content.innerHTML = '<p class="muted">خطا در بارگذاری اطلاعات</p>';
  }
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

function donutChartHtml(chartData) {
  const total = chartData.reduce((s, d) => s + d.value, 0);
  if (total === 0) return '<p class="muted">هزینه‌ای این ماه ثبت نشده.</p>';
  let acc = 0;
  const stops = chartData.map((d, i) => {
    const from = (acc / total) * 360;
    acc += d.value;
    const to = (acc / total) * 360;
    return `${CHART_COLORS[i % CHART_COLORS.length]} ${from}deg ${to}deg`;
  }).join(', ');
  const legend = chartData.map((d, i) => `
    <div class="row" style="font-size:.75rem;margin-top:4px">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${CHART_COLORS[i % CHART_COLORS.length]};margin-left:6px"></span>${d.name}</span>
      <span class="muted font-num">${d.value.toLocaleString('en-US')} ریال</span>
    </div>
  `).join('');
  return `
    <div class="row" style="align-items:center;gap:16px">
      <div style="width:110px;height:110px;border-radius:50%;background:conic-gradient(${stops});flex:0 0 auto"></div>
      <div style="flex:1">${legend}</div>
    </div>
  `;
}

async function renderOverview() {
  const [accounts, pending, installments, transactions, investments, categories, debts] = await Promise.all([
    api('/accounts'), api('/transactions?status=pending'), api('/installments'), api('/transactions'),
    api('/investments'), api('/categories'), api('/debts'),
  ]);

  const totalCash = accounts.reduce((sum, a) => sum + Number(a.balance_rial), 0);
  const totalInvestments = investments.reduce((sum, v) => sum + Number(v.current_value_rial), 0);
  const activeInstallments = installments.filter((i) => i.status === 'active');
  const remainingDebt = activeInstallments.reduce(
    (sum, i) => sum + i.installment_amount_rial * (i.total_count - i.paid_count), 0
  );
  const openDebts = debts.filter((d) => d.status === 'open');
  const totalIOwe = openDebts.filter((d) => d.type === 'i_owe').reduce((s, d) => s + Number(d.amount_rial), 0);
  const totalOwedToMe = openDebts.filter((d) => d.type === 'owed_to_me').reduce((s, d) => s + Number(d.amount_rial), 0);
  const now = new Date();
  const thisMonthTx = transactions.filter((t) => {
    const d = new Date(t.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && t.status === 'confirmed';
  });
  // Transfers between own accounts are neither real income nor real expense.
  const realFlowTx = thisMonthTx.filter((t) => !isNonFlowCategory(t.category_name));
  const monthExpense = realFlowTx.filter((t) => t.direction === 'expense').reduce((s, t) => s + Number(t.amount_rial), 0);
  const monthIncome = realFlowTx.filter((t) => t.direction === 'income').reduce((s, t) => s + Number(t.amount_rial), 0);

  const expenseByCategory = {};
  realFlowTx.filter((t) => t.direction === 'expense' && t.category_id).forEach((t) => {
    const cat = categories.find((c) => c.id === t.category_id);
    const name = cat ? cat.name : 'سایر';
    expenseByCategory[name] = (expenseByCategory[name] || 0) + Number(t.amount_rial);
  });
  const chartData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value: Number(value) }));

  let html = `
    <div class="metric-grid" style="grid-template-columns:1fr 1fr 1fr">
      <div class="metric-card" style="background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.25)">
        <div class="metric-label" style="font-size:.7rem">بدهی (قسط + بدهی شخصی)</div>
        <div class="privacy-target font-num" style="color:var(--red);font-weight:700;margin-top:4px">${toman(remainingDebt + totalIOwe)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label" style="font-size:.7rem">سرمایه</div>
        <div class="privacy-target font-num" style="font-weight:700;margin-top:4px">${toman(totalInvestments)}</div>
      </div>
      <div class="metric-card" style="background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.25)">
        <div class="metric-label" style="font-size:.7rem">نقدینگی</div>
        <div class="privacy-target font-num" style="color:var(--green);font-weight:700;margin-top:4px">${toman(totalCash)}</div>
      </div>
    </div>
    ${totalOwedToMe > 0 ? `
      <div class="card row">
        <span class="muted">طلب از دیگران</span>
        <strong class="privacy-target font-num" style="color:var(--green)">${toman(totalOwedToMe)} ریال</strong>
      </div>
    ` : ''}
  `;
  if (pending.length > 0) {
    html += `
      <div class="card" style="border-color:rgba(245,158,11,.4);background:rgba(120,53,15,.25)">
        <div class="row">
          <div>
            <strong style="color:#fbbf24">⏰ ${pending.length} تراکنش در انتظار تایید</strong>
            <div class="muted">پیامک‌های بانکی جدید نیاز به دسته‌بندی دارند.</div>
          </div>
          <button class="action" id="goto-pending" style="width:auto;margin:0">مشاهده</button>
        </div>
      </div>`;
  }

  const maxFlow = Math.max(monthExpense, monthIncome, 1);
  html += `
    <div class="metric-grid">
      <div class="metric-card">
        <div class="row"><span class="muted" style="font-size:.75rem">هزینه ماه</span> <span style="color:var(--red)">↗</span></div>
        <div class="privacy-target font-num" style="color:var(--red);font-weight:800;font-size:1.1rem;margin-top:4px">-${toman(monthExpense)} <span class="muted" style="font-size:.65rem">ریال</span></div>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.round(monthExpense / maxFlow * 100)}%;background:var(--red)"></div></div>
      </div>
      <div class="metric-card">
        <div class="row"><span class="muted" style="font-size:.75rem">درآمد ماه</span> <span style="color:var(--green)">↙</span></div>
        <div class="privacy-target font-num" style="color:var(--green);font-weight:800;font-size:1.1rem;margin-top:4px">+${toman(monthIncome)} <span class="muted" style="font-size:.65rem">ریال</span></div>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.round(monthIncome / maxFlow * 100)}%;background:var(--green)"></div></div>
      </div>
    </div>
  `;

  const monthSavings = monthIncome - monthExpense;
  const savingsRate = monthIncome > 0 ? Math.round((monthSavings / monthIncome) * 100) : null;
  html += `
    <div class="card row">
      <span class="muted">پس‌انداز این ماه</span>
      <strong class="privacy-target font-num" style="color:${monthSavings >= 0 ? 'var(--green)' : 'var(--red)'}">${monthSavings >= 0 ? '+' : ''}${toman(monthSavings)} ریال${savingsRate != null ? ` (${savingsRate}٪ درآمد)` : ''}</strong>
    </div>
  `;

  html += `
    <div class="card">
      <div class="row">
        <strong>حساب‌های بانکی</strong>
        <button class="secondary" id="goto-accounts" style="width:auto;background:none;border:none;color:var(--gold);font-family:inherit;font-size:.75rem;cursor:pointer">مدیریت ‹</button>
      </div>
      <div class="accounts-grid" style="margin-top:10px">
        ${accounts.map((a) => `
          <div class="mini-bank-card" style="background:${bankTheme(a.bank_code)}">
            ${bankLogoHtml(a.bank_code, 32) || '<div class="mini-bank-icon"></div>'}
            <div style="font-size:.85rem;font-weight:600">${a.display_name}</div>
            ${cardInfoHtml(a)}
            <div class="privacy-target font-num" style="margin-top:8px;font-weight:700">${toman(a.balance_rial)} ریال</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const activeInstallmentsList = installments.filter((i) => i.status === 'active');
  if (activeInstallmentsList.length > 0) {
    html += `
      <div class="card">
        <div class="row">
          <strong>اقساط فعال</strong>
          <button class="secondary" id="goto-installments" style="width:auto;background:none;border:none;color:var(--gold);font-family:inherit;font-size:.75rem;cursor:pointer">همه ‹</button>
        </div>
        ${activeInstallmentsList.map((i) => {
          const percent = Math.round((i.paid_count / i.total_count) * 100);
          return `
          <div style="margin-top:12px">
            <div class="row">
              <span style="font-size:.85rem;font-weight:600">${i.title}</span>
              <span class="muted font-num" style="font-size:.7rem">قسط ${i.paid_count + 1}/${i.total_count}</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
            <div class="row muted" style="font-size:.7rem;margin-top:2px">
              <span>موعد: روز ${i.due_day_of_month} ماه</span>
              <span class="font-num privacy-target">${toman(i.installment_amount_rial)} ریال</span>
            </div>
          </div>
        `;
        }).join('')}
      </div>
    `;
  }

  html += `
    <div class="card">
      <strong>هزینه‌ها به تفکیک دسته (این ماه)</strong>
      <div class="privacy-target" style="margin-top:10px">${donutChartHtml(chartData)}</div>
    </div>
  `;

  content.innerHTML = html;
  wireCopyFields();
  const gotoBtn = document.getElementById('goto-pending');
  if (gotoBtn) gotoBtn.addEventListener('click', () => setActiveTab('pending'));
  document.getElementById('goto-accounts')?.addEventListener('click', () => setActiveTab('accounts'));
  document.getElementById('goto-installments')?.addEventListener('click', () => setActiveTab('installments'));
}

// Suggest a category from transaction history: for a given direction+amount, pick
// whichever category was used most often before (e.g. a recurring 20,000 toman
// expense almost always gets the same category).
function buildAmountCategoryHistogram(transactions) {
  const histogram = {};
  for (const t of transactions) {
    if (!t.category_id) continue;
    const key = `${t.direction}:${t.amount_rial}`;
    histogram[key] = histogram[key] || {};
    histogram[key][t.category_id] = (histogram[key][t.category_id] || 0) + 1;
  }
  return histogram;
}

function suggestCategoryId(histogram, direction, amount_rial) {
  const counts = histogram[`${direction}:${amount_rial}`];
  if (!counts) return null;
  let bestId = null, bestCount = 0;
  for (const [catId, count] of Object.entries(counts)) {
    if (count > bestCount) { bestCount = count; bestId = catId; }
  }
  return bestId;
}

// Wires an amount input so that, as soon as it matches a previously-used amount,
// the linked category <select> is preset to whatever category was picked before
// (and a 'change' event is fired so any conditional fields tied to it react too).
function wireCategorySuggestion(amountInputId, catSelectId, getDirection, histogram) {
  const amountInput = document.getElementById(amountInputId);
  const catSelect = document.getElementById(catSelectId);
  const apply = () => {
    const amount_rial = numFromInput(amountInputId);
    if (!amount_rial) return;
    const suggested = suggestCategoryId(histogram, getDirection(), amount_rial);
    if (suggested && [...catSelect.options].some((o) => o.value === String(suggested))) {
      catSelect.value = String(suggested);
      catSelect.dispatchEvent(new Event('change'));
    }
  };
  amountInput.addEventListener('input', apply);
  return apply;
}

async function renderPending() {
  const [txs, cats, accounts, debts, allTxs] = await Promise.all([
    api('/transactions?status=pending'), api('/categories'), api('/accounts'), api('/debts'), api('/transactions'),
  ]);
  if (txs.length === 0) {
    content.innerHTML = '<p class="muted">تراکنش در انتظاری وجود ندارد.</p>';
    return;
  }
  const histogram = buildAmountCategoryHistogram(allTxs);
  content.innerHTML = txs.map((t) => txCard(t, cats, true, accounts)).join('');
  txs.forEach((t) => wireTxCard(t, cats, accounts, debts, histogram));
}

const TRANSFER_CATEGORY_NAME = 'انتقال وجه بین حساب';
function isNonFlowCategory(name) {
  return name === TRANSFER_CATEGORY_NAME || name === 'قرض' || name === 'تسویه طلب' || name === 'تسویه بدهی' || name === LOAN_RECEIVED_CATEGORY_NAME;
}

function otherAccountFieldHtml(idSuffix, accounts, currentAccountId) {
  const options = accounts
    .filter((a) => a.id !== currentAccountId)
    .map((a) => `<option value="${a.id}">${a.display_name}</option>`)
    .join('');
  return `<select id="other-account-${idSuffix}" hidden><option value="">حساب مقابل را انتخاب کنید...</option>${options}</select>`;
}

function wireTransferField(catSelectId, otherAccountSelectId, cats) {
  const catSelect = document.getElementById(catSelectId);
  const otherAccountSelect = document.getElementById(otherAccountSelectId);
  catSelect.addEventListener('change', () => {
    const selected = cats.find((c) => String(c.id) === catSelect.value);
    otherAccountSelect.hidden = !(selected && selected.name === TRANSFER_CATEGORY_NAME);
  });
}

const LOAN_CATEGORY_NAME = 'قرض';

function loanPersonFieldHtml(idSuffix) {
  return `<div id="loan-wrap-${idSuffix}" hidden>
    <select id="loan-existing-${idSuffix}"></select>
    <input id="loan-person-${idSuffix}" placeholder="اسم شخص (برای قرض به یه نفر جدید)" />
  </div>`;
}

function loanExistingOptionsHtml(debts, direction) {
  const type = direction === 'expense' ? 'owed_to_me' : 'i_owe';
  const matching = debts.filter((d) => d.status === 'open' && d.type === type);
  return '<option value="">+ شخص جدید (اسمش رو زیر بنویس)</option>' + matching
    .map((d) => `<option value="${d.id}">افزودن به ${d.person_name} (الان ${toman(d.amount_rial)} ریال)</option>`)
    .join('');
}

// direction is a function so it can re-read a changeable direction <select> (edit/manual
// forms) or just return a fixed value (pending confirm form, where direction can't change).
function wireLoanField(catSelectId, idSuffix, cats, debts, direction) {
  const catSelect = document.getElementById(catSelectId);
  const wrap = document.getElementById(`loan-wrap-${idSuffix}`);
  const existingSelect = document.getElementById(`loan-existing-${idSuffix}`);
  const personInput = document.getElementById(`loan-person-${idSuffix}`);
  const update = () => {
    const selected = cats.find((c) => String(c.id) === catSelect.value);
    const show = !!(selected && selected.name === LOAN_CATEGORY_NAME);
    wrap.hidden = !show;
    if (show) existingSelect.innerHTML = loanExistingOptionsHtml(debts || [], direction());
  };
  catSelect.addEventListener('change', update);
  existingSelect.addEventListener('change', () => { personInput.hidden = !!existingSelect.value; });
  update();
  return update;
}

// After confirming a transaction tagged as a loan, either add the amount onto an
// existing open debt for that person (picked from loan-existing) or create a new one.
async function maybeCreateLoanDebt(idSuffix, direction, amount_rial) {
  const wrap = document.getElementById(`loan-wrap-${idSuffix}`);
  if (wrap.hidden) return;
  const existingId = document.getElementById(`loan-existing-${idSuffix}`).value;
  const personName = document.getElementById(`loan-person-${idSuffix}`).value;
  if (existingId) {
    await api(`/debts/${existingId}/add`, { method: 'POST', body: JSON.stringify({ amount_rial }) });
  } else if (personName) {
    await api('/debts', {
      method: 'POST',
      body: JSON.stringify({
        type: direction === 'expense' ? 'owed_to_me' : 'i_owe',
        person_name: personName,
        amount_rial,
      }),
    });
  }
}

// A formal bank loan deposit: non-flow (not counted as income) and tracked as a
// repayable installment, separate from "قرض" (an informal person-to-person loan).
const LOAN_RECEIVED_CATEGORY_NAME = 'وام دریافتی';

function bankLoanFieldHtml(idSuffix) {
  return `<div id="bank-loan-${idSuffix}" hidden>
    <input id="bank-loan-amount-${idSuffix}" type="text" inputmode="numeric" placeholder="مبلغ هر قسط (ریال)" />
    <div class="grid2">
      <input id="bank-loan-count-${idSuffix}" type="text" inputmode="numeric" placeholder="تعداد کل اقساط" />
      <input id="bank-loan-day-${idSuffix}" type="text" inputmode="numeric" placeholder="روز موعد در ماه (شمسی)" />
    </div>
  </div>`;
}

function wireBankLoanField(catSelectId, wrapId, cats) {
  const idSuffix = wrapId.replace('bank-loan-', '');
  wireThousandsInput(`bank-loan-amount-${idSuffix}`);
  wireThousandsInput(`bank-loan-count-${idSuffix}`);
  wireThousandsInput(`bank-loan-day-${idSuffix}`);
  const catSelect = document.getElementById(catSelectId);
  const wrap = document.getElementById(wrapId);
  const update = () => {
    const selected = cats.find((c) => String(c.id) === catSelect.value);
    wrap.hidden = !(selected && selected.name === LOAN_RECEIVED_CATEGORY_NAME);
  };
  catSelect.addEventListener('change', update);
  update();
}

// After confirming a transaction tagged as a received bank loan, also record it
// in the installments module so its monthly repayment gets tracked.
async function maybeCreateLoanInstallment(idSuffix, accountName, total_amount_rial) {
  const wrap = document.getElementById(`bank-loan-${idSuffix}`);
  if (wrap.hidden) return;
  const installment_amount_rial = numFromInput(`bank-loan-amount-${idSuffix}`);
  const total_count = numFromInput(`bank-loan-count-${idSuffix}`);
  const due_day_of_month = numFromInput(`bank-loan-day-${idSuffix}`);
  if (!installment_amount_rial || !total_count || !due_day_of_month) return;
  await api('/installments', {
    method: 'POST',
    body: JSON.stringify({
      title: `وام ${accountName}`,
      type: 'loan',
      total_amount_rial,
      installment_amount_rial,
      total_count,
      due_day_of_month,
    }),
  });
}

// Two separate category names: one shown for income (settling a receivable someone
// owes me), one for expense (settling a debt I owe someone).
const REPAY_CATEGORY_NAME_INCOME = 'تسویه طلب';
const REPAY_CATEGORY_NAME_EXPENSE = 'تسویه بدهی';

function repayFieldHtml(idSuffix) {
  return `<select id="repay-debt-${idSuffix}" hidden></select>`;
}

function repayOptionsHtml(debts, direction) {
  const type = direction === 'income' ? 'owed_to_me' : 'i_owe';
  const matching = debts.filter((d) => d.status === 'open' && d.type === type);
  if (matching.length === 0) {
    return direction === 'income'
      ? '<option value="">طلب بازی ثبت نشده</option>'
      : '<option value="">بدهی بازی ثبت نشده</option>';
  }
  return '<option value="">کدوم شخص؟</option>' + matching
    .map((d) => `<option value="${d.id}">${d.person_name} (${toman(d.amount_rial)} ریال)</option>`)
    .join('');
}

// direction is a function so it can re-read a changeable direction <select> (edit/manual forms)
// or just return a fixed value (pending confirm form, where direction can't change).
function wireRepayField(catSelectId, direction, repaySelectId, cats, debts) {
  const catSelect = document.getElementById(catSelectId);
  const repaySelect = document.getElementById(repaySelectId);
  const update = () => {
    const selected = cats.find((c) => String(c.id) === catSelect.value);
    const expectedName = direction() === 'income' ? REPAY_CATEGORY_NAME_INCOME : REPAY_CATEGORY_NAME_EXPENSE;
    const isRepay = selected && selected.name === expectedName;
    repaySelect.hidden = !isRepay;
    if (isRepay) repaySelect.innerHTML = repayOptionsHtml(debts, direction());
  };
  catSelect.addEventListener('change', update);
  update();
  return update;
}

async function maybeRepayDebt(repaySelectId, amount_rial) {
  const repaySelect = document.getElementById(repaySelectId);
  if (repaySelect.hidden || !repaySelect.value) return;
  await api(`/debts/${repaySelect.value}/repay`, { method: 'POST', body: JSON.stringify({ amount_rial }) });
}

const TX_PAGE_SIZE = 10;
let txPage = 1;

let txFilters = { account_id: '', category_id: '', direction: '', from: '', to: '' };

async function renderTransactions() {
  const [allTxs, accounts, cats] = await Promise.all([api('/transactions'), api('/accounts'), api('/categories')]);

  const txs = allTxs.filter((t) => {
    if (txFilters.account_id && String(t.account_id) !== txFilters.account_id) return false;
    if (txFilters.category_id && String(t.category_id) !== txFilters.category_id) return false;
    if (txFilters.direction && t.direction !== txFilters.direction) return false;
    if (txFilters.from && new Date(t.created_at) < new Date(txFilters.from)) return false;
    if (txFilters.to && new Date(t.created_at) > new Date(txFilters.to + 'T23:59:59')) return false;
    return true;
  });

  const filterBarHtml = `
    <div class="card">
      <div class="grid2">
        <select id="tf-account"><option value="">همه حساب‌ها</option>${accounts.map((a) => `<option value="${a.id}" ${txFilters.account_id === String(a.id) ? 'selected' : ''}>${a.display_name}</option>`).join('')}</select>
        <select id="tf-category"><option value="">همه دسته‌ها</option>${cats.map((c) => `<option value="${c.id}" ${txFilters.category_id === String(c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
      </div>
      <select id="tf-direction">
        <option value="" ${!txFilters.direction ? 'selected' : ''}>هزینه و درآمد</option>
        <option value="expense" ${txFilters.direction === 'expense' ? 'selected' : ''}>فقط هزینه</option>
        <option value="income" ${txFilters.direction === 'income' ? 'selected' : ''}>فقط درآمد</option>
      </select>
      <div class="grid2">
        <input id="tf-from" type="date" value="${txFilters.from}" />
        <input id="tf-to" type="date" value="${txFilters.to}" />
      </div>
      <button class="action secondary" id="tf-clear">پاک کردن فیلترها</button>
    </div>
  `;

  if (txs.length === 0) {
    content.innerHTML = filterBarHtml + '<p class="muted">تراکنشی با این فیلتر پیدا نشد.</p>';
    wireTxFilters();
    return;
  }
  const totalPages = Math.max(1, Math.ceil(txs.length / TX_PAGE_SIZE));
  txPage = Math.min(txPage, totalPages);
  const start = (txPage - 1) * TX_PAGE_SIZE;
  const pageItems = txs.slice(start, start + TX_PAGE_SIZE);

  content.innerHTML = filterBarHtml + `
    <div class="muted" style="margin-bottom:8px">${txs.length} تراکنش</div>
    ${pageItems.map((t) => `
      <div class="card">
        <div class="row">
          <span class="${t.direction === 'income' ? 'amount-income' : 'amount-expense'} font-num">
            ${t.direction === 'income' ? '+' : '-'}${toman(t.amount_rial)} ریال
          </span>
          <span class="muted font-num">${formatJalaliDateTime(new Date(t.created_at))}</span>
        </div>
        <div class="row">
          <div class="muted">${t.account_name} · ${t.category_name || 'بدون دسته'}${t.note ? ' · ' + t.note : ''}${t.tags ? ' · 🏷 ' + t.tags : ''}</div>
          <div class="row" style="width:auto;gap:6px">
            <button class="action secondary" data-edit-tx="${t.id}" style="width:auto;padding:4px 10px;margin:0">✎</button>
            <button class="action danger" data-delete-tx="${t.id}" style="width:auto;padding:4px 10px;margin:0">🗑</button>
          </div>
        </div>
      </div>
    `).join('')}
    <div class="row" style="margin-top:12px">
      <button class="action secondary" id="tx-prev" style="width:auto" ${txPage <= 1 ? 'disabled' : ''}>‹ قبلی</button>
      <span class="muted font-num">صفحه ${txPage} از ${totalPages}</span>
      <button class="action secondary" id="tx-next" style="width:auto" ${txPage >= totalPages ? 'disabled' : ''}>بعدی ›</button>
    </div>
  `;

  document.getElementById('tx-prev').addEventListener('click', () => { txPage--; renderTransactions(); });
  document.getElementById('tx-next').addEventListener('click', () => { txPage++; renderTransactions(); });
  document.querySelectorAll('[data-edit-tx]').forEach((b) => {
    b.addEventListener('click', () => openEditTxModal(txs.find((t) => t.id === Number(b.dataset.editTx))));
  });
  document.querySelectorAll('[data-delete-tx]').forEach((b) => {
    b.addEventListener('click', () => openDeleteTxModal(b.dataset.deleteTx, () => renderTransactions()));
  });
  wireTxFilters();
}

function wireTxFilters() {
  document.getElementById('tf-account').addEventListener('change', (e) => { txFilters.account_id = e.target.value; txPage = 1; renderTransactions(); });
  document.getElementById('tf-category').addEventListener('change', (e) => { txFilters.category_id = e.target.value; txPage = 1; renderTransactions(); });
  document.getElementById('tf-direction').addEventListener('change', (e) => { txFilters.direction = e.target.value; txPage = 1; renderTransactions(); });
  document.getElementById('tf-from').addEventListener('change', (e) => { txFilters.from = e.target.value; txPage = 1; renderTransactions(); });
  document.getElementById('tf-to').addEventListener('change', (e) => { txFilters.to = e.target.value; txPage = 1; renderTransactions(); });
  document.getElementById('tf-clear').addEventListener('click', () => {
    txFilters = { account_id: '', category_id: '', direction: '', from: '', to: '' };
    txPage = 1;
    renderTransactions();
  });
}

async function openEditTxModal(t) {
  const [accounts, cats, debts] = await Promise.all([api('/accounts'), api('/categories'), api('/debts')]);
  const renderCatOptions = (direction) => cats
    .filter((c) => c.direction === direction)
    .map((c) => `<option value="${c.id}" ${c.id === t.category_id ? 'selected' : ''}>${c.name}</option>`)
    .join('');
  const accountOptions = accounts
    .map((a) => `<option value="${a.id}" ${a.id === t.account_id ? 'selected' : ''}>${a.display_name}</option>`)
    .join('');

  manualModal.innerHTML = `
    <div class="card">
      <strong>ویرایش تراکنش</strong>
      <select id="e-account">${accountOptions}</select>
      <select id="e-direction">
        <option value="expense" ${t.direction === 'expense' ? 'selected' : ''}>کسر از حساب</option>
        <option value="income" ${t.direction === 'income' ? 'selected' : ''}>واریز به حساب</option>
      </select>
      <input id="e-amount" type="text" inputmode="numeric" value="${toman(t.amount_rial)}" />
      <select id="e-category">${renderCatOptions(t.direction)}</select>
      ${loanPersonFieldHtml('e')}
      ${repayFieldHtml('e')}
      ${bankLoanFieldHtml('e')}
      <input id="e-note" placeholder="توضیح" value="${t.note || ''}" />
      <input id="e-tags" placeholder="تگ (با کاما جدا کن)" value="${t.tags || ''}" />
      <button class="action" id="e-save">ذخیره</button>
      <button class="action secondary" id="e-cancel">انصراف</button>
    </div>
  `;
  manualModal.hidden = false;
  wireThousandsInput('e-amount');

  const updateRepayE = wireRepayField('e-category', () => document.getElementById('e-direction').value, 'repay-debt-e', cats, debts);
  const updateLoanE = wireLoanField('e-category', 'e', cats, debts, () => document.getElementById('e-direction').value);
  document.getElementById('e-direction').addEventListener('change', (e) => {
    document.getElementById('e-category').innerHTML = renderCatOptions(e.target.value);
    updateRepayE();
    updateLoanE();
  });
  wireBankLoanField('e-category', 'bank-loan-e', cats);
  document.getElementById('e-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  onClickLocked(document.getElementById('e-save'), async () => {
    const accountName = accounts.find((a) => String(a.id) === document.getElementById('e-account').value)?.display_name || '';
    await maybeCreateLoanDebt('e', document.getElementById('e-direction').value, numFromInput('e-amount'));
    await maybeRepayDebt('repay-debt-e', numFromInput('e-amount'));
    await maybeCreateLoanInstallment('e', accountName, numFromInput('e-amount'));
    await api(`/transactions/${t.id}/edit`, {
      method: 'PUT',
      body: JSON.stringify({
        account_id: document.getElementById('e-account').value,
        direction: document.getElementById('e-direction').value,
        amount_rial: numFromInput('e-amount'),
        category_id: document.getElementById('e-category').value || null,
        note: document.getElementById('e-note').value || null,
        tags: document.getElementById('e-tags').value || null,
      }),
    });
    manualModal.hidden = true;
    renderTransactions();
  });
}

function txCard(t, cats, editable, accounts) {
  const options = cats
    .filter((c) => c.direction === t.direction)
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join('');
  return `
    <div class="card" id="tx-${t.id}">
      <div class="row">
        ${editable
          ? `<input id="amount-${t.id}" type="text" inputmode="numeric" class="${t.direction === 'income' ? 'amount-income' : 'amount-expense'} font-num" style="width:auto" value="${toman(t.amount_rial)}" />`
          : `<span class="${t.direction === 'income' ? 'amount-income' : 'amount-expense'} font-num">${t.direction === 'income' ? '+' : '-'}${toman(t.amount_rial)} ریال</span>`}
        <span class="muted">${t.account_name}</span>
      </div>
      <div class="muted">موجودی بعد از تراکنش: <span class="privacy-target font-num">${t.balance_after_rial != null ? toman(t.balance_after_rial) + ' ریال' : '-'}</span></div>
      ${t.note && t.note.includes('احتمالاً تکراری') ? `<div style="color:var(--red);font-size:.75rem;margin-top:4px">⚠️ ${t.note}</div>` : ''}
      ${editable ? `
        <select id="cat-${t.id}"><option value="">انتخاب دسته‌بندی...</option>${options}</select>
        ${otherAccountFieldHtml(t.id, accounts, t.account_id)}
        ${loanPersonFieldHtml(t.id)}
        ${repayFieldHtml(t.id)}
        ${bankLoanFieldHtml(t.id)}
        <input id="note-${t.id}" placeholder="توضیح (اختیاری)" />
        <input id="tags-${t.id}" placeholder="تگ (مثلا سفر، کار — با کاما جدا کن)" />
        <div class="row" style="gap:8px">
          <button class="action" id="confirm-${t.id}" style="flex:1">ثبت و قطعی</button>
          <button class="action danger" id="delete-${t.id}" style="width:auto;flex:0 0 auto">🗑</button>
        </div>
      ` : ''}
    </div>
  `;
}

function wireTxCard(t, cats, accounts, debts, histogram) {
  const btn = document.getElementById(`confirm-${t.id}`);
  if (!btn) return;
  wireThousandsInput(`amount-${t.id}`);
  wireTransferField(`cat-${t.id}`, `other-account-${t.id}`, cats);
  wireLoanField(`cat-${t.id}`, t.id, cats, debts, () => t.direction);
  wireRepayField(`cat-${t.id}`, () => t.direction, `repay-debt-${t.id}`, cats, debts || []);
  wireBankLoanField(`cat-${t.id}`, `bank-loan-${t.id}`, cats);
  if (histogram) wireCategorySuggestion(`amount-${t.id}`, `cat-${t.id}`, () => t.direction, histogram)();
  onClickLocked(btn, async () => {
    const category_id = document.getElementById(`cat-${t.id}`).value || null;
    let note = document.getElementById(`note-${t.id}`).value || null;
    const otherAccountSelect = document.getElementById(`other-account-${t.id}`);
    if (!otherAccountSelect.hidden && otherAccountSelect.value) {
      const otherAccount = accounts.find((a) => String(a.id) === otherAccountSelect.value);
      note = `حساب مقابل: ${otherAccount.display_name}${note ? ' — ' + note : ''}`;
    }
    const tags = document.getElementById(`tags-${t.id}`).value || null;
    const amount_rial = numFromInput(`amount-${t.id}`);
    if (amount_rial && amount_rial !== t.amount_rial) {
      await api(`/transactions/${t.id}/edit`, {
        method: 'PUT',
        body: JSON.stringify({ amount_rial, direction: t.direction, account_id: t.account_id }),
      });
    }
    const account = accounts.find((a) => a.id === t.account_id);
    await maybeCreateLoanDebt(t.id, t.direction, amount_rial);
    await maybeRepayDebt(`repay-debt-${t.id}`, amount_rial);
    await maybeCreateLoanInstallment(t.id, account?.display_name || '', amount_rial);
    await api(`/transactions/${t.id}/confirm`, { method: 'POST', body: JSON.stringify({ category_id, note, tags }) });
    document.getElementById(`tx-${t.id}`).remove();
  });
  document.getElementById(`delete-${t.id}`).addEventListener('click', () => {
    openDeleteTxModal(t.id, () => {
      document.getElementById(`tx-${t.id}`).remove();
      updatePendingBadge();
    });
  });
}

function openDeleteTxModal(txId, onDeleted) {
  manualModal.innerHTML = `
    <div class="card">
      <strong>حذف تراکنش</strong>
      <label class="row" style="margin-top:10px">
        <span>موجودی حساب هم به حالت قبل برگرده</span>
        <input id="del-revert-balance" type="checkbox" checked style="width:auto" />
      </label>
      <div class="muted" style="font-size:.7rem;margin-top:4px">اگه این تراکنش تکراری بود یا موجودی از جای دیگه‌ای درسته، تیک رو بردار تا فقط خود تراکنش حذف بشه و موجودی دست‌نخورده بمونه.</div>
      <button class="action danger" id="del-confirm">حذف</button>
      <button class="action secondary" id="del-cancel">انصراف</button>
    </div>
  `;
  manualModal.hidden = false;
  document.getElementById('del-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  onClickLocked(document.getElementById('del-confirm'), async () => {
    const revert_balance = document.getElementById('del-revert-balance').checked;
    await api(`/transactions/${txId}`, { method: 'DELETE', body: JSON.stringify({ revert_balance }) });
    manualModal.hidden = true;
    onDeleted();
  });
}

const BANK_THEMES = {
  resalat: 'linear-gradient(160deg, #2563eb 0%, #1e40af 45%, #0c1e4a 100%)',
  blu: 'linear-gradient(135deg, #0ea5a6, #0a4f50)',
  pasargad: 'linear-gradient(135deg, #00573f, #7a5c00)',
};
function bankTheme(bankCode) {
  return BANK_THEMES[bankCode] || 'linear-gradient(135deg, #1e293b, #0f172a)';
}

const BANK_LOGOS = {
  blu: 'https://www.google.com/s2/favicons?sz=128&domain=blubank.com',
  pasargad: 'https://www.google.com/s2/favicons?sz=128&domain=bpi.ir',
};
function bankLogoHtml(bankCode, size) {
  const url = BANK_LOGOS[bankCode];
  if (!url) return '';
  return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;border-radius:8px;background:white;padding:3px;object-fit:contain" onerror="this.remove()" />`;
}

function copyableField(label, value, displayValue) {
  if (!value) return '';
  return `
    <div class="row card-field" data-copy="${value}" style="margin-top:8px;cursor:pointer">
      <span style="font-size:.7rem;opacity:.8">${label}</span>
      <span class="font-num copy-value" style="font-size:.8rem;letter-spacing:1px;direction:ltr;unicode-bidi:isolate;display:inline-block">${displayValue || value} 📋</span>
    </div>
  `;
}

function cardInfoHtml(a) {
  const spacedCardNumber = a.card_number ? a.card_number.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim() : null;
  return `
    <div class="card-chip"></div>
    ${copyableField('شماره کارت', a.card_number, spacedCardNumber)}
    ${copyableField('شماره حساب', a.account_number)}
    ${copyableField('شبا', a.iban ? 'IR' + a.iban : null)}
    <div class="row" style="margin-top:8px">
      ${a.expiry ? `<span style="font-size:.7rem;opacity:.8">انقضا: <span class="font-num">${a.expiry}</span></span>` : '<span></span>'}
      ${a.cvv2 ? `<span style="font-size:.7rem;opacity:.8">CVV2: <span class="font-num privacy-target">${a.cvv2}</span></span>` : ''}
    </div>
  `;
}

function wireCopyFields() {
  document.querySelectorAll('[data-copy]').forEach((el) => {
    onClickLocked(el, async () => {
      const valueEl = el.querySelector('.copy-value');
      const original = valueEl.textContent;
      try {
        await navigator.clipboard.writeText(el.dataset.copy);
        valueEl.textContent = 'کپی شد ✅';
        setTimeout(() => { valueEl.textContent = original; }, 1200);
      } catch (e) {
        valueEl.textContent = 'کپی ناموفق بود';
        setTimeout(() => { valueEl.textContent = original; }, 1200);
      }
    });
  });
}

// Auto-format expiry as MM/YY while typing (two digits, slash, two digits).
function wireExpiryInput(id) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    const digits = el.value.replace(/\D/g, '').slice(0, 4);
    el.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  });
}

async function renderAccounts() {
  const accounts = await api('/accounts');
  const total = accounts.reduce((s, a) => s + Number(a.balance_rial), 0);
  content.innerHTML = `
    <div class="card row">
      <span class="muted">مجموع موجودی</span>
      <strong class="privacy-target font-num" style="color:var(--green)">${toman(total)} ریال</strong>
    </div>
    <button class="action" id="acc-new">+ حساب جدید</button>
  ` + accounts.map((a) => `
    <div class="bank-card" style="margin:10px 0;background:${bankTheme(a.bank_code)}">
      <div class="row">
        <div class="row" style="width:auto;gap:8px">${bankLogoHtml(a.bank_code, 28)}<span>${a.display_name}</span></div>
        <div class="row" style="width:auto;gap:6px">
          <button data-balance-log="${a.id}" style="background:rgba(255,255,255,.15);border:none;color:white;border-radius:8px;padding:4px 8px;font-family:inherit;font-size:.7rem;cursor:pointer">🕓 تاریخچه</button>
          <button data-edit-acc="${a.id}" style="background:rgba(255,255,255,.15);border:none;color:white;border-radius:8px;padding:4px 8px;font-family:inherit;font-size:.7rem;cursor:pointer">✎ ویرایش</button>
        </div>
      </div>
      ${cardInfoHtml(a)}
      <div class="row" style="margin-top:12px">
        <span class="muted" style="font-size:.75rem">موجودی</span>
        <strong class="privacy-target font-num">${toman(a.balance_rial)} ریال</strong>
      </div>
      <div class="grid2" style="margin-top:10px">
        <input id="recon-${a.id}" type="text" inputmode="numeric" placeholder="موجودی واقعی کارت (تطبیق)" style="background:rgba(255,255,255,.1);color:white;border-color:rgba(255,255,255,.2)" />
        <button class="action secondary" data-recon="${a.id}" style="width:auto;background:rgba(255,255,255,.15);border:none;color:white">بررسی</button>
      </div>
      <div id="recon-result-${a.id}" class="muted" style="font-size:.7rem;margin-top:4px"></div>
    </div>
  `).join('');

  wireCopyFields();
  accounts.forEach((a) => wireThousandsInput(`recon-${a.id}`));

  document.getElementById('acc-new').addEventListener('click', () => openAccountModal(null));
  document.querySelectorAll('[data-edit-acc]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      openAccountModal(accounts.find((a) => a.id === Number(b.dataset.editAcc)));
    });
  });
  document.querySelectorAll('[data-balance-log]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      openBalanceLogModal(accounts.find((a) => a.id === Number(b.dataset.balanceLog)));
    });
  });
  document.querySelectorAll('[data-recon]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.recon;
      const account = accounts.find((a) => a.id === Number(id));
      const actual = numFromInput(`recon-${id}`);
      const resultEl = document.getElementById(`recon-result-${id}`);
      if (!actual) { resultEl.textContent = 'موجودی واقعی رو وارد کن'; return; }
      const diff = actual - Number(account.balance_rial);
      if (diff === 0) {
        resultEl.innerHTML = '✅ موجودی دقیقاً برابره';
      } else {
        resultEl.innerHTML = `⚠️ اختلاف: <span class="font-num" style="color:${diff > 0 ? 'var(--green)' : 'var(--red)'}">${diff > 0 ? '+' : ''}${toman(diff)} ریال</span> (برنامه ${diff > 0 ? 'کمتر' : 'بیشتر'} از واقعی ثبت کرده)`;
      }
    });
  });
}

function openAccountModal(account) {
  const isNew = !account;
  manualModal.innerHTML = `
    <div class="card">
      <strong>${isNew ? 'حساب بانکی جدید' : 'ویرایش حساب'}</strong>
      <input id="acc-name" placeholder="نام بانک/حساب" value="${account?.display_name || ''}" />
      <input id="acc-balance" type="text" inputmode="numeric" placeholder="موجودی (ریال)" value="${account ? toman(account.balance_rial) : ''}" />
      <input id="acc-card" placeholder="شماره کارت (اختیاری)" value="${account?.card_number || ''}" />
      <input id="acc-account-number" placeholder="شماره حساب (اختیاری)" value="${account?.account_number || ''}" />
      <input id="acc-iban" placeholder="شبا بدون IR (اختیاری)" value="${account?.iban || ''}" />
      <div class="grid2">
        <input id="acc-cvv2" placeholder="CVV2 (اختیاری)" value="${account?.cvv2 || ''}" />
        <input id="acc-expiry" placeholder="انقضا MM/YY (اختیاری)" inputmode="numeric" value="${account?.expiry || ''}" />
      </div>
      <input id="acc-threshold" type="text" inputmode="numeric" placeholder="هشدار وقتی موجودی کمتر از این شد (ریال، اختیاری)" value="${account?.low_balance_threshold_rial ? toman(account.low_balance_threshold_rial) : ''}" />
      <button class="action" id="acc-save">${isNew ? 'افزودن' : 'ذخیره'}</button>
      <button class="action secondary" id="acc-cancel">انصراف</button>
    </div>
  `;
  manualModal.hidden = false;
  wireThousandsInput('acc-balance');
  wireThousandsInput('acc-threshold');
  wireExpiryInput('acc-expiry');

  document.getElementById('acc-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  onClickLocked(document.getElementById('acc-save'), async () => {
    const display_name = document.getElementById('acc-name').value;
    if (!display_name) return;
    const body = {
      display_name,
      balance_rial: numFromInput('acc-balance'),
      card_number: document.getElementById('acc-card').value || null,
      account_number: document.getElementById('acc-account-number').value || null,
      iban: document.getElementById('acc-iban').value || null,
      cvv2: document.getElementById('acc-cvv2').value || null,
      expiry: document.getElementById('acc-expiry').value || null,
      low_balance_threshold_rial: numFromInput('acc-threshold') ? numFromInput('acc-threshold') : null,
    };
    if (isNew) {
      await api('/accounts', { method: 'POST', body: JSON.stringify(body) });
    } else {
      await api(`/accounts/${account.id}`, { method: 'PUT', body: JSON.stringify(body) });
    }
    manualModal.hidden = true;
    renderAccounts();
  });
}

async function openBalanceLogModal(account) {
  const log = await api(`/accounts/${account.id}/balance-log`);
  manualModal.innerHTML = `
    <div class="card">
      <strong>تاریخچه‌ی ویرایش دستی موجودی — ${account.display_name}</strong>
      ${log.length === 0 ? '<p class="muted">تا حالا این حساب دستی ویرایش نشده.</p>' : log.map((l) => `
        <div class="row muted font-num" style="margin-top:10px;font-size:.75rem;border-top:1px solid var(--border-soft);padding-top:8px">
          <span>${formatJalaliDateTime(new Date(l.created_at))}</span>
          <span>${toman(l.old_balance_rial)} ← ${toman(l.new_balance_rial)}</span>
        </div>
      `).join('')}
      <button class="action secondary" id="bal-log-close" style="margin-top:14px">بستن</button>
    </div>
  `;
  manualModal.hidden = false;
  document.getElementById('bal-log-close').addEventListener('click', () => { manualModal.hidden = true; });
}

async function renderInstallments() {
  const items = await api('/installments');
  content.innerHTML = `
    <div class="card">
      <strong>افزودن قسط/وام جدید</strong>
      <input id="i-title" placeholder="عنوان (مثلا: وام خودرو)" />
      <select id="i-type"><option value="installment">قسط</option><option value="loan">وام</option></select>
      <input id="i-amount" type="text" inputmode="numeric" placeholder="مبلغ هر قسط (ریال)" />
      <input id="i-count" type="text" inputmode="numeric" placeholder="تعداد کل اقساط" />
      <input id="i-day" type="text" inputmode="numeric" placeholder="روز موعد در ماه (شمسی)" />
      <button class="action" id="i-add">افزودن</button>
    </div>
  ` + (items.length === 0 ? '<p class="muted">قسطی ثبت نشده.</p>' : items.map((i) => {
    const percent = Math.round((i.paid_count / i.total_count) * 100);
    const remaining = i.installment_amount_rial * (i.total_count - i.paid_count);
    return `
    <div class="card" id="inst-${i.id}">
      <div class="row">
        <strong>${i.title}</strong>
        <span class="badge ${i.status}">${i.status === 'completed' ? 'تکمیل‌شده' : (i.type === 'loan' ? 'وام فعال' : 'قسط فعال')}</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      <div class="row muted" style="margin-top:6px;font-size:.75rem">
        <span>قسط ${i.paid_count} از ${i.total_count} · روز موعد: ${i.due_day_of_month}</span>
        <span class="font-num">${toman(i.installment_amount_rial)} ریال/ماه</span>
      </div>
      ${i.status === 'active' ? `
        <div class="row" style="margin-top:8px">
          <span class="muted" style="font-size:.75rem">مانده بدهی</span>
          <strong class="font-num privacy-target" style="color:var(--red)">${toman(remaining)} ریال</strong>
        </div>
        <div class="row" style="gap:8px">
          <button class="action" data-pay="${i.id}" style="flex:1">ثبت پرداخت دستی</button>
          <button class="action secondary" data-edit-inst="${i.id}" style="width:auto">✎</button>
          <button class="action danger" data-delete-inst="${i.id}" style="width:auto">🗑</button>
        </div>
      ` : `
        <button class="action danger" data-delete-inst="${i.id}" style="margin-top:8px">🗑 حذف</button>
      `}
    </div>
  `;
  }).join(''));

  wireThousandsInput('i-amount');
  wireThousandsInput('i-count');
  wireThousandsInput('i-day');

  onClickLocked(document.getElementById('i-add'), async () => {
    const title = document.getElementById('i-title').value;
    const type = document.getElementById('i-type').value;
    const installment_amount_toman = numFromInput('i-amount');
    const total_count = numFromInput('i-count');
    const due_day_of_month = numFromInput('i-day');
    if (!title || !installment_amount_toman || !total_count || !due_day_of_month) return;
    await api('/installments', {
      method: 'POST',
      body: JSON.stringify({
        title, type,
        installment_amount_rial: installment_amount_toman,
        total_count, due_day_of_month,
      }),
    });
    renderInstallments();
  });

  document.querySelectorAll('[data-pay]').forEach((b) => {
    onClickLocked(b, async () => {
      if (!confirm('پرداخت این قسط ثبت شود؟ این عملیات قابل بازگشت نیست.')) return;
      await api(`/installments/${b.dataset.pay}/pay`, { method: 'POST' });
      renderInstallments();
    });
  });

  document.querySelectorAll('[data-delete-inst]').forEach((b) => {
    onClickLocked(b, async () => {
      if (!confirm('این قسط/وام کاملاً حذف شود؟')) return;
      await api(`/installments/${b.dataset.deleteInst}`, { method: 'DELETE' });
      renderInstallments();
    });
  });

  document.querySelectorAll('[data-edit-inst]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      openInstallmentModal(items.find((i) => i.id === Number(b.dataset.editInst)));
    });
  });
}

function openInstallmentModal(item) {
  manualModal.innerHTML = `
    <div class="card">
      <strong>ویرایش قسط/وام</strong>
      <input id="inst-title" placeholder="عنوان" value="${item.title}" />
      <input id="inst-amount" type="text" inputmode="numeric" placeholder="مبلغ هر قسط (ریال)" value="${toman(item.installment_amount_rial)}" />
      <div class="grid2">
        <input id="inst-total" type="text" inputmode="numeric" placeholder="تعداد کل اقساط" value="${item.total_count}" />
        <input id="inst-paid" type="text" inputmode="numeric" placeholder="تعداد پرداخت‌شده" value="${item.paid_count}" />
      </div>
      <input id="inst-day" type="text" inputmode="numeric" placeholder="روز موعد در ماه (شمسی)" value="${item.due_day_of_month}" />
      <button class="action" id="inst-save">ذخیره</button>
      <button class="action secondary" id="inst-cancel">انصراف</button>
    </div>
  `;
  manualModal.hidden = false;
  wireThousandsInput('inst-amount');
  wireThousandsInput('inst-total');
  wireThousandsInput('inst-paid');
  wireThousandsInput('inst-day');

  document.getElementById('inst-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  onClickLocked(document.getElementById('inst-save'), async () => {
    const title = document.getElementById('inst-title').value;
    if (!title) return;
    await api(`/installments/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        installment_amount_rial: numFromInput('inst-amount'),
        total_count: numFromInput('inst-total'),
        paid_count: numFromInput('inst-paid'),
        due_day_of_month: numFromInput('inst-day'),
      }),
    });
    manualModal.hidden = true;
    renderInstallments();
  });
}

async function renderInvestments() {
  const [items, accounts, installments, debts] = await Promise.all([
    api('/investments'), api('/accounts'), api('/installments'), api('/debts'),
  ]);
  const totalInvested = items.reduce((s, v) => s + Number(v.invested_amount_rial), 0);
  const totalCurrent = items.reduce((s, v) => s + Number(v.current_value_rial), 0);
  const totalGain = totalCurrent - totalInvested;

  const totalCash = accounts.reduce((s, a) => s + Number(a.balance_rial), 0);
  const activeInstallments = installments.filter((i) => i.status === 'active');
  const remainingInstallmentDebt = activeInstallments.reduce(
    (sum, i) => sum + i.installment_amount_rial * (i.total_count - i.paid_count), 0
  );
  const openDebts = debts.filter((d) => d.status === 'open');
  const totalIOwe = openDebts.filter((d) => d.type === 'i_owe').reduce((s, d) => s + Number(d.amount_rial), 0);
  const totalOwedToMe = openDebts.filter((d) => d.type === 'owed_to_me').reduce((s, d) => s + Number(d.amount_rial), 0);
  const netWorth = totalCash + totalCurrent + totalOwedToMe - remainingInstallmentDebt - totalIOwe;

  content.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="muted">دارایی خالص شما</div>
      <div class="privacy-target font-num" style="font-size:1.6rem;font-weight:800;margin-top:6px">${toman(netWorth)} <span class="muted" style="font-size:.8rem">ریال</span></div>
    </div>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">سود/زیان کل</div>
        <div class="metric-value privacy-target font-num" style="color:${totalGain >= 0 ? 'var(--green)' : 'var(--red)'}">${totalGain >= 0 ? '+' : ''}${toman(totalGain)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">ارزش فعلی</div>
        <div class="metric-value privacy-target font-num">${toman(totalCurrent)}</div>
      </div>
    </div>
    <button class="action secondary" id="refresh-prices">🔄 بروزرسانی خودکار قیمت دلار/طلا/سکه</button>
    <div class="card">
      <strong>افزودن سرمایه‌گذاری</strong>
      <input id="v-title" placeholder="عنوان (مثلا: طلای 18 عیار)" />
      <select id="v-type">
        <option value="gold">طلا (بر اساس گرم)</option>
        <option value="coin">سکه (بر اساس تعداد)</option>
        <option value="dollar">دلار (بر اساس تعداد)</option>
        <option value="other">سایر (مبلغ کلی)</option>
      </select>
      <div id="v-qty-fields">
        <input id="v-qty" type="text" inputmode="decimal" placeholder="مقدار (مثلا 0.98 گرم)" />
        <input id="v-unit-price" type="text" inputmode="numeric" placeholder="قیمت هر واحد هنگام خرید (ریال)" />
      </div>
      <input id="v-amount" type="text" inputmode="numeric" placeholder="مبلغ کل سرمایه‌گذاری‌شده (ریال)" hidden />
      <button class="action" id="v-add">افزودن</button>
    </div>
  ` + (items.length === 0 ? '<p class="muted">سرمایه‌گذاری ثبت نشده.</p>' : items.map((v) => {
    const gainPercent = v.invested_amount_rial > 0
      ? Math.round(((v.current_value_rial - v.invested_amount_rial) / v.invested_amount_rial) * 100)
      : 0;
    const unitLabel = { gold: 'گرم', coin: 'عدد', dollar: 'دلار' }[v.asset_type] || null;
    return `
    <div class="card">
      <div class="row">
        <strong>${v.title}</strong>
        <div class="row" style="width:auto;gap:6px">
          <span class="badge ${gainPercent >= 0 ? 'gain' : 'loss'}">${gainPercent >= 0 ? '+' : ''}${gainPercent}%</span>
          <button data-edit-inv="${v.id}" class="action secondary" style="width:auto;padding:4px 8px;font-size:.7rem">✎</button>
        </div>
      </div>
      ${unitLabel ? `<div class="muted font-num">${v.quantity} ${unitLabel} · خرید هر واحد: ${toman(v.purchase_unit_price_rial)} ریال</div>` : ''}
      <div class="muted privacy-target font-num">مبلغ اولیه: ${toman(v.invested_amount_rial)} ریال</div>
      ${unitLabel ? `
        <div class="grid2">
          <input id="v-cur-price-${v.id}" type="text" inputmode="numeric" placeholder="قیمت فعلی هر واحد (ریال)" value="${toman(v.current_unit_price_rial || v.purchase_unit_price_rial)}" />
          <button class="action secondary" data-update-price="${v.id}">به‌روزرسانی قیمت</button>
        </div>
      ` : `
        <div class="grid2">
          <input id="v-cur-${v.id}" type="text" inputmode="numeric" placeholder="ارزش فعلی (ریال)" value="${toman(v.current_value_rial)}" />
          <button class="action secondary" data-update="${v.id}">به‌روزرسانی</button>
        </div>
      `}
    </div>
  `;
  }).join(''));

  wireThousandsInput('v-amount');
  wireThousandsInput('v-unit-price');
  items.forEach((v) => {
    wireThousandsInput(`v-cur-${v.id}`);
    wireThousandsInput(`v-cur-price-${v.id}`);
  });

  onClickLocked(document.getElementById('refresh-prices'), async (e) => {
    e.target.textContent = '⏳ در حال بروزرسانی...';
    try {
      await api('/investments/refresh-prices', { method: 'POST' });
    } catch (err) { /* endpoint may not be configured yet */ }
    renderInvestments();
  });

  const vType = document.getElementById('v-type');
  const vQtyFields = document.getElementById('v-qty-fields');
  const vAmount = document.getElementById('v-amount');
  vType.addEventListener('change', () => {
    const isOther = vType.value === 'other';
    vQtyFields.hidden = isOther;
    vAmount.hidden = !isOther;
  });

  onClickLocked(document.getElementById('v-add'), async () => {
    const title = document.getElementById('v-title').value;
    const asset_type = vType.value;
    if (!title) return;
    let body;
    if (asset_type === 'other') {
      const amountToman = numFromInput('v-amount');
      if (!amountToman) return;
      body = { title, asset_type, invested_amount_rial: amountToman };
    } else {
      const quantity = Number(document.getElementById('v-qty').value);
      const unitPriceToman = numFromInput('v-unit-price');
      if (!quantity || !unitPriceToman) return;
      body = { title, asset_type, quantity, purchase_unit_price_rial: unitPriceToman };
    }
    await api('/investments', { method: 'POST', body: JSON.stringify(body) });
    renderInvestments();
  });

  document.querySelectorAll('[data-update-price]').forEach((b) => {
    onClickLocked(b, async () => {
      const id = b.dataset.updatePrice;
      const current_unit_price_rial = numFromInput(`v-cur-price-${id}`);
      await api(`/investments/${id}`, { method: 'PUT', body: JSON.stringify({ current_unit_price_rial }) });
      renderInvestments();
    });
  });

  document.querySelectorAll('[data-update]').forEach((b) => {
    onClickLocked(b, async () => {
      const id = b.dataset.update;
      const val = numFromInput(`v-cur-${id}`);
      await api(`/investments/${id}`, { method: 'PUT', body: JSON.stringify({ current_value_rial: val }) });
      renderInvestments();
    });
  });

  document.querySelectorAll('[data-edit-inv]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      openInvestmentModal(items.find((v) => v.id === Number(b.dataset.editInv)));
    });
  });
}

function openInvestmentModal(item) {
  const unitLabel = { gold: 'گرم', coin: 'عدد', dollar: 'دلار' }[item.asset_type] || null;
  manualModal.innerHTML = `
    <div class="card">
      <strong>ویرایش سرمایه‌گذاری</strong>
      <input id="inv-title" placeholder="عنوان" value="${item.title}" />
      ${unitLabel ? `
        <div class="grid2">
          <input id="inv-qty" type="text" inputmode="decimal" placeholder="مقدار (${unitLabel})" value="${item.quantity}" />
          <input id="inv-purchase-price" type="text" inputmode="numeric" placeholder="قیمت خرید هر واحد (ریال)" value="${toman(item.purchase_unit_price_rial)}" />
        </div>
      ` : ''}
      <input id="inv-invested" type="text" inputmode="numeric" placeholder="مبلغ اولیه (ریال)" value="${toman(item.invested_amount_rial)}" />
      <button class="action" id="inv-save">ذخیره</button>
      <button class="action secondary" id="inv-cancel">انصراف</button>
    </div>
  `;
  manualModal.hidden = false;
  if (unitLabel) wireThousandsInput('inv-purchase-price');
  wireThousandsInput('inv-invested');

  document.getElementById('inv-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  onClickLocked(document.getElementById('inv-save'), async () => {
    const title = document.getElementById('inv-title').value;
    if (!title) return;
    const body = {
      title,
      invested_amount_rial: numFromInput('inv-invested'),
    };
    if (unitLabel) {
      body.quantity = Number(document.getElementById('inv-qty').value) || null;
      body.purchase_unit_price_rial = numFromInput('inv-purchase-price');
    }
    await api(`/investments/${item.id}`, { method: 'PUT', body: JSON.stringify(body) });
    manualModal.hidden = true;
    renderInvestments();
  });
}

async function renderCategories() {
  const cats = await api('/categories');
  const pill = (c) => `
    <button class="cat-pill ${c.direction}" data-edit="${c.id}" data-name="${c.name}">
      ✎ ${c.name}
    </button>
  `;
  content.innerHTML = `
    <div class="card">
      <strong>افزودن دسته‌بندی جدید</strong>
      <input id="c-name" placeholder="نام دسته‌بندی" />
      <select id="c-dir"><option value="expense">هزینه (کسر از حساب)</option><option value="income">درآمد (واریز)</option></select>
      <button class="action" id="c-add">افزودن</button>
    </div>
    <div class="card">
      <strong style="color:var(--red)">دسته‌های هزینه</strong>
      <div class="cat-pill-grid">${cats.filter((c) => c.direction === 'expense').map(pill).join('')}</div>
    </div>
    <div class="card">
      <strong style="color:var(--green)">دسته‌های درآمد</strong>
      <div class="cat-pill-grid">${cats.filter((c) => c.direction === 'income').map(pill).join('')}</div>
    </div>
  `;

  onClickLocked(document.getElementById('c-add'), async () => {
    const name = document.getElementById('c-name').value;
    const direction = document.getElementById('c-dir').value;
    if (!name) return;
    await api('/categories', { method: 'POST', body: JSON.stringify({ name, direction }) });
    renderCategories();
  });

  document.querySelectorAll('[data-edit]').forEach((b) => {
    onClickLocked(b, async () => {
      const newName = prompt('نام جدید:', b.dataset.name);
      if (!newName) return;
      await api(`/categories/${b.dataset.edit}`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
      renderCategories();
    });
  });
}

function shiftJalaliMonth(jy, jm, delta) {
  let ty = jy, tm = jm + delta;
  while (tm < 1) { tm += 12; ty -= 1; }
  while (tm > 12) { tm -= 12; ty += 1; }
  return { jy: ty, jm: tm };
}

let analyticsMonth = null; // {jy, jm} — the month currently being browsed; null = current month

function netWorthChartSvg(snapshots) {
  if (snapshots.length < 2) return '<p class="muted">هنوز داده‌ی کافی نیست — هر روز ساعت ۸ صبح یه نقطه‌ی جدید ثبت می‌شه.</p>';
  const values = snapshots.map((s) => Number(s.net_worth_rial));
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const w = 300, h = 90, pad = 6;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const first = values[0], last = values[values.length - 1];
  const changePercent = first !== 0 ? Math.round(((last - first) / Math.abs(first)) * 100) : null;
  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:90px;margin-top:8px" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="var(--gold)" stroke-width="2" />
    </svg>
    <div class="row muted font-num" style="font-size:.7rem;margin-top:4px">
      <span>${formatJalaliDate(new Date(snapshots[0].created_at))}: ${toman(first)} ریال</span>
      <span>${formatJalaliDate(new Date(snapshots[snapshots.length - 1].created_at))}: ${toman(last)} ریال${changePercent != null ? ` (${changePercent >= 0 ? '+' : ''}${changePercent}٪)` : ''}</span>
    </div>
  `;
}

async function renderAnalytics() {
  const [txs, categories, accounts, netWorthHistory, installmentsAll, debtsAll, dataQuality] = await Promise.all([
    api('/transactions'), api('/categories'), api('/accounts'), api('/net-worth/history'),
    api('/installments'), api('/debts'), api('/data-quality'),
  ]);
  const confirmed = txs.filter((t) => t.status === 'confirmed' && !isNonFlowCategory(t.category_name));
  const totalCash = accounts.reduce((s, a) => s + Number(a.balance_rial), 0);

  const now = new Date();
  const nowJalali = Jalali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (!analyticsMonth) analyticsMonth = { jy: nowJalali.jy, jm: nowJalali.jm };
  const selY = analyticsMonth.jy, selM = analyticsMonth.jm;
  const isCurrentMonth = selY === nowJalali.jy && selM === nowJalali.jm;
  const prevMonth = shiftJalaliMonth(selY, selM, -1);

  const inJalaliYM = (d, jy, jm) => {
    const j = Jalali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return j.jy === jy && j.jm === jm;
  };
  const thisMonthExpense = confirmed.filter((t) => t.direction === 'expense' && inJalaliYM(new Date(t.created_at), selY, selM));
  const lastMonthExpense = confirmed.filter((t) => t.direction === 'expense' && inJalaliYM(new Date(t.created_at), prevMonth.jy, prevMonth.jm));
  const thisSum = thisMonthExpense.reduce((s, t) => s + Number(t.amount_rial), 0);
  const lastSum = lastMonthExpense.reduce((s, t) => s + Number(t.amount_rial), 0);
  const trendPercent = lastSum > 0 ? Math.round(((thisSum - lastSum) / lastSum) * 100) : null;

  // Top spending categories in the selected month
  const byCategory = {};
  thisMonthExpense.forEach((t) => {
    const name = t.category_name || 'بدون دسته';
    byCategory[name] = (byCategory[name] || 0) + Number(t.amount_rial);
  });
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCategoryAmount = topCategories[0]?.[1] || 1;
  const categoryShare = (amount) => thisSum > 0 ? Math.round((amount / thisSum) * 100) : 0;

  // Weekday heatmap (Saturday..Friday), selected month
  const weekdayNames = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const weekdaySums = [0, 0, 0, 0, 0, 0, 0];
  thisMonthExpense.forEach((t) => {
    const jsDay = new Date(t.created_at).getDay(); // 0=Sun..6=Sat
    const persianIndex = (jsDay + 1) % 7; // shift so Saturday=0
    weekdaySums[persianIndex] += Number(t.amount_rial);
  });
  const maxWeekday = Math.max(...weekdaySums, 1);

  // Calendar heatmap for the selected Jalali month
  const daysInMonth = Jalali.monthLength(selY, selM);
  const dailySums = {};
  thisMonthExpense.forEach((t) => {
    const d = new Date(t.created_at);
    const j = Jalali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    dailySums[j.jd] = (dailySums[j.jd] || 0) + Number(t.amount_rial);
  });
  const maxDaily = Math.max(...Object.values(dailySums), 1);
  const firstOfMonthG = Jalali.toGregorian(selY, selM, 1);
  const firstWeekday = (new Date(firstOfMonthG.gy, firstOfMonthG.gm - 1, firstOfMonthG.gd).getDay() + 1) % 7; // align to Saturday-start week

  let calendarCells = '';
  for (let i = 0; i < firstWeekday; i++) calendarCells += '<div></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const amount = dailySums[day] || 0;
    const intensity = amount / maxDaily;
    const bg = amount === 0 ? 'var(--surface-2)' : `rgba(248,113,113,${0.15 + intensity * 0.7})`;
    const isToday = isCurrentMonth && day === nowJalali.jd;
    calendarCells += `<div class="cal-cell" style="background:${bg};${isToday ? 'border-color:var(--gold);border-width:2px' : ''}" title="${amount ? toman(amount) + ' ریال' : ''}">${day}</div>`;
  }

  // Comparison: last 6 Jalali months, expense vs income vs net
  const last6 = [];
  for (let i = 5; i >= 0; i--) {
    const { jy, jm } = shiftJalaliMonth(nowJalali.jy, nowJalali.jm, -i);
    const monthTxs = confirmed.filter((t) => inJalaliYM(new Date(t.created_at), jy, jm));
    const exp = monthTxs.filter((t) => t.direction === 'expense').reduce((s, t) => s + Number(t.amount_rial), 0);
    const inc = monthTxs.filter((t) => t.direction === 'income').reduce((s, t) => s + Number(t.amount_rial), 0);
    last6.push({ jy, jm, exp, inc, net: inc - exp });
  }
  const maxLast6 = Math.max(...last6.map((m) => Math.max(m.exp, m.inc)), 1);

  // Compare the selected month against the average of the 3/6 months before it
  const monthExpenseSum = (jy, jm) => confirmed
    .filter((t) => t.direction === 'expense' && inJalaliYM(new Date(t.created_at), jy, jm))
    .reduce((s, t) => s + Number(t.amount_rial), 0);
  const avgOfPriorMonths = (n) => {
    let sum = 0;
    for (let i = 1; i <= n; i++) {
      const m = shiftJalaliMonth(selY, selM, -i);
      sum += monthExpenseSum(m.jy, m.jm);
    }
    return sum / n;
  };
  const avg3 = avgOfPriorMonths(3);
  const avg6 = avgOfPriorMonths(6);
  const vsAvg3 = avg3 > 0 ? Math.round(((thisSum - avg3) / avg3) * 100) : null;
  const vsAvg6 = avg6 > 0 ? Math.round(((thisSum - avg6) / avg6) * 100) : null;

  // Biggest single expenses this month
  const biggestExpenses = [...thisMonthExpense].sort((a, b) => b.amount_rial - a.amount_rial).slice(0, 5);

  // Average daily spend and an end-of-month forecast (only meaningful for the current month)
  const daysElapsed = isCurrentMonth ? nowJalali.jd : daysInMonth;
  const avgDaily = daysElapsed > 0 ? thisSum / daysElapsed : 0;
  const forecastEndOfMonth = isCurrentMonth ? Math.round(avgDaily * daysInMonth) : null;

  // Runway: how many months the current cash lasts at the recent burn rate
  const burnRate3 = last6.slice(-3).reduce((s, m) => s + m.exp, 0) / 3;
  const runwayMonths = burnRate3 > 0 ? totalCash / burnRate3 : null;

  // Unusual expenses: this month's transactions that are well above their
  // category's historical average (needs at least 3 prior data points).
  const categoryStats = (catId) => {
    const amounts = confirmed
      .filter((t) => t.direction === 'expense' && t.category_id === catId && !inJalaliYM(new Date(t.created_at), selY, selM))
      .map((t) => Number(t.amount_rial));
    if (amounts.length < 3) return null;
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    return { mean, stdev: Math.sqrt(variance) };
  };
  const unusualExpenses = thisMonthExpense.filter((t) => {
    if (!t.category_id) return false;
    const stats = categoryStats(t.category_id);
    if (!stats) return false;
    const amount = Number(t.amount_rial);
    return amount > stats.mean + 1.5 * stats.stdev && amount > stats.mean * 1.5;
  }).sort((a, b) => b.amount_rial - a.amount_rial).slice(0, 5);

  // Transactions flagged as likely duplicates at ingestion time (still confirmed, this month)
  const thisMonthAll = confirmed.filter((t) => inJalaliYM(new Date(t.created_at), selY, selM));
  const duplicateFlagged = thisMonthAll.filter((t) => t.note && t.note.includes('تکراری'));

  // Likely recurring/subscription payments: same category+amount+direction showing up
  // in at least 3 of the last 4 months.
  const last4Months = [3, 2, 1, 0].map((i) => shiftJalaliMonth(nowJalali.jy, nowJalali.jm, -i));
  const recurringGroups = {};
  confirmed.filter((t) => t.direction === 'expense' && t.category_id).forEach((t) => {
    const d = new Date(t.created_at);
    const j = Jalali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const monthIndex = last4Months.findIndex((m) => m.jy === j.jy && m.jm === j.jm);
    if (monthIndex === -1) return;
    const key = `${t.category_id}:${t.amount_rial}`;
    recurringGroups[key] = recurringGroups[key] || { name: t.category_name, amount: Number(t.amount_rial), months: new Set() };
    recurringGroups[key].months.add(monthIndex);
  });
  const recurringPayments = Object.values(recurringGroups)
    .filter((g) => g.months.size >= 3)
    .sort((a, b) => b.amount - a.amount);

  // 90-day cash flow calendar: upcoming installment due dates (projected forward
  // month by month) and debts/receivables with a due date, merged and sorted.
  const CASH_FLOW_DAYS_AHEAD = 90;
  const upcomingEvents = [];
  installmentsAll.filter((i) => i.status === 'active').forEach((inst) => {
    for (let m = 0; m <= 4; m++) {
      const { jy, jm } = shiftJalaliMonth(nowJalali.jy, nowJalali.jm, m);
      const dim = Jalali.monthLength(jy, jm);
      const day = Math.min(inst.due_day_of_month, dim);
      const g = Jalali.toGregorian(jy, jm, day);
      const date = new Date(g.gy, g.gm - 1, g.gd);
      const diffDays = Math.round((date - now) / 86400000);
      if (diffDays >= 0 && diffDays <= CASH_FLOW_DAYS_AHEAD) {
        upcomingEvents.push({ date, diffDays, title: `قسط: ${inst.title}`, amount: Number(inst.installment_amount_rial), kind: 'installment' });
      }
    }
  });
  debtsAll.filter((d) => d.status === 'open' && d.due_date).forEach((d) => {
    const date = new Date(d.due_date);
    const diffDays = Math.round((date - now) / 86400000);
    if (diffDays >= 0 && diffDays <= CASH_FLOW_DAYS_AHEAD) {
      upcomingEvents.push({
        date, diffDays,
        title: `${d.type === 'i_owe' ? 'بدهی به' : 'طلب از'} ${d.person_name}`,
        amount: Number(d.amount_rial),
        kind: d.type === 'i_owe' ? 'debt_out' : 'debt_in',
      });
    }
  });
  upcomingEvents.sort((a, b) => a.date - b.date);
  const upcomingOutflow = upcomingEvents.filter((e) => e.kind !== 'debt_in').reduce((s, e) => s + e.amount, 0);
  const upcomingInflow = upcomingEvents.filter((e) => e.kind === 'debt_in').reduce((s, e) => s + e.amount, 0);

  content.innerHTML = `
    <div class="card">
      <div class="row">
        <button id="an-prev-month" class="action secondary" style="width:auto;padding:4px 12px">‹</button>
        <strong>${JALALI_MONTH_NAMES[selM - 1]} ${selY}</strong>
        <button id="an-next-month" class="action secondary" style="width:auto;padding:4px 12px" ${isCurrentMonth ? 'disabled' : ''}>›</button>
      </div>
      <div class="row" style="margin-top:8px">
        <span class="muted">هزینه نسبت به ماه قبل</span>
        ${trendPercent != null ? `<strong class="${trendPercent >= 0 ? 'trend-up' : 'trend-down'} font-num">${trendPercent >= 0 ? '▲' : '▼'} ${Math.abs(trendPercent)}٪</strong>` : '<span class="muted">داده‌ی ماه قبل نیست</span>'}
      </div>
      <div class="row" style="margin-top:4px">
        <span class="muted" style="font-size:.75rem">نسبت به میانگین ۳ ماه قبل</span>
        ${vsAvg3 != null ? `<strong class="${vsAvg3 >= 0 ? 'trend-up' : 'trend-down'} font-num" style="font-size:.85rem">${vsAvg3 >= 0 ? '▲' : '▼'} ${Math.abs(vsAvg3)}٪</strong>` : '<span class="muted" style="font-size:.75rem">داده کافی نیست</span>'}
      </div>
      <div class="row" style="margin-top:4px">
        <span class="muted" style="font-size:.75rem">نسبت به میانگین ۶ ماه قبل</span>
        ${vsAvg6 != null ? `<strong class="${vsAvg6 >= 0 ? 'trend-up' : 'trend-down'} font-num" style="font-size:.85rem">${vsAvg6 >= 0 ? '▲' : '▼'} ${Math.abs(vsAvg6)}٪</strong>` : '<span class="muted" style="font-size:.75rem">داده کافی نیست</span>'}
      </div>
      <div class="row muted font-num" style="margin-top:6px;font-size:.75rem">
        <span>این ماه: ${toman(thisSum)} ریال</span>
        <span>ماه قبل: ${toman(lastSum)} ریال</span>
      </div>
      ${isCurrentMonth ? `
        <div class="row muted font-num" style="margin-top:6px;font-size:.75rem;border-top:1px solid var(--border);padding-top:6px">
          <span>میانگین هزینه‌ی روزانه: ${toman(Math.round(avgDaily))} ریال</span>
          <span>پیش‌بینی پایان ماه: ${toman(forecastEndOfMonth)} ریال</span>
        </div>
      ` : ''}
    </div>

    <div class="card">
      <div class="row">
        <span class="muted">دوام موجودی فعلی با نرخ خرج اخیر</span>
      </div>
      <strong class="privacy-target font-num" style="font-size:1.1rem">${runwayMonths != null ? `${runwayMonths.toFixed(1)} ماه` : 'داده کافی نیست'}</strong>
      <div class="muted" style="font-size:.7rem;margin-top:4px">بر اساس میانگین هزینه‌ی ۳ ماه اخیر (${toman(Math.round(burnRate3))} ریال/ماه) و نقدینگی فعلی (${toman(totalCash)} ریال)</div>
    </div>

    <div class="card">
      <strong>تقویم تعهدات ۹۰ روز آینده</strong>
      <div class="row muted font-num" style="font-size:.7rem;margin-top:6px">
        <span>مجموع خروجی: <span style="color:var(--red)">${toman(upcomingOutflow)}</span></span>
        <span>مجموع ورودی: <span style="color:var(--green)">${toman(upcomingInflow)}</span></span>
      </div>
      ${upcomingEvents.length === 0 ? '<p class="muted" style="margin-top:8px">هیچ تعهد سررسیددار ثبت‌شده‌ای توی ۹۰ روز آینده نیست.</p>' : upcomingEvents.map((e) => `
        <div class="row" style="margin-top:8px;font-size:.75rem">
          <span>${e.title} · <span class="muted">${e.diffDays === 0 ? 'امروز' : `${e.diffDays} روز دیگه`}</span></span>
          <span class="font-num" style="color:${e.kind === 'debt_in' ? 'var(--green)' : 'var(--red)'}">${toman(e.amount)} ریال</span>
        </div>
      `).join('')}
    </div>

    ${(dataQuality.uncategorized.length + dataQuality.unparsed_sms.length + dataQuality.duplicate_flagged.length) > 0 ? `
      <div class="card" style="border-color:rgba(245,158,11,.4)">
        <strong>🔍 گزارش کیفیت داده</strong>
        ${dataQuality.uncategorized.length > 0 ? `<div class="row muted" style="margin-top:8px;font-size:.75rem"><span>تراکنش بدون دسته‌بندی</span><span class="font-num">${dataQuality.uncategorized.length}</span></div>` : ''}
        ${dataQuality.unparsed_sms.length > 0 ? `<div class="row muted" style="margin-top:6px;font-size:.75rem"><span>پیامک بانکی پارس‌نشده</span><span class="font-num">${dataQuality.unparsed_sms.length}</span></div>` : ''}
        ${dataQuality.duplicate_flagged.length > 0 ? `<div class="row muted" style="margin-top:6px;font-size:.75rem"><span>تراکنش مشکوک به تکراری</span><span class="font-num">${dataQuality.duplicate_flagged.length}</span></div>` : ''}
        ${dataQuality.unparsed_sms.length > 0 ? `
          <div style="margin-top:10px;border-top:1px solid var(--border-soft);padding-top:8px">
            ${dataQuality.unparsed_sms.slice(0, 5).map((s) => `
              <div class="row" style="font-size:.7rem;margin-top:6px;align-items:flex-start">
                <span class="muted" style="white-space:pre-line">${s.bank_code} · ${formatJalaliDateTime(new Date(s.created_at))}<br>${s.raw_text.slice(0, 60)}${s.raw_text.length > 60 ? '…' : ''}</span>
                <button class="action secondary" data-dismiss-unparsed="${s.id}" style="width:auto;padding:2px 8px;font-size:.65rem">رد کردن</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    ` : ''}

    ${biggestExpenses.length > 0 ? `
      <div class="card">
        <strong>بزرگ‌ترین هزینه‌های ماه</strong>
        ${biggestExpenses.map((t) => `
          <div class="row" style="margin-top:8px;font-size:.75rem">
            <span>${t.category_name || 'بدون دسته'} · <span class="muted">${formatJalaliDateTime(new Date(t.created_at))}</span></span>
            <span class="font-num" style="color:var(--red)">${toman(t.amount_rial)} ریال</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${unusualExpenses.length > 0 ? `
      <div class="card" style="border-color:rgba(245,158,11,.4)">
        <strong>⚠️ هزینه‌های غیرعادی این ماه</strong>
        <div class="muted" style="font-size:.7rem;margin-top:4px">به‌طور محسوسی بیشتر از میانگین همیشگی همون دسته</div>
        ${unusualExpenses.map((t) => `
          <div class="row" style="margin-top:8px;font-size:.75rem">
            <span>${t.category_name} · <span class="muted">${formatJalaliDateTime(new Date(t.created_at))}</span></span>
            <span class="font-num" style="color:#fbbf24">${toman(t.amount_rial)} ریال</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${recurringPayments.length > 0 ? `
      <div class="card">
        <strong>پرداخت‌های دوره‌ای احتمالی</strong>
        <div class="muted" style="font-size:.7rem;margin-top:4px">مبلغ ثابتی که حداقل ۳ ماه از ۴ ماه اخیر تکرار شده</div>
        ${recurringPayments.map((g) => `
          <div class="row" style="margin-top:8px;font-size:.75rem">
            <span>${g.name} · <span class="muted">${g.months.size} از ۴ ماه</span></span>
            <span class="font-num">${toman(g.amount)} ریال</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${duplicateFlagged.length > 0 ? `
      <div class="card" style="border-color:rgba(248,113,113,.4)">
        <strong>تراکنش‌های احتمالاً تکراری (${JALALI_MONTH_NAMES[selM - 1]})</strong>
        ${duplicateFlagged.map((t) => `
          <div class="row" style="margin-top:8px;font-size:.75rem">
            <span>${t.account_name} · <span class="muted">${formatJalaliDateTime(new Date(t.created_at))}</span></span>
            <span class="font-num">${toman(t.amount_rial)} ریال</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="card">
      <strong>روند رشد دارایی خالص</strong>
      ${netWorthChartSvg(netWorthHistory)}
    </div>

    <div class="card">
      <strong>مقایسه‌ی ۶ ماه اخیر (هزینه/درآمد)</strong>
      ${last6.map((m) => `
        <div style="margin-top:8px">
          <div class="row muted" style="font-size:.7rem"><span>${JALALI_MONTH_NAMES[m.jm - 1]} ${m.jy}</span><span class="font-num ${m.net >= 0 ? 'trend-up' : 'trend-down'}">خالص: ${toman(m.net)}</span></div>
          <div class="bar-row"><span style="font-size:.65rem;width:35px;flex-shrink:0;color:var(--red)">هزینه</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(m.exp / maxLast6 * 100)}%;background:var(--red)"></div></div><span class="font-num" style="font-size:.65rem;width:auto;flex-shrink:0">${toman(m.exp)}</span></div>
          <div class="bar-row"><span style="font-size:.65rem;width:35px;flex-shrink:0;color:var(--green)">درآمد</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(m.inc / maxLast6 * 100)}%;background:var(--green)"></div></div><span class="font-num" style="font-size:.65rem;width:auto;flex-shrink:0">${toman(m.inc)}</span></div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <strong>پرخرج‌ترین دسته‌ها (${JALALI_MONTH_NAMES[selM - 1]})</strong>
      ${topCategories.length === 0 ? '<p class="muted">هزینه‌ای ثبت نشده.</p>' : topCategories.map(([name, amount]) => `
        <div class="bar-row">
          <span style="font-size:.75rem;width:90px;flex-shrink:0">${name}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(amount / maxCategoryAmount * 100)}%"></div></div>
          <span class="font-num" style="font-size:.7rem;width:auto;flex-shrink:0">${toman(amount)} (${categoryShare(amount)}٪)</span>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <strong>هزینه به تفکیک روز هفته (${JALALI_MONTH_NAMES[selM - 1]})</strong>
      ${weekdayNames.map((name, i) => `
        <div class="weekday-bar-row">
          <span style="font-size:.7rem;width:55px;flex-shrink:0">${name}</span>
          <div class="weekday-bar-track"><div class="weekday-bar-fill" style="width:${Math.round(weekdaySums[i] / maxWeekday * 100)}%"></div></div>
          <span class="font-num" style="font-size:.65rem;width:auto;flex-shrink:0">${toman(weekdaySums[i])}</span>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <strong>تقویم هزینه (${JALALI_MONTH_NAMES[selM - 1]} ${selY})</strong>
      <div class="muted" style="font-size:.7rem;margin-top:4px">هرچه رنگ پررنگ‌تر، هزینه‌ی اون روز بیشتره</div>
      <div class="cal-grid">
        ${weekdayNames.map((n) => `<div class="muted" style="text-align:center;font-size:.6rem">${n[0]}</div>`).join('')}
        ${calendarCells}
      </div>
    </div>
  `;

  document.getElementById('an-prev-month').addEventListener('click', () => {
    analyticsMonth = shiftJalaliMonth(selY, selM, -1);
    renderAnalytics();
  });
  document.getElementById('an-next-month').addEventListener('click', () => {
    if (isCurrentMonth) return;
    analyticsMonth = shiftJalaliMonth(selY, selM, 1);
    renderAnalytics();
  });
  document.querySelectorAll('[data-dismiss-unparsed]').forEach((b) => {
    onClickLocked(b, async () => {
      await api(`/unparsed-sms/${b.dataset.dismissUnparsed}`, { method: 'DELETE' });
      renderAnalytics();
    });
  });
}

async function renderDebts() {
  const debts = await api('/debts');
  const iOwe = debts.filter((d) => d.type === 'i_owe');
  const owedToMe = debts.filter((d) => d.type === 'owed_to_me');

  const debtCard = (d) => `
    <div class="card">
      <div class="row">
        <strong>${d.person_name}</strong>
        <span class="badge ${d.status === 'settled' ? 'completed' : 'active'}">${d.status === 'settled' ? 'تسویه‌شده' : 'باز'}</span>
      </div>
      <div class="privacy-target font-num" style="margin-top:6px;font-size:1.1rem;font-weight:700">${toman(d.amount_rial)} ریال</div>
      ${d.due_date ? `<div class="muted font-num" style="margin-top:4px">سررسید: ${formatJalaliDate(new Date(d.due_date))}</div>` : ''}
      ${d.note ? `<div class="muted" style="margin-top:4px">${d.note}</div>` : ''}
      <div class="row" style="gap:8px;margin-top:10px">
        ${d.status === 'open' ? `<button class="action" data-settle="${d.id}" style="flex:1">✅ تسویه شد</button>` : ''}
        <button class="action secondary" data-edit-debt="${d.id}" style="width:auto">✎</button>
        <button class="action danger" data-delete-debt="${d.id}" style="width:auto">🗑</button>
      </div>
    </div>
  `;

  content.innerHTML = `
    <div class="card">
      <strong>ثبت بدهی/طلب جدید</strong>
      <select id="d-type">
        <option value="i_owe">من بدهکارم (باید بدم)</option>
        <option value="owed_to_me">طلب دارم (باید بگیرم)</option>
      </select>
      <input id="d-person" placeholder="نام شخص" />
      <input id="d-amount" type="text" inputmode="numeric" placeholder="مبلغ (ریال)" />
      <input id="d-due" type="date" placeholder="سررسید (اختیاری)" />
      <input id="d-note" placeholder="توضیح (اختیاری)" />
      <button class="action" id="d-add">ثبت</button>
    </div>
    <strong style="color:var(--red)">بدهی‌های من (${iOwe.length})</strong>
    ${iOwe.length ? iOwe.map(debtCard).join('') : '<p class="muted">چیزی ثبت نشده.</p>'}
    <strong style="color:var(--green);margin-top:10px;display:block">طلب‌های من (${owedToMe.length})</strong>
    ${owedToMe.length ? owedToMe.map(debtCard).join('') : '<p class="muted">چیزی ثبت نشده.</p>'}
  `;

  wireThousandsInput('d-amount');

  onClickLocked(document.getElementById('d-add'), async () => {
    const person_name = document.getElementById('d-person').value;
    const amountToman = numFromInput('d-amount');
    if (!person_name || !amountToman) return;
    await api('/debts', {
      method: 'POST',
      body: JSON.stringify({
        type: document.getElementById('d-type').value,
        person_name,
        amount_rial: amountToman,
        due_date: document.getElementById('d-due').value || null,
        note: document.getElementById('d-note').value || null,
      }),
    });
    renderDebts();
  });

  document.querySelectorAll('[data-settle]').forEach((b) => {
    onClickLocked(b, async () => {
      await api(`/debts/${b.dataset.settle}`, { method: 'PUT', body: JSON.stringify({ status: 'settled' }) });
      renderDebts();
    });
  });
  document.querySelectorAll('[data-delete-debt]').forEach((b) => {
    onClickLocked(b, async () => {
      if (!confirm('حذف شود؟ (قابل بازیابی از سطل بازیابی)')) return;
      await api(`/debts/${b.dataset.deleteDebt}`, { method: 'DELETE' });
      renderDebts();
    });
  });
  document.querySelectorAll('[data-edit-debt]').forEach((b) => {
    b.addEventListener('click', () => {
      openDebtEditModal(debts.find((d) => d.id === Number(b.dataset.editDebt)));
    });
  });
}

function openDebtEditModal(debt) {
  manualModal.innerHTML = `
    <div class="card">
      <strong>ویرایش بدهی/طلب</strong>
      <input id="ed-person" placeholder="نام شخص" value="${debt.person_name}" />
      <input id="ed-amount" type="text" inputmode="numeric" value="${toman(debt.amount_rial)}" />
      <input id="ed-due" type="date" value="${debt.due_date ? debt.due_date.slice(0, 10) : ''}" />
      <input id="ed-note" placeholder="توضیح (اختیاری)" value="${debt.note || ''}" />
      <button class="action" id="ed-save">ذخیره</button>
      <button class="action secondary" id="ed-cancel">انصراف</button>
    </div>
  `;
  manualModal.hidden = false;
  wireThousandsInput('ed-amount');
  document.getElementById('ed-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  onClickLocked(document.getElementById('ed-save'), async () => {
    await api(`/debts/${debt.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        person_name: document.getElementById('ed-person').value,
        amount_rial: numFromInput('ed-amount'),
        due_date: document.getElementById('ed-due').value || null,
        note: document.getElementById('ed-note').value || null,
      }),
    });
    manualModal.hidden = true;
    renderDebts();
  });
}

const REMINDER_MODULES = ['عمومی', 'قسط', 'بدهی و طلب', 'قبض', 'سایر'];

async function renderReminders() {
  const reminders = await api('/reminders');
  const pending = reminders.filter((r) => !r.sent);
  const sent = reminders.filter((r) => r.sent);

  const card = (r) => `
    <div class="card">
      <div class="row">
        <strong>${r.title}</strong>
        <span class="badge ${r.sent ? 'completed' : 'active'}">${r.module}</span>
      </div>
      <div class="muted font-num" style="margin-top:4px">${formatJalaliDateTime(new Date(r.remind_at))}</div>
      ${r.note ? `<div class="muted" style="margin-top:4px">${r.note}</div>` : ''}
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="action secondary" data-edit-reminder="${r.id}" style="width:auto">✎</button>
        <button class="action danger" data-delete-reminder="${r.id}" style="width:auto">🗑</button>
      </div>
    </div>
  `;

  content.innerHTML = `
    <div class="card">
      <strong>یادآوری جدید</strong>
      <select id="r-module">${REMINDER_MODULES.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>
      <input id="r-title" placeholder="عنوان یادآوری" />
      <input id="r-note" placeholder="توضیح (اختیاری)" />
      <div id="r-cal" style="margin-top:8px"></div>
      <input id="r-time" type="time" value="08:00" style="margin-top:8px" />
      <input id="r-date-iso" type="hidden" />
      <button class="action" id="r-add">ثبت یادآوری</button>
    </div>
    <strong>یادآوری‌های فعال (${pending.length})</strong>
    ${pending.length ? pending.map(card).join('') : '<p class="muted">چیزی ثبت نشده.</p>'}
    ${sent.length ? `<strong style="margin-top:10px;display:block">ارسال‌شده (${sent.length})</strong>${sent.map(card).join('')}` : ''}
  `;

  createJalaliCalendar('r-cal', 'r-date-iso');

  onClickLocked(document.getElementById('r-add'), async () => {
    const title = document.getElementById('r-title').value;
    if (!title) return;
    const dateIso = document.getElementById('r-date-iso').value;
    const time = document.getElementById('r-time').value || '08:00';
    const remind_at = new Date(`${dateIso}T${time}:00`).toISOString();
    await api('/reminders', {
      method: 'POST',
      body: JSON.stringify({
        module: document.getElementById('r-module').value,
        title,
        note: document.getElementById('r-note').value || null,
        remind_at,
      }),
    });
    renderReminders();
  });

  document.querySelectorAll('[data-delete-reminder]').forEach((b) => {
    onClickLocked(b, async () => {
      if (!confirm('حذف شود؟ (قابل بازیابی از سطل بازیابی)')) return;
      await api(`/reminders/${b.dataset.deleteReminder}`, { method: 'DELETE' });
      renderReminders();
    });
  });
  document.querySelectorAll('[data-edit-reminder]').forEach((b) => {
    b.addEventListener('click', () => {
      openReminderEditModal(reminders.find((r) => r.id === Number(b.dataset.editReminder)));
    });
  });
}

function openReminderEditModal(reminder) {
  const current = new Date(reminder.remind_at);
  manualModal.innerHTML = `
    <div class="card">
      <strong>ویرایش یادآوری</strong>
      <select id="er-module">${REMINDER_MODULES.map((m) => `<option value="${m}" ${m === reminder.module ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <input id="er-title" placeholder="عنوان یادآوری" value="${reminder.title}" />
      <input id="er-note" placeholder="توضیح (اختیاری)" value="${reminder.note || ''}" />
      <div id="er-cal" style="margin-top:8px"></div>
      <input id="er-time" type="time" value="${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}" style="margin-top:8px" />
      <input id="er-date-iso" type="hidden" />
      <button class="action" id="er-save">ذخیره</button>
      <button class="action secondary" id="er-cancel">انصراف</button>
    </div>
  `;
  manualModal.hidden = false;
  createJalaliCalendar('er-cal', 'er-date-iso', current);
  document.getElementById('er-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  onClickLocked(document.getElementById('er-save'), async () => {
    const dateIso = document.getElementById('er-date-iso').value;
    const time = document.getElementById('er-time').value || '08:00';
    await api(`/reminders/${reminder.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        module: document.getElementById('er-module').value,
        title: document.getElementById('er-title').value,
        note: document.getElementById('er-note').value || null,
        remind_at: new Date(`${dateIso}T${time}:00`).toISOString(),
      }),
    });
    manualModal.hidden = true;
    renderReminders();
  });
}

async function renderTrash() {
  const [txs, installments, debts, reminders] = await Promise.all([
    api('/transactions/trash'), api('/installments/trash'), api('/debts/trash'), api('/reminders/trash'),
  ]);

  const section = (title, items, restoreFn) => `
    <strong>${title} (${items.length})</strong>
    ${items.length === 0 ? '<p class="muted">چیزی توی سطل نیست.</p>' : items.map((item) => `
      <div class="card row">
        <span>${item.title || item.person_name || (item.amount_rial ? toman(item.amount_rial) + ' ریال' : 'مورد حذف‌شده')}</span>
        <button class="action secondary" data-restore="${item.id}" data-restore-fn="${restoreFn}" style="width:auto">↩️ بازیابی</button>
      </div>
    `).join('')}
  `;

  content.innerHTML = `
    <p class="muted">موارد حذف‌شده اینجان و قابل بازگردوندنن.</p>
    ${section('تراکنش‌های حذف‌شده', txs, 'transactions')}
    ${section('اقساط حذف‌شده', installments, 'installments')}
    ${section('بدهی/طلب حذف‌شده', debts, 'debts')}
    ${section('یادآوری‌های حذف‌شده', reminders, 'reminders')}
  `;

  document.querySelectorAll('[data-restore]').forEach((b) => {
    onClickLocked(b, async () => {
      await api(`/${b.dataset.restoreFn}/${b.dataset.restore}/restore`, { method: 'POST' });
      renderTrash();
    });
  });
}

// Manual transaction entry (fallback for when the automatic SMS webhook doesn't fire)
const fab = document.getElementById('fab');
const manualModal = document.getElementById('manual-modal');

async function openManualModal() {
  const [accounts, cats, debts, allTxs] = await Promise.all([api('/accounts'), api('/categories'), api('/debts'), api('/transactions')]);
  const histogram = buildAmountCategoryHistogram(allTxs);
  const accountOptions = accounts.map((a) => `<option value="${a.id}">${a.display_name}</option>`).join('');
  const renderCatOptions = (direction) => cats
    .filter((c) => c.direction === direction)
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join('');

  manualModal.innerHTML = `
    <div class="card">
      <strong>ثبت دستی تراکنش</strong>
      <select id="m-account">${accountOptions}</select>
      <select id="m-direction">
        <option value="expense">کسر از حساب</option>
        <option value="income">واریز به حساب</option>
      </select>
      <input id="m-amount" type="text" inputmode="numeric" placeholder="مبلغ (ریال)" />
      <select id="m-category">${renderCatOptions('expense')}</select>
      ${otherAccountFieldHtml('m', accounts, null)}
      ${loanPersonFieldHtml('m')}
      ${repayFieldHtml('m')}
      ${bankLoanFieldHtml('m')}
      <input id="m-note" placeholder="توضیح (اختیاری)" />
      <input id="m-tags" placeholder="تگ (اختیاری، با کاما جدا کن)" />
      <button class="action" id="m-save">ثبت</button>
      <button class="action secondary" id="m-cancel">انصراف</button>
    </div>
  `;
  manualModal.hidden = false;
  wireThousandsInput('m-amount');

  const updateRepayM = wireRepayField('m-category', () => document.getElementById('m-direction').value, 'repay-debt-m', cats, debts);
  const applySuggestionM = wireCategorySuggestion('m-amount', 'm-category', () => document.getElementById('m-direction').value, histogram);
  const updateLoanM = wireLoanField('m-category', 'm', cats, debts, () => document.getElementById('m-direction').value);
  document.getElementById('m-direction').addEventListener('change', (e) => {
    document.getElementById('m-category').innerHTML = renderCatOptions(e.target.value);
    updateRepayM();
    applySuggestionM();
    updateLoanM();
  });
  wireTransferField('m-category', 'other-account-m', cats);
  wireBankLoanField('m-category', 'bank-loan-m', cats);
  document.getElementById('m-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  onClickLocked(document.getElementById('m-save'), async () => {
    const account_id = document.getElementById('m-account').value;
    const direction = document.getElementById('m-direction').value;
    const amountToman = numFromInput('m-amount');
    const category_id = document.getElementById('m-category').value || null;
    let note = document.getElementById('m-note').value || null;
    const otherAccountSelect = document.getElementById('other-account-m');
    if (!otherAccountSelect.hidden && otherAccountSelect.value) {
      const otherAccount = accounts.find((a) => String(a.id) === otherAccountSelect.value);
      note = `حساب مقابل: ${otherAccount.display_name}${note ? ' — ' + note : ''}`;
    }
    if (!account_id || !amountToman) return;
    const tags = document.getElementById('m-tags').value || null;
    const accountName = accounts.find((a) => String(a.id) === account_id)?.display_name || '';
    await maybeCreateLoanDebt('m', direction, amountToman);
    await maybeRepayDebt('repay-debt-m', amountToman);
    await maybeCreateLoanInstallment('m', accountName, amountToman);
    await api('/transactions/manual', {
      method: 'POST',
      body: JSON.stringify({ account_id, amount_rial: amountToman, direction, category_id, note, tags }),
    });
    manualModal.hidden = true;
    const activeTab = [...tabButtons].find((b) => b.classList.contains('active'))?.dataset.tab;
    if (activeTab) render(activeTab);
  });
}

fab.addEventListener('click', openManualModal);
document.getElementById('nav-fab').addEventListener('click', openManualModal);

// SMS simulator: test the bank-SMS webhook/parser without needing a real text message
const smsModal = document.getElementById('sms-modal');
const SAMPLE_SMS = {
  resalat: '10.8124258.1\n-50,000\n06/28_12:00\nمانده: 259,153,041',
  blu: 'بلو\nبرداشت پول\nرضا عزیز، 50,000 ریال از حساب شما پرید.\nموجودی: 3,809,212 ریال\n۱۲:۰۰\n۱۴۰۵.۰۶.۲۸',
  pasargad: '239.8000.15190614.1\n-50,000\n06/28_12:00\nمانده: 6,276,366',
};

function openSmsModal() {
  smsModal.innerHTML = `
    <div class="card">
      <strong>شبیه‌ساز پیامک بانکی</strong>
      <div class="muted" style="margin-top:4px">برای تست پارسر و نوتیف، بدون نیاز به پیامک واقعی</div>
      <select id="s-bank">
        <option value="resalat">بانک رسالت</option>
        <option value="blu">بلو</option>
        <option value="pasargad">بانک پاسارگاد</option>
      </select>
      <textarea id="s-text" class="sms-text"></textarea>
      <button class="action" id="s-send">ارسال به وب‌هوک</button>
      <button class="action secondary" id="s-cancel">انصراف</button>
    </div>
  `;
  smsModal.hidden = false;
  const bankSelect = document.getElementById('s-bank');
  const textArea = document.getElementById('s-text');
  const fillSample = () => { textArea.value = SAMPLE_SMS[bankSelect.value]; };
  fillSample();
  bankSelect.addEventListener('change', fillSample);
  document.getElementById('s-cancel').addEventListener('click', () => { smsModal.hidden = true; });
  onClickLocked(document.getElementById('s-send'), async () => {
    await api(`/webhook/sms/${currentUser.api_key}`, {
      method: 'POST',
      body: JSON.stringify({ bank: bankSelect.value, text: textArea.value }),
    });
    smsModal.hidden = true;
    const activeTab = [...tabButtons].find((b) => b.classList.contains('active'))?.dataset.tab;
    if (activeTab) render(activeTab);
  });
}
document.getElementById('btn-sms-sim').addEventListener('click', openSmsModal);

// restore privacy mode preference
applyPrivacyMode(localStorage.getItem(PRIVACY_KEY) === '1');
applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');

async function bootstrapApp() {
  const authed = await checkAuth();
  if (!authed) { showAuthScreen('login'); return; }
  showApp();
  // deep link support: #/tx/123 -> open pending tab
  if (location.hash.startsWith('#/tx/')) {
    setActiveTab('pending');
  } else {
    setActiveTab('overview');
  }
}

bootstrapApp();
