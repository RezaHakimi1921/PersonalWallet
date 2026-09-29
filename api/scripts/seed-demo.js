// Creates (or resets) a username-login demo account filled with ~100 days of
// realistic sample data: accounts, 50 transactions, installments, debts,
// investments, reminders and net-worth history.
//
// Usage (inside the api container):
//   node scripts/seed-demo.js <username> <password>
//
// Re-running it wipes and rebuilds that demo account only. It refuses to touch an
// account that has a phone number or Google login, so it can't wipe a real user.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { DEFAULT_CATEGORIES } = require('../src/defaults');
const { getMarketPrices, unitPriceRial } = require('../src/assets');

const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 6) {
  console.error('usage: node scripts/seed-demo.js <username> <password (6+ chars)>');
  process.exit(1);
}

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
  { key: 'mellat', bank_code: 'demo-mellat', display_name: 'بانک ملت', start: 480000000, card_number: '6104330000001234', low: 50000000 },
  { key: 'saman', bank_code: 'demo-saman', display_name: 'بانک سامان', start: 150000000, card_number: '6219860000005678', low: null },
  { key: 'cash', bank_code: 'demo-cash', display_name: 'پول نقد', start: 20000000, card_number: null, low: null },
];

const INSTALLMENTS = [
  { key: 'car', title: 'وام خودرو', type: 'loan', amount: 12500000, total: 36, paidBefore: 14, due: 5, note: 'وام بانک ملت' },
  { key: 'phone', title: 'قسط گوشی', type: 'installment', amount: 4800000, total: 12, paidBefore: 6, due: 12, note: null },
  { key: 'laptop', title: 'قسط لپ‌تاپ', type: 'installment', amount: 9000000, total: 6, paidBefore: 6, due: 20, note: 'تسویه شده' },
];

