// Creates (or resets) a username-login demo account filled with ~4 months of
// realistic sample data: accounts, a few hundred transactions (nearly every day has
// spending, so the calendar heatmap is full), installments, debts, investments,
// reminders and net-worth history.
//
// Usage (inside the api container):
//   node scripts/seed-demo.js <username> <password>   create the account (or reset it and its password)
//   node scripts/seed-demo.js <username>              reset an existing account's data, keeping its password
//
// It refuses to touch an account that has a phone number or Google login, so it
// can't wipe a real user.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { DEFAULT_CATEGORIES } = require('../src/defaults');
const { getMarketPrices, unitPriceRial } = require('../src/assets');

const [username, password] = process.argv.slice(2);
if (!username || (password != null && password.length < 6)) {
  console.error('usage: node scripts/seed-demo.js <username> [password (6+ chars)]');
  process.exit(1);
}

const DEMO_DAYS = 120;

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();

// Deterministic randomness so every reset produces the same demo.
let seed = 1405;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max, step = 10000) => Math.round((min + rand() * (max - min)) / step) * step;
function daysAgo(days, hour = 9 + Math.floor(rand() * 13)) {
  const d = new Date(now.getTime() - days * DAY);
  d.setHours(hour, Math.floor(rand() * 60), 0, 0);
  return d > now ? new Date(now.getTime() - 60 * 1000) : d;
}

const ACCOUNTS = [
  { key: 'mellat', bank_code: 'demo-mellat', display_name: 'بانک ملت', start: 520000000, card_number: '6104330000001234', low: 50000000 },
  { key: 'saman', bank_code: 'demo-saman', display_name: 'بانک سامان', start: 160000000, card_number: '6219860000005678', low: null },
  { key: 'blu', bank_code: 'demo-blu', display_name: 'بلو', start: 45000000, card_number: '6219861900004321', low: 10000000 },
  { key: 'cash', bank_code: 'demo-cash', display_name: 'پول نقد', start: 15000000, card_number: null, low: null },
];

// paid = installments already paid before the demo window; the monthly payments
// inside the window are added on top.
const INSTALLMENTS = [
  { key: 'car', title: 'وام خودرو', type: 'loan', amount: 12500000, total: 36, paidBefore: 13, due: 5, note: 'وام بانک ملت' },
  { key: 'phone', title: 'قسط گوشی', type: 'installment', amount: 4800000, total: 12, paidBefore: 5, due: 12, note: null },
  { key: 'laptop', title: 'قسط لپ‌تاپ', type: 'installment', amount: 9000000, total: 6, paidBefore: 6, due: 20, note: 'تسویه شده' },
];
const MONTH_STARTS = [118, 88, 58, 28];

const EVERYDAY = [
  { weight: 9, category: 'خوراکی', account: ['blu', 'saman', 'cash'], min: 600000, max: 5500000, notes: ['خرید سوپرمارکت', 'میوه و تره‌بار', 'نون و لبنیات', 'خرید هفتگی', 'هایپرمارکت'] },
  { weight: 6, category: 'غذا', account: ['blu', 'saman'], min: 1200000, max: 6500000, notes: ['رستوران', 'سفارش آنلاین غذا', 'کافه با دوستان', 'ناهار بیرون'] },
  { weight: 7, category: 'رفت و آمد', account: ['blu', 'cash'], min: 200000, max: 1500000, notes: ['اسنپ', 'تپسی', 'بلیت مترو', 'پارکینگ'] },
  { weight: 2, category: 'خرید', account: ['mellat', 'saman'], min: 3000000, max: 22000000, notes: ['لباس', 'لوازم خانه', 'کفش', 'لوازم آشپزخانه'] },
  { weight: 1, category: 'درمان و سلامت', account: ['mellat'], min: 2000000, max: 11000000, notes: ['ویزیت پزشک', 'داروخانه', 'دندان‌پزشکی'] },
  { weight: 2, category: 'تفریح', account: ['blu', 'cash'], min: 900000, max: 5500000, notes: ['سینما', 'بلیت کنسرت', 'کتاب‌فروشی', 'بازی'] },
  { weight: 1, category: 'آرایشگاه', account: ['cash'], min: 1500000, max: 3000000, notes: ['آرایشگاه'] },
  { weight: 2, category: 'وسیله نقلیه', account: ['mellat'], min: 1200000, max: 8000000, notes: ['بنزین', 'کارواش', 'سرویس ماشین'] },
  { weight: 1, category: 'هدیه', account: ['mellat'], min: 3000000, max: 14000000, notes: ['هدیه تولد', 'کادوی عروسی'] },
  { weight: 1, category: 'خانواده', account: ['mellat'], min: 4000000, max: 18000000, notes: ['کمک به خانواده', 'خرید برای مامان'] },
  { weight: 1, category: 'توسعه شخصی', account: ['saman'], min: 3000000, max: 16000000, notes: ['دوره آنلاین', 'کتاب', 'اشتراک نرم‌افزار'] },
  { weight: 1, category: 'شخصی', account: ['blu', 'cash'], min: 500000, max: 4000000, notes: ['لوازم شخصی', 'عطر'] },
];

