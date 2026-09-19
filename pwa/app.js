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

async function api(path, opts) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error('request failed');
  return res.json();
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

const PRIVACY_KEY = 'pw-privacy-mode';
const btnPrivacy = document.getElementById('btn-privacy');
function applyPrivacyMode(on) {
  // CSS rule `body.privacy-on .privacy-target` handles the blur, so it applies
  // instantly to any content rendered later too — no re-query/flash on tab switch.
  document.body.classList.toggle('privacy-on', on);
  btnPrivacy.classList.toggle('active', on);
  btnPrivacy.textContent = on ? '🙈' : '🐵';
  btnPrivacy.title = on ? 'نمایش ارقام' : 'محو کردن ارقام';
}
btnPrivacy.addEventListener('click', () => {
  const on = !btnPrivacy.classList.contains('active');
  localStorage.setItem(PRIVACY_KEY, on ? '1' : '0');
  applyPrivacyMode(on);
});

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
    if (tab === 'trash') return renderTrash();
  } catch (e) {
    content.innerHTML = '<p class="muted">خطا در بارگذاری اطلاعات</p>';
  } finally {
    applyPrivacyMode(btnPrivacy.classList.contains('active'));
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
  const [accounts, pending, installments, transactions, investments, categories] = await Promise.all([
    api('/accounts'), api('/transactions?status=pending'), api('/installments'), api('/transactions'),
    api('/investments'), api('/categories'),
  ]);

  const totalCash = accounts.reduce((sum, a) => sum + Number(a.balance_rial), 0);
  const totalInvestments = investments.reduce((sum, v) => sum + Number(v.current_value_rial), 0);
  const activeInstallments = installments.filter((i) => i.status === 'active');
  const remainingDebt = activeInstallments.reduce(
    (sum, i) => sum + i.installment_amount_rial * (i.total_count - i.paid_count), 0
  );
  const netWorth = totalCash + totalInvestments - remainingDebt;
  const now = new Date();
  const thisMonthTx = transactions.filter((t) => {
    const d = new Date(t.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && t.status === 'confirmed';
  });
  // Transfers between own accounts are neither real income nor real expense.
  const realFlowTx = thisMonthTx.filter((t) => t.category_name !== TRANSFER_CATEGORY_NAME);
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
    <div class="card" style="text-align:center">
      <div class="muted">دارایی خالص شما</div>
      <div class="privacy-target font-num" style="font-size:1.6rem;font-weight:800;margin-top:6px">${toman(netWorth)} <span class="muted" style="font-size:.8rem">ریال</span></div>
    </div>
    <div class="metric-grid" style="grid-template-columns:1fr 1fr 1fr">
      <div class="metric-card" style="background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.25)">
        <div class="metric-label" style="font-size:.7rem">بدهی</div>
        <div class="privacy-target font-num" style="color:var(--red);font-weight:700;margin-top:4px">${toman(remainingDebt)}</div>
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
  document.getElementById('header-networth').textContent = toman(netWorth);
  wireCopyFields();
  const gotoBtn = document.getElementById('goto-pending');
  if (gotoBtn) gotoBtn.addEventListener('click', () => setActiveTab('pending'));
  document.getElementById('goto-accounts')?.addEventListener('click', () => setActiveTab('accounts'));
  document.getElementById('goto-installments')?.addEventListener('click', () => setActiveTab('installments'));
}

async function renderPending() {
  const [txs, cats, accounts] = await Promise.all([
    api('/transactions?status=pending'), api('/categories'), api('/accounts'),
  ]);
  if (txs.length === 0) {
    content.innerHTML = '<p class="muted">تراکنش در انتظاری وجود ندارد.</p>';
    return;
  }
  content.innerHTML = txs.map((t) => txCard(t, cats, true, accounts)).join('');
  txs.forEach((t) => wireTxCard(t, cats, accounts));
}

const TRANSFER_CATEGORY_NAME = 'انتقال وجه بین حساب';

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
          <span class="muted">${new Date(t.created_at).toLocaleString('fa-IR')}</span>
        </div>
        <div class="row">
          <div class="muted">${t.account_name} · ${t.category_name || 'بدون دسته'}${t.note ? ' · ' + t.note : ''}${t.tags ? ' · 🏷 ' + t.tags : ''}</div>
          <button class="action secondary" data-edit-tx="${t.id}" style="width:auto;padding:4px 10px;margin:0">✎</button>
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
  const [accounts, cats] = await Promise.all([api('/accounts'), api('/categories')]);
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
      <input id="e-note" placeholder="توضیح" value="${t.note || ''}" />
      <input id="e-tags" placeholder="تگ (با کاما جدا کن)" value="${t.tags || ''}" />
      <button class="action" id="e-save">ذخیره</button>
      <button class="action secondary" id="e-cancel">انصراف</button>
    </div>
  `;
  manualModal.hidden = false;
  wireThousandsInput('e-amount');

  document.getElementById('e-direction').addEventListener('change', (e) => {
    document.getElementById('e-category').innerHTML = renderCatOptions(e.target.value);
  });
  document.getElementById('e-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  document.getElementById('e-save').addEventListener('click', async () => {
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
        <span class="${t.direction === 'income' ? 'amount-income' : 'amount-expense'}">
          ${t.direction === 'income' ? '+' : '-'}${toman(t.amount_rial)} ریال
        </span>
        <span class="muted">${t.account_name}</span>
      </div>
      <div class="muted">موجودی بعد از تراکنش: <span class="privacy-target font-num">${t.balance_after_rial != null ? toman(t.balance_after_rial) + ' ریال' : '-'}</span></div>
      ${t.note && t.note.includes('احتمالاً تکراری') ? `<div style="color:var(--red);font-size:.75rem;margin-top:4px">⚠️ ${t.note}</div>` : ''}
      ${editable ? `
        <select id="cat-${t.id}"><option value="">انتخاب دسته‌بندی...</option>${options}</select>
        ${otherAccountFieldHtml(t.id, accounts, t.account_id)}
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

function wireTxCard(t, cats, accounts) {
  const btn = document.getElementById(`confirm-${t.id}`);
  if (!btn) return;
  wireTransferField(`cat-${t.id}`, `other-account-${t.id}`, cats);
  btn.addEventListener('click', async () => {
    const category_id = document.getElementById(`cat-${t.id}`).value || null;
    let note = document.getElementById(`note-${t.id}`).value || null;
    const otherAccountSelect = document.getElementById(`other-account-${t.id}`);
    if (!otherAccountSelect.hidden && otherAccountSelect.value) {
      const otherAccount = accounts.find((a) => String(a.id) === otherAccountSelect.value);
      note = `حساب مقابل: ${otherAccount.display_name}${note ? ' — ' + note : ''}`;
    }
    const tags = document.getElementById(`tags-${t.id}`).value || null;
    await api(`/transactions/${t.id}/confirm`, { method: 'POST', body: JSON.stringify({ category_id, note, tags }) });
    document.getElementById(`tx-${t.id}`).remove();
  });
  document.getElementById(`delete-${t.id}`).addEventListener('click', async () => {
    if (!confirm('این تراکنش حذف شود؟ موجودی حساب به حالت قبل برمی‌گردد.')) return;
    await api(`/transactions/${t.id}`, { method: 'DELETE' });
    document.getElementById(`tx-${t.id}`).remove();
    updatePendingBadge();
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
    el.addEventListener('click', async () => {
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
        <button data-edit-acc="${a.id}" style="background:rgba(255,255,255,.15);border:none;color:white;border-radius:8px;padding:4px 8px;font-family:inherit;font-size:.7rem;cursor:pointer">✎ ویرایش</button>
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
  document.getElementById('acc-save').addEventListener('click', async () => {
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

  document.getElementById('i-add').addEventListener('click', async () => {
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
    b.addEventListener('click', async () => {
      if (!confirm('پرداخت این قسط ثبت شود؟ این عملیات قابل بازگشت نیست.')) return;
      await api(`/installments/${b.dataset.pay}/pay`, { method: 'POST' });
      renderInstallments();
    });
  });

  document.querySelectorAll('[data-delete-inst]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!confirm('این قسط/وام کاملاً حذف شود؟')) return;
      await api(`/installments/${b.dataset.deleteInst}`, { method: 'DELETE' });
      renderInstallments();
    });
  });

  document.querySelectorAll('[data-edit-inst]').forEach((b) => {
    b.addEventListener('click', async () => {
      const item = items.find((i) => i.id === Number(b.dataset.editInst));
      const newTitle = prompt('عنوان:', item.title);
      if (newTitle == null) return;
      const newAmount = prompt('مبلغ هر قسط (ریال):', toman(item.installment_amount_rial));
      if (newAmount == null) return;
      const newCount = prompt('تعداد کل اقساط:', item.total_count);
      if (newCount == null) return;
      const newDay = prompt('روز موعد در ماه:', item.due_day_of_month);
      if (newDay == null) return;
      await api(`/installments/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: newTitle,
          installment_amount_rial: Number(newAmount.replace(/,/g, '')),
          total_count: Number(newCount),
          due_day_of_month: Number(newDay),
        }),
      });
      renderInstallments();
    });
  });
}

async function renderInvestments() {
  const items = await api('/investments');
  const totalInvested = items.reduce((s, v) => s + Number(v.invested_amount_rial), 0);
  const totalCurrent = items.reduce((s, v) => s + Number(v.current_value_rial), 0);
  const totalGain = totalCurrent - totalInvested;

  content.innerHTML = `
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
        <span class="badge ${gainPercent >= 0 ? 'gain' : 'loss'}">${gainPercent >= 0 ? '+' : ''}${gainPercent}%</span>
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

  const vType = document.getElementById('v-type');
  const vQtyFields = document.getElementById('v-qty-fields');
  const vAmount = document.getElementById('v-amount');
  vType.addEventListener('change', () => {
    const isOther = vType.value === 'other';
    vQtyFields.hidden = isOther;
    vAmount.hidden = !isOther;
  });

  document.getElementById('v-add').addEventListener('click', async () => {
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
    b.addEventListener('click', async () => {
      const id = b.dataset.updatePrice;
      const current_unit_price_rial = numFromInput(`v-cur-price-${id}`);
      await api(`/investments/${id}`, { method: 'PUT', body: JSON.stringify({ current_unit_price_rial }) });
      renderInvestments();
    });
  });

  document.querySelectorAll('[data-update]').forEach((b) => {
    b.addEventListener('click', async () => {
      const id = b.dataset.update;
      const val = numFromInput(`v-cur-${id}`);
      await api(`/investments/${id}`, { method: 'PUT', body: JSON.stringify({ current_value_rial: val }) });
      renderInvestments();
    });
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

  document.getElementById('c-add').addEventListener('click', async () => {
    const name = document.getElementById('c-name').value;
    const direction = document.getElementById('c-dir').value;
    if (!name) return;
    await api('/categories', { method: 'POST', body: JSON.stringify({ name, direction }) });
    renderCategories();
  });

  document.querySelectorAll('[data-edit]').forEach((b) => {
    b.addEventListener('click', async () => {
      const newName = prompt('نام جدید:', b.dataset.name);
      if (!newName) return;
      await api(`/categories/${b.dataset.edit}`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
      renderCategories();
    });
  });
}

async function renderAnalytics() {
  const [txs, categories] = await Promise.all([api('/transactions'), api('/categories')]);
  const confirmed = txs.filter((t) => t.status === 'confirmed' && t.category_name !== TRANSFER_CATEGORY_NAME);

  const now = new Date();
  const nowJalali = Jalali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const inJalaliMonth = (d, monthsAgo) => {
    const j = Jalali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    let ty = nowJalali.jy, tm = nowJalali.jm - monthsAgo;
    while (tm < 1) { tm += 12; ty -= 1; }
    return j.jy === ty && j.jm === tm;
  };
  const thisMonthExpense = confirmed.filter((t) => t.direction === 'expense' && inJalaliMonth(new Date(t.created_at), 0));
  const lastMonthExpense = confirmed.filter((t) => t.direction === 'expense' && inJalaliMonth(new Date(t.created_at), 1));
  const thisSum = thisMonthExpense.reduce((s, t) => s + Number(t.amount_rial), 0);
  const lastSum = lastMonthExpense.reduce((s, t) => s + Number(t.amount_rial), 0);
  const trendPercent = lastSum > 0 ? Math.round(((thisSum - lastSum) / lastSum) * 100) : null;

  // Top spending categories this month
  const byCategory = {};
  thisMonthExpense.forEach((t) => {
    const name = t.category_name || 'بدون دسته';
    byCategory[name] = (byCategory[name] || 0) + Number(t.amount_rial);
  });
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCategoryAmount = topCategories[0]?.[1] || 1;

  // Weekday heatmap (Saturday..Friday), this month
  const weekdayNames = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const weekdaySums = [0, 0, 0, 0, 0, 0, 0];
  thisMonthExpense.forEach((t) => {
    const jsDay = new Date(t.created_at).getDay(); // 0=Sun..6=Sat
    const persianIndex = (jsDay + 1) % 7; // shift so Saturday=0
    weekdaySums[persianIndex] += Number(t.amount_rial);
  });
  const maxWeekday = Math.max(...weekdaySums, 1);

  // Calendar heatmap for this Jalali month
  const daysInMonth = Jalali.monthLength(nowJalali.jy, nowJalali.jm);
  const dailySums = {};
  thisMonthExpense.forEach((t) => {
    const d = new Date(t.created_at);
    const j = Jalali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    dailySums[j.jd] = (dailySums[j.jd] || 0) + Number(t.amount_rial);
  });
  const maxDaily = Math.max(...Object.values(dailySums), 1);
  const firstOfMonthG = Jalali.toGregorian(nowJalali.jy, nowJalali.jm, 1);
  const firstWeekday = (new Date(firstOfMonthG.gy, firstOfMonthG.gm - 1, firstOfMonthG.gd).getDay() + 1) % 7; // align to Saturday-start week

  let calendarCells = '';
  for (let i = 0; i < firstWeekday; i++) calendarCells += '<div></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const amount = dailySums[day] || 0;
    const intensity = amount / maxDaily;
    const bg = amount === 0 ? 'var(--surface-2)' : `rgba(248,113,113,${0.15 + intensity * 0.7})`;
    const isToday = day === nowJalali.jd;
    calendarCells += `<div class="cal-cell" style="background:${bg};${isToday ? 'border-color:var(--gold);border-width:2px' : ''}" title="${amount ? toman(amount) + ' ریال' : ''}">${day}</div>`;
  }

  content.innerHTML = `
    <div class="card">
      <div class="row">
        <span class="muted">هزینه این ماه نسبت به ماه قبل</span>
        ${trendPercent != null ? `<strong class="${trendPercent >= 0 ? 'trend-up' : 'trend-down'} font-num">${trendPercent >= 0 ? '▲' : '▼'} ${Math.abs(trendPercent)}٪</strong>` : '<span class="muted">داده‌ی ماه قبل نیست</span>'}
      </div>
      <div class="row muted font-num" style="margin-top:6px;font-size:.75rem">
        <span>این ماه: ${toman(thisSum)} ریال</span>
        <span>ماه قبل: ${toman(lastSum)} ریال</span>
      </div>
    </div>

    <div class="card">
      <strong>پرخرج‌ترین دسته‌ها (این ماه)</strong>
      ${topCategories.length === 0 ? '<p class="muted">هزینه‌ای ثبت نشده.</p>' : topCategories.map(([name, amount]) => `
        <div class="bar-row">
          <span style="font-size:.75rem;width:90px;flex-shrink:0">${name}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(amount / maxCategoryAmount * 100)}%"></div></div>
          <span class="font-num" style="font-size:.7rem;width:auto;flex-shrink:0">${toman(amount)}</span>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <strong>هزینه به تفکیک روز هفته (این ماه)</strong>
      ${weekdayNames.map((name, i) => `
        <div class="weekday-bar-row">
          <span style="font-size:.7rem;width:55px;flex-shrink:0">${name}</span>
          <div class="weekday-bar-track"><div class="weekday-bar-fill" style="width:${Math.round(weekdaySums[i] / maxWeekday * 100)}%"></div></div>
          <span class="font-num" style="font-size:.65rem;width:auto;flex-shrink:0">${toman(weekdaySums[i])}</span>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <strong>تقویم هزینه (${JALALI_MONTH_NAMES[nowJalali.jm - 1]} ${nowJalali.jy})</strong>
      <div class="muted" style="font-size:.7rem;margin-top:4px">هرچه رنگ پررنگ‌تر، هزینه‌ی اون روز بیشتره</div>
      <div class="cal-grid">
        ${weekdayNames.map((n) => `<div class="muted" style="text-align:center;font-size:.6rem">${n[0]}</div>`).join('')}
        ${calendarCells}
      </div>
    </div>
  `;
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
      ${d.due_date ? `<div class="muted font-num" style="margin-top:4px">سررسید: ${new Date(d.due_date).toLocaleDateString('fa-IR')}</div>` : ''}
      ${d.note ? `<div class="muted" style="margin-top:4px">${d.note}</div>` : ''}
      <div class="row" style="gap:8px;margin-top:10px">
        ${d.status === 'open' ? `<button class="action" data-settle="${d.id}" style="flex:1">✅ تسویه شد</button>` : ''}
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

  document.getElementById('d-add').addEventListener('click', async () => {
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
    b.addEventListener('click', async () => {
      await api(`/debts/${b.dataset.settle}`, { method: 'PUT', body: JSON.stringify({ status: 'settled' }) });
      renderDebts();
    });
  });
  document.querySelectorAll('[data-delete-debt]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!confirm('حذف شود؟ (قابل بازیابی از سطل بازیابی)')) return;
      await api(`/debts/${b.dataset.deleteDebt}`, { method: 'DELETE' });
      renderDebts();
    });
  });
}

async function renderTrash() {
  const [txs, installments, debts] = await Promise.all([
    api('/transactions/trash'), api('/installments/trash'), api('/debts/trash'),
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
  `;

  document.querySelectorAll('[data-restore]').forEach((b) => {
    b.addEventListener('click', async () => {
      await api(`/${b.dataset.restoreFn}/${b.dataset.restore}/restore`, { method: 'POST' });
      renderTrash();
    });
  });
}

// Manual transaction entry (fallback for when the automatic SMS webhook doesn't fire)
const fab = document.getElementById('fab');
const manualModal = document.getElementById('manual-modal');

async function openManualModal() {
  const [accounts, cats] = await Promise.all([api('/accounts'), api('/categories')]);
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
      <input id="m-note" placeholder="توضیح (اختیاری)" />
      <input id="m-tags" placeholder="تگ (اختیاری، با کاما جدا کن)" />
      <button class="action" id="m-save">ثبت</button>
      <button class="action secondary" id="m-cancel">انصراف</button>
    </div>
  `;
  manualModal.hidden = false;
  wireThousandsInput('m-amount');

  document.getElementById('m-direction').addEventListener('change', (e) => {
    document.getElementById('m-category').innerHTML = renderCatOptions(e.target.value);
  });
  wireTransferField('m-category', 'other-account-m', cats);
  document.getElementById('m-cancel').addEventListener('click', () => { manualModal.hidden = true; });
  document.getElementById('m-save').addEventListener('click', async () => {
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
  document.getElementById('s-send').addEventListener('click', async () => {
    await api('/webhook/sms', {
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

// deep link support: #/tx/123 -> open pending tab
if (location.hash.startsWith('#/tx/')) {
  setActiveTab('pending');
} else {
  setActiveTab('overview');
}