function buildTransactions() {
  const tx = [];
  const add = (days, account, direction, category, amount, note, extra = {}) =>
    tx.push({ at: daysAgo(days), account, direction, category, amount, note, ...extra });

  [95, 65, 35, 5].forEach((d) => add(d, 'mellat', 'income', 'درآمد کار', 450000000, 'حقوق ماهانه'));
  [93, 63, 33].forEach((d) => add(d, 'mellat', 'expense', 'قبوض و خانه', 180000000, 'اجاره خانه'));
  [88, 58, 28].forEach((d) => add(d, 'mellat', 'expense', 'قسط', 12500000, 'قسط وام خودرو', { installment: 'car' }));
  [84, 54, 24].forEach((d) => add(d, 'saman', 'expense', 'قسط', 4800000, 'قسط گوشی', { installment: 'phone' }));
  [80, 50, 20].forEach((d) => add(d, 'saman', 'expense', 'قبوض و خانه', 2400000, 'اینترنت خانه'));
  [70, 40].forEach((d) => add(d, 'mellat', 'expense', 'قبوض و خانه', between(3000000, 6500000), 'قبض برق و گاز'));
  [75, 33].forEach((d) => {
    const amount = 30000000;
    add(d, 'mellat', 'expense', 'انتقال وجه بین حساب', amount, 'حساب مقابل: پول نقد');
    add(d, 'cash', 'income', 'انتقال وجه بین حساب', amount, 'حساب مقابل: بانک ملت');
  });
  add(61, 'mellat', 'expense', 'قرض', 30000000, 'قرض به علی');
  add(19, 'mellat', 'income', 'تسویه طلب', 10000000, 'علی بخشی از قرض رو برگردوند');
  add(72, 'saman', 'income', 'درآمد شخصی', 120000000, 'پروژه فریلنس');
  add(26, 'saman', 'income', 'درآمد شخصی', 85000000, 'پروژه فریلنس');
  add(45, 'mellat', 'income', 'سود سرمایه‌گذاری', 9800000, 'سود صندوق درآمد ثابت');

  const everyday = [
    { category: 'خوراکی', account: ['mellat', 'saman', 'cash'], min: 900000, max: 6500000, notes: ['خرید سوپرمارکت', 'میوه و تره‌بار', 'نون و لبنیات', 'خرید هفتگی'] },
    { category: 'غذا', account: ['mellat', 'saman'], min: 1500000, max: 7500000, notes: ['رستوران', 'سفارش آنلاین غذا', 'کافه با دوستان'] },
    { category: 'رفت و آمد', account: ['saman', 'cash'], min: 250000, max: 1800000, notes: ['اسنپ', 'تپسی', 'بلیت مترو'] },
    { category: 'خرید', account: ['mellat'], min: 4000000, max: 25000000, notes: ['لباس', 'لوازم خانه', 'کفش'] },
    { category: 'درمان و سلامت', account: ['mellat'], min: 2500000, max: 12000000, notes: ['ویزیت پزشک', 'داروخانه'] },
    { category: 'تفریح', account: ['saman', 'cash'], min: 1200000, max: 6000000, notes: ['سینما', 'بلیت کنسرت'] },
    { category: 'آرایشگاه', account: ['cash'], min: 1500000, max: 3000000, notes: ['آرایشگاه'] },
    { category: 'وسیله نقلیه', account: ['mellat'], min: 1500000, max: 9000000, notes: ['بنزین', 'کارواش', 'سرویس ماشین'] },
    { category: 'هدیه', account: ['mellat'], min: 3000000, max: 15000000, notes: ['هدیه تولد'] },
    { category: 'خانواده', account: ['mellat'], min: 5000000, max: 20000000, notes: ['کمک به خانواده'] },
    { category: 'توسعه شخصی', account: ['saman'], min: 4000000, max: 18000000, notes: ['دوره آنلاین', 'کتاب'] },
  ];
  const weights = [6, 4, 4, 2, 1, 1, 1, 1, 1, 1, 1];
  const pool = everyday.flatMap((e, i) => Array(weights[i]).fill(e));
  const PENDING_COUNT = 4;
  while (tx.length < 50 - PENDING_COUNT) {
    const e = pick(pool);
    add(Math.floor(rand() * 98) + 1, pick(e.account), 'expense', e.category, between(e.min, e.max), pick(e.notes), { tags: rand() < 0.2 ? 'ضروری' : null });
  }

  // Unreviewed bank SMS, as they'd arrive from the webhook -- these fill the "در انتظار" tab.
  const pending = [
    { days: 1, account: 'mellat', amount: 3750000, text: 'بانک ملت\nبرداشت: 3,750,000\nخرید کارتی' },
    { days: 1, account: 'saman', amount: 1180000, text: 'بانک سامان\nبرداشت: 1,180,000\nپرداخت اینترنتی' },
    { days: 0, account: 'mellat', amount: 12500000, text: 'بانک ملت\nبرداشت: 12,500,000\nانتقال' },
    { days: 0, account: 'saman', amount: 640000, text: 'بانک سامان\nبرداشت: 640,000\nخرید کارتی' },
  ];
  pending.forEach((p) => tx.push({ at: daysAgo(p.days, p.days === 0 ? 9 : 18), account: p.account, direction: 'expense', amount: p.amount, pending: true, raw_text: p.text }));

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
    const password_hash = await bcrypt.hash(password, 10);
    if (existing.rows.length > 0) {
      const u = existing.rows[0];
      if (u.phone || u.google_id) throw new Error(`user "${username}" has a phone/Google login -- refusing to wipe a real account`);
      userId = u.id;
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, userId]);
      await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM balance_edit_log WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)', [userId]);
      for (const t of ['installments', 'debts', 'investments', 'reminders', 'categories', 'accounts', 'net_worth_snapshots', 'unparsed_sms']) {
        await client.query(`DELETE FROM ${t} WHERE user_id = $1`, [userId]);
      }
    } else {
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
        [`${a.bank_code}-${userId}`, a.key, a.display_name, a.start, a.card_number, a.low, userId, daysAgo(100, 8)]
      );
      accountId[a.key] = r.rows[0].id;
      balance[a.key] = a.start;
    }

    const installmentId = {};
    const paidDuringDemo = { car: 3, phone: 3, laptop: 0 };
    for (const i of INSTALLMENTS) {
      const paid = i.paidBefore + paidDuringDemo[i.key];
      const r = await client.query(
        `INSERT INTO installments (title, type, total_amount_rial, installment_amount_rial, total_count, paid_count, due_day_of_month, status, note, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [i.title, i.type, i.amount * i.total, i.amount, i.total, paid, i.due, paid >= i.total ? 'completed' : 'active', i.note, userId, daysAgo(100, 8)]
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
        [inv.title, inv.asset_type, inv.symbol, inv.qty, purchase, current, invested, value, userId, daysAgo(92)]
      );
    }
    await client.query(
      `INSERT INTO investments (title, asset_type, invested_amount_rial, current_value_rial, note, user_id, created_at)
       VALUES ('صندوق درآمد ثابت', 'other', 100000000, 108500000, 'بدون قیمت بازار — ارزش دستی به‌روز می‌شه', $1, $2)`,
      [userId, daysAgo(92)]
    );
    investedTotal += 100000000;
    currentTotal += 108500000;

    const reminders = [
      { module: 'قبض', title: 'پرداخت قبض برق', note: null, at: 3, sent: false },
      { module: 'بدهی و طلب', title: 'پیگیری طلب از علی', note: '۲۰ میلیون باقی مونده', at: 5, sent: false },
      { module: 'سایر', title: 'تمدید بیمه بدنه خودرو', note: null, at: 12, sent: false },
      { module: 'قسط', title: 'قسط وام خودرو', note: null, at: -25, sent: true },
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
    let cash = ACCOUNTS.reduce((s, a) => s + a.start, 0);
    for (let d = 95; d >= 0; d--) {
      const day = daysAgo(d, 8);
      cash = dailyCash.get(day.toDateString()) ?? cash;
      const progress = (95 - d) / 95;
      const investments = Math.round(investedTotal + (currentTotal - investedTotal) * progress);
      const debtsTotal = remainingInstallments + 15000000;
      await client.query(
        `INSERT INTO net_worth_snapshots (user_id, net_worth_rial, cash_rial, investments_rial, debts_rial, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, cash + investments + 20000000 - debtsTotal, cash, investments, debtsTotal, day]
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