function buildTransactions() {
  const tx = [];
  const add = (days, account, direction, category, amount, note, extra = {}) =>
    tx.push({ at: daysAgo(days, extra.hour), account, direction, category, amount, note, ...extra });
  const transfer = (days, from, to, amount, fromName, toName) => {
    const hour = 10 + Math.floor(rand() * 8);
    add(days, from, 'expense', 'انتقال وجه بین حساب', amount, `حساب مقابل: ${toName}`, { hour });
    add(days, to, 'income', 'انتقال وجه بین حساب', amount, `حساب مقابل: ${fromName}`, { hour });
  };

  // Monthly rhythm: salary, rent, installments, bills, topping up the everyday accounts.
  MONTH_STARTS.forEach((m) => {
    add(m, 'mellat', 'income', 'درآمد کار', 480000000, 'حقوق ماهانه', { hour: 9 });
    add(m - 2, 'mellat', 'expense', 'قبوض و خانه', 180000000, 'اجاره خانه');
    add(m - 6, 'mellat', 'expense', 'قسط', 12500000, 'قسط وام خودرو', { installment: 'car' });
    add(m - 10, 'saman', 'expense', 'قسط', 4800000, 'قسط گوشی', { installment: 'phone' });
    add(m - 14, 'saman', 'expense', 'قبوض و خانه', 2400000, 'اینترنت خانه');
    add(m - 18, 'mellat', 'expense', 'قبوض و خانه', between(3000000, 6500000), 'قبض برق و گاز');
    add(m - 22, 'saman', 'expense', 'قبوض و خانه', between(900000, 1600000), 'قبض موبایل');
    transfer(m - 1, 'mellat', 'blu', 50000000, 'بانک ملت', 'بلو');
    transfer(m - 15, 'mellat', 'blu', 30000000, 'بانک ملت', 'بلو');
    transfer(m - 3, 'mellat', 'cash', 40000000, 'بانک ملت', 'پول نقد');
    transfer(m - 17, 'mellat', 'cash', 20000000, 'بانک ملت', 'پول نقد');
  });
  [104, 71, 41, 13].forEach((d) => add(d, 'saman', 'income', 'درآمد شخصی', between(70000000, 140000000, 1000000), 'پروژه فریلنس'));
  [90, 60, 30].forEach((d) => add(d, 'mellat', 'income', 'سود سرمایه‌گذاری', between(9000000, 11000000), 'سود صندوق درآمد ثابت'));
  add(61, 'mellat', 'expense', 'قرض', 30000000, 'قرض به علی');
  add(19, 'mellat', 'income', 'تسویه طلب', 10000000, 'علی بخشی از قرض رو برگردوند');
  add(47, 'saman', 'income', 'درآمد شخصی', 12000000, 'فروش لوازم دست دوم');

  // Everyday spending: nearly every day has 1–3 purchases, so the calendar heatmap is full.
  const pool = EVERYDAY.flatMap((e) => Array(e.weight).fill(e));
  for (let d = DEMO_DAYS - 1; d >= 1; d--) {
    const r = rand();
    const count = r < 0.08 ? 0 : r < 0.5 ? 1 : r < 0.85 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const e = pick(pool);
      add(d, pick(e.account), 'expense', e.category, between(e.min, e.max), pick(e.notes), { tags: rand() < 0.15 ? 'ضروری' : null });
    }
  }

  // Unreviewed bank SMS, as they'd arrive from the webhook -- these fill the "در انتظار" tab.
  const pending = [
    { days: 1, account: 'mellat', amount: 3750000, text: 'بانک ملت\nبرداشت: 3,750,000 ریال\nکارت: 1234' },
    { days: 1, account: 'saman', amount: 1180000, text: 'برداشت پل:-1,180,000\nحساب:1529004' },
    { days: 1, account: 'blu', amount: 640000, text: 'بلو\nرضا عزیز، 640,000 ریال از حساب شما پرید.' },
    { days: 0, account: 'mellat', amount: 12500000, text: 'بانک ملت\nبرداشت: 12,500,000 ریال\nکارت: 1234' },
    { days: 0, account: 'blu', amount: 2150000, text: 'بلو\nرضا عزیز، 2,150,000 ریال بابت خرید از حساب شما پرید.' },
    { days: 0, account: 'saman', amount: 25000000, direction: 'income', text: 'واریز:+25,000,000\nحساب:1529004' },
    { days: 3, account: 'blu', amount: 890000, text: 'بلو\nرضا عزیز، 890,000 ریال بابت خرید از حساب شما پرید.' },
    { days: 3, account: 'mellat', amount: 4600000, text: 'بانک ملت\nخرید: 4,600,000 ریال\nکارت: 1234' },
    { days: 2, account: 'saman', amount: 2300000, text: 'برداشت پل:-2,300,000\nحساب:1529004' },
    { days: 2, account: 'blu', amount: 15000000, direction: 'income', text: 'واریز پول\nرضا عزیز، 15,000,000 ریال به حساب شما نشست.' },
    { days: 2, account: 'mellat', amount: 12500000, text: 'بانک ملت\nپرداخت: 12,500,000 ریال\nکارت: 1234' },
    { days: 1, account: 'blu', amount: 380000, text: 'بلو\nرضا عزیز، 380,000 ریال از حساب شما پرید.' },
    { days: 1, account: 'mellat', amount: 7200000, text: 'بانک ملت\nبرداشت: 7,200,000 ریال\nکارت: 1234' },
    { days: 1, account: 'saman', amount: 1650000, text: 'برداشت پل:-1,650,000\nحساب:1529004' },
    { days: 0, account: 'blu', amount: 4800000, text: 'بلو\nرضا عزیز، 4,800,000 ریال از حساب شما پرید.' },
    { days: 0, account: 'mellat', amount: 950000, text: 'بانک ملت\nخرید: 950,000 ریال\nکارت: 1234' },
  ];
  pending.forEach((p) => tx.push({
    at: daysAgo(p.days, p.days === 0 ? 9 : 18), account: p.account, direction: p.direction || 'expense',
    amount: p.amount, pending: true, raw_text: p.text,
  }));

  return tx.sort((a, b) => a.at - b.at);
}

const INVESTMENTS = [
  { symbol: 'IR_COIN_EMAMI', title: 'سکه تمام امامی', asset_type: 'coin', qty: 1, fallback: 2450000000 },
  { symbol: 'IR_COIN_HALF', title: 'نیم سکه', asset_type: 'coin', qty: 2, fallback: 1250000000 },
  { symbol: 'IR_COIN_QUARTER', title: 'ربع سکه', asset_type: 'coin', qty: 3, fallback: 680000000 },
  { symbol: 'IR_COIN_1G', title: 'سکه یک گرمی', asset_type: 'coin', qty: 5, fallback: 350000000 },
  { symbol: 'IR_GOLD_18K', title: 'طلای ۱۸ عیار', asset_type: 'gold', qty: 12.5, fallback: 245000000 },
  { symbol: 'USD', title: 'دلار آمریکا', asset_type: 'dollar', qty: 450, fallback: 2500000 },
  { symbol: 'EUR', title: 'یورو', asset_type: 'dollar', qty: 200, fallback: 2850000 },
  { symbol: 'USDT_IRT', title: 'تتر', asset_type: 'other', qty: 300, fallback: 2520000 },
];

async function main() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  let prices = null;
  try { prices = await getMarketPrices({ force: true }); } catch (err) { console.warn('market prices unavailable, using fallback prices'); }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
    let userId;
    const password_hash = password ? await bcrypt.hash(password, 10) : null;
    if (existing.rows.length > 0) {
      const u = existing.rows[0];
      if (u.phone || u.google_id) throw new Error(`user "${username}" has a phone/Google login -- refusing to wipe a real account`);
      userId = u.id;
      if (password_hash) await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, userId]);
      await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM balance_edit_log WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)', [userId]);
      for (const t of ['installments', 'debts', 'investments', 'reminders', 'categories', 'accounts', 'net_worth_snapshots', 'unparsed_sms']) {
        await client.query(`DELETE FROM ${t} WHERE user_id = $1`, [userId]);
      }
    } else {
      if (!password_hash) throw new Error(`user "${username}" doesn't exist yet -- pass a password to create it`);
      const created = await client.query(
        'INSERT INTO users (username, password_hash, api_key) VALUES ($1, $2, $3) RETURNING id',
        [username, password_hash, crypto.randomBytes(24).toString('hex')]
      );
      userId = created.rows[0].id;
    }

    const categoryId = {};
    for (const c of DEFAULT_CATEGORIES) {
      const r = await client.query('INSERT INTO categories (name, direction, user_id) VALUES ($1, $2, $3) RETURNING id', [c.name, c.direction, userId]);
      categoryId[`${c.direction}:${c.name}`] = r.rows[0].id;
    }

    const accountId = {};
    const balance = {};
    for (const a of ACCOUNTS) {
      const r = await client.query(
        `INSERT INTO accounts (bank_code, bank, display_name, balance_rial, card_number, low_balance_threshold_rial, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [`${a.bank_code}-${userId}`, a.key, a.display_name, a.start, a.card_number, a.low, userId, daysAgo(DEMO_DAYS + 2, 8)]
      );
      accountId[a.key] = r.rows[0].id;
      balance[a.key] = a.start;
    }

    const installmentId = {};
    const paidDuringDemo = { car: MONTH_STARTS.length, phone: MONTH_STARTS.length, laptop: 0 };
    for (const i of INSTALLMENTS) {
      const paid = i.paidBefore + paidDuringDemo[i.key];
      const r = await client.query(
        `INSERT INTO installments (title, type, total_amount_rial, installment_amount_rial, total_count, paid_count, due_day_of_month, status, note, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [i.title, i.type, i.amount * i.total, i.amount, i.total, paid, i.due, paid >= i.total ? 'completed' : 'active', i.note, userId, daysAgo(DEMO_DAYS + 2, 8)]
      );
      installmentId[i.key] = r.rows[0].id;
    }

    // Replay transactions in time order so every balance_after_rial is consistent.
    const txs = buildTransactions();
    const dailyCash = new Map();
    for (const t of txs) {
      balance[t.account] += t.direction === 'income' ? t.amount : -t.amount;
      await client.query(
        `INSERT INTO transactions (account_id, amount_rial, direction, balance_after_rial, raw_text, status, category_id, note, tags, installment_id, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          accountId[t.account], t.amount, t.direction, balance[t.account],
          t.pending ? t.raw_text : 'manual entry', t.pending ? 'pending' : 'confirmed',
          t.pending ? null : categoryId[`${t.direction}:${t.category}`], t.note || null, t.tags || null,
          t.installment ? installmentId[t.installment] : null, userId, t.at,
        ]
      );
      dailyCash.set(t.at.toDateString(), Object.values(balance).reduce((s, v) => s + v, 0));
    }
    for (const a of ACCOUNTS) {
      await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [balance[a.key], accountId[a.key]]);
    }

    const debts = [
      { type: 'owed_to_me', person: 'علی', amount: 20000000, due: 25, status: 'open', note: '۳۰ میلیون قرض داده شد، ۱۰ میلیون برگشت' },
      { type: 'i_owe', person: 'برادرم', amount: 15000000, due: 20, status: 'open', note: 'برای خرید لپ‌تاپ' },
      { type: 'owed_to_me', person: 'سارا', amount: 5000000, due: null, status: 'settled', note: null },
      { type: 'owed_to_me', person: 'نگار', amount: 6500000, due: 10, status: 'open', note: 'پول بلیت کنسرت' },
      { type: 'i_owe', person: 'مهدی', amount: 8000000, due: 40, status: 'open', note: null },
    ];
    for (const d of debts) {
      await client.query(
        'INSERT INTO debts (type, person_name, amount_rial, due_date, status, note, user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [d.type, d.person, d.amount, d.due == null ? null : new Date(now.getTime() + d.due * DAY), d.status, d.note, userId, daysAgo(60)]
      );
    }

    let investedTotal = 0;
    let currentTotal = 0;
    for (const inv of INVESTMENTS) {
      const current = unitPriceRial(prices, inv.symbol) || inv.fallback;
      const purchase = Math.round((current * 0.86) / 10000) * 10000;
      const invested = Math.round(inv.qty * purchase);
      const value = Math.round(inv.qty * current);
      investedTotal += invested;
      currentTotal += value;
      await client.query(
        `INSERT INTO investments (title, asset_type, symbol, quantity, purchase_unit_price_rial, current_unit_price_rial, invested_amount_rial, current_value_rial, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [inv.title, inv.asset_type, inv.symbol, inv.qty, purchase, current, invested, value, userId, daysAgo(DEMO_DAYS - 5)]
      );
    }
    await client.query(
      `INSERT INTO investments (title, asset_type, invested_amount_rial, current_value_rial, note, user_id, created_at)
       VALUES ('صندوق درآمد ثابت', 'other', 100000000, 108500000, 'بدون قیمت بازار — ارزش دستی به‌روز می‌شه', $1, $2)`,
      [userId, daysAgo(DEMO_DAYS - 5)]
    );
    investedTotal += 100000000;
    currentTotal += 108500000;

    const reminders = [
      { module: 'قبض', title: 'پرداخت قبض برق', note: null, at: 3, sent: false },
      { module: 'بدهی و طلب', title: 'پیگیری طلب از علی', note: '۲۰ میلیون باقی مونده', at: 5, sent: false },
      { module: 'سایر', title: 'تمدید بیمه بدنه خودرو', note: null, at: 12, sent: false },
      { module: 'قسط', title: 'قسط وام خودرو', note: null, at: -25, sent: true },
      { module: 'قسط', title: 'قسط گوشی', note: null, at: 8, sent: false },
      { module: 'بدهی و طلب', title: 'پس دادن پول برادرم', note: '۱۵ میلیون', at: 18, sent: false },
      { module: 'عمومی', title: 'بررسی سود صندوق', note: null, at: -4, sent: true },
    ];
    for (const r of reminders) {
      const at = new Date(now.getTime() + r.at * DAY);
      at.setHours(10, 0, 0, 0);
      await client.query(
        'INSERT INTO reminders (module, title, note, remind_at, sent, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [r.module, r.title, r.note, at, r.sent, userId]
      );
    }

    await client.query(
      'INSERT INTO unparsed_sms (bank_code, raw_text, user_id, created_at) VALUES ($1, $2, $3, $4)',
      ['demo-mellat', 'بانک ملت\nپیام تبلیغاتی: وام ویژه با سود ۴ درصد', userId, daysAgo(8)]
    );

    // One snapshot per day for the analytics chart; investments drift from cost toward today's value.
    const remainingInstallments = INSTALLMENTS.reduce(
      (s, i) => s + i.amount * Math.max(0, i.total - i.paidBefore - paidDuringDemo[i.key]), 0
    );
    const owedToMe = debts.filter((d) => d.type === 'owed_to_me' && d.status === 'open').reduce((s, d) => s + d.amount, 0);
    const iOwe = debts.filter((d) => d.type === 'i_owe' && d.status === 'open').reduce((s, d) => s + d.amount, 0);
    let cash = ACCOUNTS.reduce((s, a) => s + a.start, 0);
    for (let d = DEMO_DAYS; d >= 0; d--) {
      const day = daysAgo(d, 8);
      cash = dailyCash.get(day.toDateString()) ?? cash;
      const progress = (DEMO_DAYS - d) / DEMO_DAYS;
      const investments = Math.round(investedTotal + (currentTotal - investedTotal) * progress);
      const debtsTotal = remainingInstallments + iOwe;
      await client.query(
        `INSERT INTO net_worth_snapshots (user_id, net_worth_rial, cash_rial, investments_rial, debts_rial, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, cash + investments + owedToMe - debtsTotal, cash, investments, debtsTotal, day]
      );
    }

    await client.query('COMMIT');
    console.log(`demo account "${username}" ready: ${txs.length} transactions (${txs.filter((t) => t.pending).length} pending), ` +
      `${ACCOUNTS.length} accounts, ${INSTALLMENTS.length} installments, ${debts.length} debts, ` +
      `${INVESTMENTS.length + 1} investments, ${reminders.length} reminders; market prices: ${prices ? 'live' : 'fallback'}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
}

main();
