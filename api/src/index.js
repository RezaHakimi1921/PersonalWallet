const express = require('express');
const { Pool } = require('pg');
const cron = require('node-cron');
const jalaali = require('jalaali-js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { parseSms } = require('./parsers');
const { sendNtfy } = require('./ntfy');

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(express.json());

// Self-migrating: reminders module didn't exist in the original init.sql, so create it
// on startup if missing instead of requiring a manual psql migration on deploy.
pool.query(`
  CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    module TEXT NOT NULL DEFAULT 'عمومی',
    title TEXT NOT NULL,
    note TEXT,
    remind_at TIMESTAMPTZ NOT NULL,
    sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
  )
`).catch((err) => console.error('reminders migration error', err));

// Self-migrating: lets a transaction delete optionally skip reverting the account
// balance (e.g. deleting a duplicate whose balance effect should stay applied).
// Restore needs to know which one happened so it mirrors it correctly.
pool.query(`
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_reverted BOOLEAN NOT NULL DEFAULT true
`).catch((err) => console.error('balance_reverted migration error', err));

// Self-migrating: audit trail for manual account-balance edits (via the accounts
// ✎ form) -- a bad manual balance edit was silent and hard to trace back, so every
// one is now logged with the before/after value.
pool.query(`
  CREATE TABLE IF NOT EXISTS balance_edit_log (
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL REFERENCES accounts(id),
    user_id INT REFERENCES users(id),
    old_balance_rial BIGINT,
    new_balance_rial BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`).catch((err) => console.error('balance_edit_log migration error', err));

// Self-migrating: daily net-worth snapshots, taken by the 08:00 cron, so the
// analytics tab can chart growth over time instead of only showing a live number.
pool.query(`
  CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    net_worth_rial BIGINT NOT NULL,
    cash_rial BIGINT NOT NULL,
    investments_rial BIGINT NOT NULL,
    debts_rial BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`).catch((err) => console.error('net_worth_snapshots migration error', err));

// Self-migrating: unparsed SMS used to only fire a push notification and leave no
// record -- easy to miss, impossible to review later. Now kept for the data-quality report.
pool.query(`
  CREATE TABLE IF NOT EXISTS unparsed_sms (
    id SERIAL PRIMARY KEY,
    bank_code TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    user_id INT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`).catch((err) => console.error('unparsed_sms migration error', err));

// Self-migrating: multi-user auth. Each user gets their own fully separate wallet
// (accounts/transactions/etc. are scoped by user_id). Existing single-user data,
// created before this migration, has a NULL user_id; once exactly one user exists
// (the first registration), it's automatically backfilled to that user so nothing
// already in the app gets orphaned.
async function migrateAuth() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      ntfy_topic TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Registration moved from username to phone+OTP verification; username is kept
  // (nullable) only so any pre-existing rows aren't broken by the column going away.
  await pool.query(`ALTER TABLE users ALTER COLUMN username DROP NOT NULL`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'register',
      expires_at TIMESTAMPTZ NOT NULL,
      consumed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const tables = ['accounts', 'categories', 'transactions', 'installments', 'debts', 'investments', 'reminders'];
  for (const t of tables) {
    await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id)`);
  }
  // The old single-user schema had a global UNIQUE(name, direction) on categories;
  // that would now wrongly block two different users from both having e.g. "غذا".
  await pool.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_direction_key`);
  await backfillDefaultUser();
}

// Assigns any pre-auth (NULL user_id) rows to the first registered user, but only
// while there's exactly one user -- so it never fires again once a second person
// signs up. Called at startup and right after a registration, so the very first
// account picks up all the old single-user data immediately (not just on next boot).
async function backfillDefaultUser() {
  await pool.query(`
    DO $$
    DECLARE default_user_id INT;
    BEGIN
      IF (SELECT COUNT(*) FROM users) = 1 THEN
        SELECT id INTO default_user_id FROM users LIMIT 1;
        UPDATE accounts SET user_id = default_user_id WHERE user_id IS NULL;
        UPDATE categories SET user_id = default_user_id WHERE user_id IS NULL;
        UPDATE transactions SET user_id = default_user_id WHERE user_id IS NULL;
        UPDATE installments SET user_id = default_user_id WHERE user_id IS NULL;
        UPDATE debts SET user_id = default_user_id WHERE user_id IS NULL;
        UPDATE investments SET user_id = default_user_id WHERE user_id IS NULL;
        UPDATE reminders SET user_id = default_user_id WHERE user_id IS NULL;
      END IF;
    END $$;
  `);
}
migrateAuth().catch((err) => console.error('auth migration error', err));

function toToman(rial) {
  return Math.round(rial);
}

function fmt(n) {
  return n.toLocaleString('en-US');
}

// ---------- Auth helpers ----------
function signToken(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).userId;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}

// Temporary escape hatch while there's no real domain (so no https-safe place for
// the login cookie to matter) and OTP is unreachable. Off means every request is
// treated as the single existing user -- fine for one person, not for multi-user.
// Flip AUTH_REQUIRED back to true (the default) once the domain + OTP are ready;
// nothing else needs to change.
const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== 'false';

function requireAuth(req, res, next) {
  if (!AUTH_REQUIRED) {
    pool.query('SELECT id FROM users ORDER BY id LIMIT 1')
      .then((r) => {
        if (r.rows.length === 0) return res.status(401).json({ error: 'no user registered yet' });
        req.userId = r.rows[0].id;
        next();
      })
      .catch((err) => { console.error(err); res.status(500).json({ error: 'internal error' }); });
    return;
  }
  const userId = verifyToken(parseCookies(req).session);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  req.userId = userId;
  next();
}

async function resolveUserByApiKey(apiKey) {
  if (!apiKey) return null;
  const result = await pool.query('SELECT * FROM users WHERE api_key = $1', [apiKey]);
  return result.rows[0] || null;
}

const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 90 * 24 * 60 * 60 * 1000 };

// Accepts 09xxxxxxxxx, +989xxxxxxxxx, 00989xxxxxxxxx, or with spaces/dashes;
// returns the normalized 09xxxxxxxxx form, or null if not a valid Iranian mobile number.
function normalizeIranianPhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/[\s-]/g, '');
  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('0098')) p = '0' + p.slice(4);
  else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
  return /^09\d{9}$/.test(p) ? p : null;
}

// Sends a one-time code via ASA SMS (https://asasms.com), using their pattern-send
// API so the message goes out instantly without per-message manual review. Needs
// a pattern created in the ASA panel (keyword "code") plus its id, an API key, and
// a sender line -- without all three, OTP requests fail loudly instead of silently
// pretending to succeed.
async function sendOtpSms(phone, code) {
  const apiKey = process.env.ASA_API_KEY;
  const from = process.env.ASA_SENDER;
  const patternId = process.env.ASA_PATTERN_ID;
  if (!apiKey || !from || !patternId) {
    throw new Error('تنظیمات ASA SMS کامل نیست (ASA_API_KEY / ASA_SENDER / ASA_PATTERN_ID) — این‌ها باید توی .env سرور ست بشن');
  }
  const res = await fetch('https://api-payamak.com/api/v3/rest/sms/pattern-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({
      from,
      recipients: [phone],
      message: { code },
      pattern_id: Number(patternId),
    }),
  });
  const data = await res.json();
  if (!res.ok || data?.return?.status !== 200) {
    throw new Error(data?.return?.message || 'ارسال پیامک OTP ناموفق بود');
  }
}

const OTP_TTL_MS = 2 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
// Off until ASA SMS is actually wired up (needs a real domain + an approved pattern).
// Toggle by setting OTP_ENABLED=true in .env once that's ready -- nothing else to change.
const OTP_ENABLED = process.env.OTP_ENABLED === 'true';

app.get('/auth/config', (req, res) => res.json({ otp_enabled: OTP_ENABLED }));

app.post('/auth/request-otp', async (req, res) => {
  if (!OTP_ENABLED) return res.json({ ok: true, skipped: true });
  const phone = normalizeIranianPhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: 'شماره موبایل معتبر نیست' });
  try {
    const recent = await pool.query(
      `SELECT id FROM otp_codes WHERE phone = $1 AND purpose = 'register' AND created_at > now() - interval '${OTP_RESEND_COOLDOWN_MS / 1000} seconds'`,
      [phone]
    );
    if (recent.rows.length > 0) return res.status(429).json({ error: 'کمی صبر کن و دوباره امتحان کن' });

    const code = String(crypto.randomInt(10000, 99999));
    await sendOtpSms(phone, code);
    await pool.query(
      `INSERT INTO otp_codes (phone, code, purpose, expires_at) VALUES ($1, $2, 'register', now() + interval '${OTP_TTL_MS / 1000} seconds')`,
      [phone, code]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('otp send error', err);
    res.status(500).json({ error: err.message || 'ارسال کد ناموفق بود' });
  }
});

app.post('/auth/register', async (req, res) => {
  const phone = normalizeIranianPhone(req.body?.phone);
  const { password, otp } = req.body || {};
  if (!phone || !password || password.length < 6 || (OTP_ENABLED && !otp)) {
    return res.status(400).json({ error: `شماره موبایل، رمز عبور (۶ رقم یا بیشتر)${OTP_ENABLED ? ' و کد تأیید' : ''} لازمه` });
  }
  try {
    if (OTP_ENABLED) {
      const otpRes = await pool.query(
        `SELECT * FROM otp_codes WHERE phone = $1 AND code = $2 AND purpose = 'register' AND consumed = false AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`,
        [phone, String(otp)]
      );
      if (otpRes.rows.length === 0) return res.status(400).json({ error: 'کد تأیید اشتباهه یا منقضی شده' });
      await pool.query('UPDATE otp_codes SET consumed = true WHERE id = $1', [otpRes.rows[0].id]);
    }

    const password_hash = await bcrypt.hash(password, 10);
    const api_key = crypto.randomBytes(24).toString('hex');
    const result = await pool.query(
      'INSERT INTO users (phone, password_hash, api_key) VALUES ($1, $2, $3) RETURNING id, phone',
      [phone, password_hash, api_key]
    );
    const user = result.rows[0];
    await backfillDefaultUser();
    res.cookie('session', signToken(user.id), COOKIE_OPTS);
    res.json({ ok: true, phone: user.phone });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'این شماره قبلاً ثبت‌نام کرده' });
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

app.post('/auth/login', async (req, res) => {
  const phone = normalizeIranianPhone(req.body?.phone);
  const { password } = req.body || {};
  if (!phone || !password) return res.status(400).json({ error: 'شماره موبایل و رمز عبور لازمه' });
  const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'شماره موبایل یا رمز اشتباهه' });
  }
  res.cookie('session', signToken(user.id), COOKIE_OPTS);
  res.json({ ok: true, phone: user.phone });
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

app.get('/auth/me', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT id, phone, api_key, ntfy_topic FROM users WHERE id = $1', [req.userId]);
  if (result.rows.length === 0) return res.status(401).json({ error: 'unauthorized' });
  res.json(result.rows[0]);
});

app.put('/auth/me/ntfy-topic', requireAuth, async (req, res) => {
  const { ntfy_topic } = req.body || {};
  await pool.query('UPDATE users SET ntfy_topic = $1 WHERE id = $2', [ntfy_topic || null, req.userId]);
  res.json({ ok: true });
});

// Fires immediately whenever a balance changes, instead of waiting for the daily cron.
async function checkLowBalance(accountId) {
  try {
    const res = await pool.query(
      `SELECT a.*, u.ntfy_topic FROM accounts a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND a.low_balance_threshold_rial IS NOT NULL AND a.balance_rial < a.low_balance_threshold_rial`,
      [accountId]
    );
    for (const acc of res.rows) {
      await sendNtfy({
        title: '🔴 موجودی کم',
        message: `حساب ${acc.display_name} از حد هشدار موجودی که تعیین کردی پایین‌تر رفته.`,
        priority: 4,
        tags: ['warning'],
        topic: acc.ntfy_topic,
      });
    }
  } catch (err) {
    console.error('low balance check error', err);
  }
}

// ---------- Webhook: incoming bank SMS. Not cookie-authenticated (an external iOS
// Shortcut posts here) -- identified instead by the per-user api_key in the URL. ----------
app.post('/webhook/sms/:apiKey', async (req, res) => {
  const user = await resolveUserByApiKey(req.params.apiKey);
  if (!user) return res.status(401).json({ error: 'invalid api key' });

  // iOS Shortcuts auto-capitalizes single-word field names (e.g. "Text"), so match keys case-insensitively.
  const body = {};
  for (const [k, v] of Object.entries(req.body || {})) body[k.toLowerCase()] = v;
  const bank = body.bank?.toLowerCase();
  const text = body.text;
  if (!bank || !text) return res.status(400).json({ error: 'bank and text are required' });

  const client = await pool.connect();
  try {
    const accountRes = await client.query('SELECT * FROM accounts WHERE bank_code = $1 AND user_id = $2', [bank, user.id]);
    if (accountRes.rows.length === 0) {
      return res.status(404).json({ error: `unknown bank code: ${bank}` });
    }
    const account = accountRes.rows[0];

    // Idempotency: the exact same SMS text for this account within the last 5
    // minutes is treated as a retry of the same webhook call (e.g. an iOS
    // Shortcut re-running after a timeout), not a second real transaction --
    // a real second transaction from the bank would have a different balance
    // or timestamp in its own text. Returns the original instead of re-inserting.
    const idempotentRes = await client.query(
      `SELECT id, amount_rial, balance_after_rial FROM transactions
       WHERE account_id = $1 AND raw_text = $2 AND deleted_at IS NULL AND created_at > now() - interval '5 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [account.id, text]
    );
    if (idempotentRes.rows.length > 0) {
      const existing = idempotentRes.rows[0];
      return res.json({ ok: true, parsed: true, transaction_id: existing.id, new_balance_rial: existing.balance_after_rial, idempotent_replay: true });
    }

    const parsed = parseSms(bank, text);

    if (!parsed) {
      // Not a transaction SMS (or couldn't be parsed) -- alert immediately, and also
      // keep a record so it shows up in the data-quality report even if the push
      // notification gets missed.
      await client.query(
        'INSERT INTO unparsed_sms (bank_code, raw_text, user_id) VALUES ($1, $2, $3)',
        [bank, text, user.id]
      );
      await sendNtfy({
        title: `⚠️ پیامک ${account.display_name} پارس نشد`,
        message: text,
        priority: 4,
        tags: ['warning'],
        topic: user.ntfy_topic,
      });
      return res.json({ ok: true, parsed: false });
    }

    const { amount_rial, direction, balance_after_rial } = parsed;
    const currentBalance = Number(account.balance_rial);
    const newBalance = balance_after_rial != null
      ? balance_after_rial
      : direction === 'income'
        ? currentBalance + amount_rial
        : currentBalance - amount_rial;

    await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [newBalance, account.id]);
    checkLowBalance(account.id);

    const txRes = await client.query(
      `INSERT INTO transactions (account_id, amount_rial, direction, balance_after_rial, raw_text, status, user_id)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING id`,
      [account.id, amount_rial, direction, newBalance, text, user.id]
    );
    const txId = txRes.rows[0].id;

    // check for matching installments (only for expenses)
    let matches = [];
    if (direction === 'expense') {
      const matchRes = await client.query(
        `SELECT id, title FROM installments
         WHERE status = 'active' AND installment_amount_rial = $1 AND paid_count < total_count AND user_id = $2`,
        [amount_rial, user.id]
      );
      matches = matchRes.rows;
    }

    // Duplicate detection: same account/amount/direction within the last 10 minutes.
    const dupRes = await client.query(
      `SELECT id FROM transactions
       WHERE id != $1 AND deleted_at IS NULL AND account_id = $2 AND amount_rial = $3 AND direction = $4
         AND created_at > now() - interval '10 minutes'`,
      [txId, account.id, amount_rial, direction]
    );
    const isDuplicate = dupRes.rows.length > 0;
    if (isDuplicate) {
      await client.query(
        `UPDATE transactions SET note = 'احتمالاً تکراری با تراکنش #' || $1 WHERE id = $2`,
        [dupRes.rows[0].id, txId]
      );
    }

    const sign = direction === 'income' ? '🟢' : '🔴';
    let message = direction === 'income'
      ? `${sign} ${fmt(toToman(amount_rial))} ریال به ${account.display_name} واریز شد`
      : `${sign} ${fmt(toToman(amount_rial))} ریال از ${account.display_name} کسر شد`;
    if (isDuplicate) message += '\n\n⚠️ شبیه یه تراکنش دیگه‌ست، احتمال تکراری بودن هست.';

    const actions = [];
    if (matches.length === 1) {
      message += `\n\nاحتمالاً قسط «${matches[0].title}» بود.`;
      actions.push({
        action: 'http',
        label: 'بله قسط بود',
        url: `${PUBLIC_BASE_URL}/api/transactions/${txId}/confirm-installment?installment_id=${matches[0].id}&api_key=${user.api_key}`,
        method: 'POST',
        clear: true,
      });
    } else if (matches.length > 1) {
      message += `\n\nچند قسط با این مبلغ پیدا شد: ${matches.map((m) => m.title).join(', ')}`;
      matches.slice(0, 2).forEach((m) => {
        actions.push({
          action: 'http',
          label: m.title,
          url: `${PUBLIC_BASE_URL}/api/transactions/${txId}/confirm-installment?installment_id=${m.id}&api_key=${user.api_key}`,
          method: 'POST',
          clear: true,
        });
      });
    }
    actions.push({ action: 'view', label: 'دسته‌بندی', url: `${PUBLIC_BASE_URL}/#/tx/${txId}` });

    await sendNtfy({ title: 'تراکنش جدید', message, actions, priority: 4, topic: user.ntfy_topic });

    res.json({ ok: true, parsed: true, transaction_id: txId, new_balance_rial: newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  } finally {
    client.release();
  }
});

// ---------- Transactions ----------
app.get('/transactions', requireAuth, async (req, res) => {
  const { status } = req.query;
  const params = [req.userId];
  let where = 'WHERE t.deleted_at IS NULL AND t.user_id = $1';
  if (status) {
    params.push(status);
    where += ` AND t.status = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT t.*, a.display_name AS account_name, c.name AS category_name
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT 200`,
    params
  );
  res.json(result.rows);
});

app.get('/transactions/trash', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT t.*, a.display_name AS account_name, c.name AS category_name
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.deleted_at IS NOT NULL AND t.user_id = $1
     ORDER BY t.deleted_at DESC
     LIMIT 100`,
    [req.userId]
  );
  res.json(result.rows);
});

// Manual entry: for when the automatic SMS webhook doesn't fire.
app.post('/transactions/manual', requireAuth, async (req, res) => {
  const { account_id, amount_rial, direction, category_id, note, tags } = req.body || {};
  if (!account_id || !amount_rial || !['expense', 'income'].includes(direction)) {
    return res.status(400).json({ error: 'account_id, amount_rial and direction are required' });
  }
  const client = await pool.connect();
  try {
    const accountRes = await client.query('SELECT * FROM accounts WHERE id = $1 AND user_id = $2', [account_id, req.userId]);
    if (accountRes.rows.length === 0) return res.status(404).json({ error: 'account not found' });
    const account = accountRes.rows[0];

    const newBalance = direction === 'income'
      ? account.balance_rial + Number(amount_rial)
      : account.balance_rial - Number(amount_rial);
    await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [newBalance, account_id]);
    checkLowBalance(account_id);

    const txRes = await client.query(
      `INSERT INTO transactions (account_id, amount_rial, direction, balance_after_rial, raw_text, status, category_id, note, tags, user_id)
       VALUES ($1, $2, $3, $4, 'manual entry', 'confirmed', $5, $6, $7, $8) RETURNING *`,
      [account_id, amount_rial, direction, newBalance, category_id || null, note || null, tags || null, req.userId]
    );
    const tx = txRes.rows[0];

    // Same duplicate check as the SMS webhook: catches the case where a manual
    // entry is made for something that actually did land automatically too
    // (e.g. right after the webhook URL was broken and then fixed).
    const dupRes = await client.query(
      `SELECT id FROM transactions
       WHERE id != $1 AND deleted_at IS NULL AND account_id = $2 AND amount_rial = $3 AND direction = $4 AND user_id = $5
         AND created_at > now() - interval '10 minutes'`,
      [tx.id, account_id, amount_rial, direction, req.userId]
    );
    if (dupRes.rows.length > 0) {
      const noteText = `احتمالاً تکراری با تراکنش #${dupRes.rows[0].id}${note ? ' — ' + note : ''}`;
      await client.query('UPDATE transactions SET note = $1 WHERE id = $2', [noteText, tx.id]);
      tx.note = noteText;
    }

    res.json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  } finally {
    client.release();
  }
});

// Soft-delete a transaction. By default reverses its balance effect (the usual
// case: the transaction shouldn't have happened); pass revert_balance:false to
// remove the ledger entry only and leave the account balance untouched (e.g. a
// duplicate SMS where the balance already reflects the real one). Recoverable
// via /restore, which mirrors whichever choice was made here.
app.delete('/transactions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const revertBalance = req.body?.revert_balance !== false;
  const client = await pool.connect();
  try {
    const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, req.userId]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const tx = txRes.rows[0];

    if (revertBalance) {
      const accountRes = await client.query('SELECT * FROM accounts WHERE id = $1', [tx.account_id]);
      const account = accountRes.rows[0];
      const revertedBalance = tx.direction === 'income'
        ? Number(account.balance_rial) - Number(tx.amount_rial)
        : Number(account.balance_rial) + Number(tx.amount_rial);
      await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [revertedBalance, tx.account_id]);
    }
    await client.query('UPDATE transactions SET deleted_at = now(), balance_reverted = $1 WHERE id = $2', [revertBalance, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  } finally {
    client.release();
  }
});

// Restore a soft-deleted transaction. Mirrors what the delete did: only
// re-applies the balance effect if the delete had reverted it.
app.post('/transactions/:id/restore', requireAuth, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL', [id, req.userId]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const tx = txRes.rows[0];

    if (tx.balance_reverted) {
      const accountRes = await client.query('SELECT * FROM accounts WHERE id = $1', [tx.account_id]);
      const account = accountRes.rows[0];
      const restoredBalance = tx.direction === 'income'
        ? Number(account.balance_rial) + Number(tx.amount_rial)
        : Number(account.balance_rial) - Number(tx.amount_rial);
      await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [restoredBalance, tx.account_id]);
    }
    await client.query('UPDATE transactions SET deleted_at = NULL WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  } finally {
    client.release();
  }
});

// Edit an already-recorded transaction's amount/direction/account/category,
// reconciling the account balance(s) for the change.
app.put('/transactions/:id/edit', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { amount_rial, direction, account_id, category_id, note, tags } = req.body || {};
  const client = await pool.connect();
  try {
    const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const tx = txRes.rows[0];

    const newAmount = amount_rial != null ? Number(amount_rial) : Number(tx.amount_rial);
    const newDirection = direction || tx.direction;
    let newAccountId = account_id != null ? Number(account_id) : tx.account_id;
    if (newAccountId !== tx.account_id) {
      const ownCheck = await client.query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [newAccountId, req.userId]);
      if (ownCheck.rows.length === 0) return res.status(404).json({ error: 'account not found' });
    }

    // revert the old effect on the old account
    const oldAccountRes = await client.query('SELECT * FROM accounts WHERE id = $1', [tx.account_id]);
    const oldAccount = oldAccountRes.rows[0];
    const revertedOldBalance = tx.direction === 'income'
      ? Number(oldAccount.balance_rial) - Number(tx.amount_rial)
      : Number(oldAccount.balance_rial) + Number(tx.amount_rial);
    await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [revertedOldBalance, tx.account_id]);

    // apply the new effect on the (possibly different) account
    const targetAccountRes = await client.query('SELECT * FROM accounts WHERE id = $1', [newAccountId]);
    const targetAccount = targetAccountRes.rows[0];
    const targetCurrentBalance = newAccountId === tx.account_id ? revertedOldBalance : Number(targetAccount.balance_rial);
    const newBalance = newDirection === 'income'
      ? targetCurrentBalance + newAmount
      : targetCurrentBalance - newAmount;
    await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [newBalance, newAccountId]);
    checkLowBalance(newAccountId);

    const result = await client.query(
      `UPDATE transactions SET amount_rial = $1, direction = $2, account_id = $3, category_id = $4, note = COALESCE($5, note), balance_after_rial = $6, tags = COALESCE($7, tags)
       WHERE id = $8 RETURNING *`,
      [newAmount, newDirection, newAccountId, category_id ?? tx.category_id, note ?? null, newBalance, tags ?? null, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  } finally {
    client.release();
  }
});

app.post('/transactions/:id/confirm', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { category_id, note, tags } = req.body || {};
  const result = await pool.query(
    `UPDATE transactions SET category_id = $1, note = $2, status = 'confirmed', tags = COALESCE($3, tags) WHERE id = $4 AND user_id = $5 RETURNING *`,
    [category_id || null, note || null, tags || null, id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

// Triggered from a "yes, this was an installment" ntfy action button, so it can't
// carry a session cookie -- identified by the same api_key as the SMS webhook.
app.post('/transactions/:id/confirm-installment', async (req, res) => {
  const apiKey = req.query.api_key || req.body?.api_key;
  const user = await resolveUserByApiKey(apiKey);
  if (!user) return res.status(401).json({ error: 'invalid api key' });

  const { id } = req.params;
  const installmentId = req.query.installment_id || req.body?.installment_id;
  if (!installmentId) return res.status(400).json({ error: 'installment_id required' });

  const client = await pool.connect();
  try {
    const catRes = await client.query(`SELECT id FROM categories WHERE name = 'قسط' AND direction = 'expense' AND user_id = $1`, [user.id]);
    const categoryId = catRes.rows[0]?.id || null;

    const txRes = await client.query(
      `UPDATE transactions SET category_id = $1, status = 'confirmed', installment_id = $2 WHERE id = $3 AND user_id = $4 RETURNING *`,
      [categoryId, installmentId, id, user.id]
    );
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'transaction not found' });

    const instRes = await client.query(
      `UPDATE installments SET paid_count = paid_count + 1 WHERE id = $1 AND user_id = $2 RETURNING *`,
      [installmentId, user.id]
    );
    const inst = instRes.rows[0];
    if (inst && inst.paid_count >= inst.total_count) {
      await client.query(`UPDATE installments SET status = 'completed' WHERE id = $1`, [installmentId]);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  } finally {
    client.release();
  }
});

// ---------- Accounts ----------
app.get('/accounts', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM accounts WHERE user_id = $1 ORDER BY id', [req.userId]);
  res.json(result.rows);
});

app.post('/accounts', requireAuth, async (req, res) => {
  const { display_name, balance_rial, card_number, account_number, iban, cvv2, expiry, low_balance_threshold_rial } = req.body || {};
  if (!display_name) return res.status(400).json({ error: 'display_name is required' });
  const bank_code = `manual-${Date.now()}`;
  const result = await pool.query(
    `INSERT INTO accounts (bank_code, display_name, balance_rial, card_number, account_number, iban, cvv2, expiry, low_balance_threshold_rial, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [bank_code, display_name, balance_rial || 0, card_number || null, account_number || null, iban || null, cvv2 || null, expiry || null, low_balance_threshold_rial || null, req.userId]
  );
  res.json(result.rows[0]);
});

app.put('/accounts/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { display_name, balance_rial, card_number, account_number, iban, cvv2, expiry, low_balance_threshold_rial } = req.body || {};

  if (balance_rial != null) {
    const existing = await pool.query('SELECT balance_rial FROM accounts WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (existing.rows.length > 0 && Number(existing.rows[0].balance_rial) !== Number(balance_rial)) {
      await pool.query(
        'INSERT INTO balance_edit_log (account_id, user_id, old_balance_rial, new_balance_rial) VALUES ($1, $2, $3, $4)',
        [id, req.userId, existing.rows[0].balance_rial, balance_rial]
      );
    }
  }

  const result = await pool.query(
    `UPDATE accounts SET
       display_name = COALESCE($1, display_name),
       balance_rial = COALESCE($2, balance_rial),
       card_number = COALESCE($3, card_number),
       account_number = COALESCE($4, account_number),
       iban = COALESCE($5, iban),
       cvv2 = COALESCE($6, cvv2),
       expiry = COALESCE($7, expiry),
       low_balance_threshold_rial = COALESCE($8, low_balance_threshold_rial)
     WHERE id = $9 AND user_id = $10 RETURNING *`,
    [display_name ?? null, balance_rial ?? null, card_number ?? null, account_number ?? null, iban ?? null, cvv2 ?? null, expiry ?? null, low_balance_threshold_rial ?? null, id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  if (balance_rial != null || low_balance_threshold_rial != null) await checkLowBalance(id);
  res.json(result.rows[0]);
});

app.get('/accounts/:id/balance-log', requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    `SELECT * FROM balance_edit_log WHERE account_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50`,
    [id, req.userId]
  );
  res.json(result.rows);
});

// ---------- Categories ----------
app.get('/categories', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM categories WHERE is_active = true AND user_id = $1 ORDER BY direction, name', [req.userId]);
  res.json(result.rows);
});

app.post('/categories', requireAuth, async (req, res) => {
  const { name, direction } = req.body || {};
  if (!name || !['expense', 'income'].includes(direction)) {
    return res.status(400).json({ error: 'name and valid direction are required' });
  }
  const result = await pool.query(
    'INSERT INTO categories (name, direction, user_id) VALUES ($1, $2, $3) RETURNING *',
    [name, direction, req.userId]
  );
  res.json(result.rows[0]);
});

app.put('/categories/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body || {};
  const result = await pool.query(
    `UPDATE categories SET name = COALESCE($1, name), is_active = COALESCE($2, is_active) WHERE id = $3 AND user_id = $4 RETURNING *`,
    [name ?? null, is_active ?? null, id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

// ---------- Installments / Loans ----------
app.get('/installments', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM installments WHERE deleted_at IS NULL AND user_id = $1 ORDER BY status, due_day_of_month', [req.userId]);
  res.json(result.rows);
});

app.get('/installments/trash', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM installments WHERE deleted_at IS NOT NULL AND user_id = $1 ORDER BY deleted_at DESC', [req.userId]);
  res.json(result.rows);
});

app.post('/installments', requireAuth, async (req, res) => {
  const { title, type, total_amount_rial, installment_amount_rial, total_count, due_day_of_month, note } = req.body || {};
  if (!title || !installment_amount_rial || !total_count || !due_day_of_month) {
    return res.status(400).json({ error: 'missing required fields' });
  }
  const result = await pool.query(
    `INSERT INTO installments (title, type, total_amount_rial, installment_amount_rial, total_count, due_day_of_month, note, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [title, type || 'installment', total_amount_rial || null, installment_amount_rial, total_count, due_day_of_month, note || null, req.userId]
  );
  res.json(result.rows[0]);
});

app.put('/installments/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, installment_amount_rial, total_count, paid_count, due_day_of_month, note } = req.body || {};
  const result = await pool.query(
    `UPDATE installments SET
       title = COALESCE($1, title),
       installment_amount_rial = COALESCE($2, installment_amount_rial),
       total_count = COALESCE($3, total_count),
       paid_count = COALESCE($4, paid_count),
       due_day_of_month = COALESCE($5, due_day_of_month),
       note = COALESCE($6, note),
       status = CASE WHEN COALESCE($4, paid_count) >= COALESCE($3, total_count) THEN 'completed' ELSE 'active' END
     WHERE id = $7 AND user_id = $8 RETURNING *`,
    [title ?? null, installment_amount_rial ?? null, total_count ?? null, paid_count ?? null, due_day_of_month ?? null, note ?? null, id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.delete('/installments/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE installments SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
    [id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

app.post('/installments/:id/restore', requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE installments SET deleted_at = NULL WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING *',
    [id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.post('/installments/:id/pay', requireAuth, async (req, res) => {
  const { id } = req.params;
  const instRes = await pool.query('UPDATE installments SET paid_count = paid_count + 1 WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.userId]);
  if (instRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
  const inst = instRes.rows[0];
  if (inst.paid_count >= inst.total_count) {
    await pool.query(`UPDATE installments SET status = 'completed' WHERE id = $1`, [id]);
  }
  res.json(inst);
});

// ---------- Investments ----------
app.get('/investments', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM investments WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
  res.json(result.rows);
});

app.post('/investments', requireAuth, async (req, res) => {
  const {
    title, asset_type, quantity, purchase_unit_price_rial,
    invested_amount_rial, current_value_rial, note,
  } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });

  // If quantity + unit price are given (gold/coin/dollar), derive the totals from them.
  const computedInvested = (quantity != null && purchase_unit_price_rial != null)
    ? Math.round(Number(quantity) * Number(purchase_unit_price_rial))
    : invested_amount_rial;
  if (!computedInvested) return res.status(400).json({ error: 'invested_amount_rial or quantity+purchase_unit_price_rial required' });

  const result = await pool.query(
    `INSERT INTO investments (title, asset_type, quantity, purchase_unit_price_rial, current_unit_price_rial, invested_amount_rial, current_value_rial, note, user_id)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8) RETURNING *`,
    [
      title, asset_type || 'other', quantity ?? null, purchase_unit_price_rial ?? null,
      computedInvested, current_value_rial ?? computedInvested, note || null, req.userId,
    ]
  );
  res.json(result.rows[0]);
});

app.put('/investments/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, quantity, purchase_unit_price_rial, invested_amount_rial, current_value_rial, current_unit_price_rial, note } = req.body || {};
  const client = await pool.connect();
  try {
    let resolvedCurrentValue = current_value_rial;
    if (current_unit_price_rial != null && quantity == null) {
      const invRes = await client.query('SELECT quantity FROM investments WHERE id = $1 AND user_id = $2', [id, req.userId]);
      const existingQuantity = invRes.rows[0]?.quantity;
      if (existingQuantity != null) resolvedCurrentValue = Math.round(Number(existingQuantity) * Number(current_unit_price_rial));
    }
    const result = await client.query(
      `UPDATE investments SET
         title = COALESCE($1, title),
         quantity = COALESCE($2, quantity),
         purchase_unit_price_rial = COALESCE($3, purchase_unit_price_rial),
         invested_amount_rial = COALESCE($4, invested_amount_rial),
         current_value_rial = COALESCE($5, current_value_rial),
         current_unit_price_rial = COALESCE($6, current_unit_price_rial),
         note = COALESCE($7, note),
         updated_at = now()
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [title ?? null, quantity ?? null, purchase_unit_price_rial ?? null, invested_amount_rial ?? null, resolvedCurrentValue ?? null, current_unit_price_rial ?? null, note ?? null, id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

// ---------- Debts & receivables ----------
app.get('/debts', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM debts WHERE deleted_at IS NULL AND user_id = $1 ORDER BY status, due_date NULLS LAST', [req.userId]);
  res.json(result.rows);
});

app.get('/debts/trash', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM debts WHERE deleted_at IS NOT NULL AND user_id = $1 ORDER BY deleted_at DESC', [req.userId]);
  res.json(result.rows);
});

app.post('/debts', requireAuth, async (req, res) => {
  const { type, person_name, amount_rial, due_date, note } = req.body || {};
  if (!['i_owe', 'owed_to_me'].includes(type) || !person_name || !amount_rial) {
    return res.status(400).json({ error: 'type, person_name and amount_rial are required' });
  }
  const result = await pool.query(
    `INSERT INTO debts (type, person_name, amount_rial, due_date, note, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [type, person_name, amount_rial, due_date || null, note || null, req.userId]
  );
  res.json(result.rows[0]);
});

app.put('/debts/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { person_name, amount_rial, due_date, status, note } = req.body || {};
  const result = await pool.query(
    `UPDATE debts SET
       person_name = COALESCE($1, person_name),
       amount_rial = COALESCE($2, amount_rial),
       due_date = COALESCE($3, due_date),
       status = COALESCE($4, status),
       note = COALESCE($5, note)
     WHERE id = $6 AND user_id = $7 AND deleted_at IS NULL RETURNING *`,
    [person_name ?? null, amount_rial ?? null, due_date ?? null, status ?? null, note ?? null, id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.delete('/debts/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE debts SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
    [id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// Partial or full repayment against an existing debt/receivable: subtracts the
// amount and auto-settles once it reaches zero, instead of always marking done.
app.post('/debts/:id/repay', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { amount_rial } = req.body || {};
  if (!amount_rial) return res.status(400).json({ error: 'amount_rial is required' });
  const debtRes = await pool.query('SELECT * FROM debts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, req.userId]);
  if (debtRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
  const debt = debtRes.rows[0];
  const remaining = Math.max(0, Number(debt.amount_rial) - Number(amount_rial));
  const result = await pool.query(
    `UPDATE debts SET amount_rial = $1, status = $2 WHERE id = $3 RETURNING *`,
    [remaining, remaining === 0 ? 'settled' : debt.status, id]
  );
  res.json(result.rows[0]);
});

// Adds another loan amount onto an existing open debt/receivable, instead of
// always creating a brand-new record for the same person (e.g. a second loan
// to someone you already owe/are owed by should grow that one debt, not fork it).
app.post('/debts/:id/add', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { amount_rial } = req.body || {};
  if (!amount_rial) return res.status(400).json({ error: 'amount_rial is required' });
  const debtRes = await pool.query('SELECT * FROM debts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, req.userId]);
  if (debtRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
  const debt = debtRes.rows[0];
  const result = await pool.query(
    `UPDATE debts SET amount_rial = $1, status = 'open' WHERE id = $2 RETURNING *`,
    [Number(debt.amount_rial) + Number(amount_rial), id]
  );
  res.json(result.rows[0]);
});

app.post('/debts/:id/restore', requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE debts SET deleted_at = NULL WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING *',
    [id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

// ---------- Reminders module: a generic reminder system. Installments, debts, bills,
// etc. are all just entries tagged with a "module" label so they show up in one place. ----------
app.get('/reminders', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM reminders WHERE deleted_at IS NULL AND user_id = $1 ORDER BY sent ASC, remind_at ASC`,
    [req.userId]
  );
  res.json(result.rows);
});

app.get('/reminders/trash', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM reminders WHERE deleted_at IS NOT NULL AND user_id = $1 ORDER BY deleted_at DESC', [req.userId]);
  res.json(result.rows);
});

app.post('/reminders', requireAuth, async (req, res) => {
  const { module, title, note, remind_at } = req.body || {};
  if (!title || !remind_at) return res.status(400).json({ error: 'title and remind_at are required' });
  const result = await pool.query(
    `INSERT INTO reminders (module, title, note, remind_at, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [module || 'عمومی', title, note || null, remind_at, req.userId]
  );
  res.json(result.rows[0]);
});

app.put('/reminders/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { module, title, note, remind_at } = req.body || {};
  const result = await pool.query(
    `UPDATE reminders SET
       module = COALESCE($1, module),
       title = COALESCE($2, title),
       note = COALESCE($3, note),
       remind_at = COALESCE($4, remind_at),
       sent = false
     WHERE id = $5 AND user_id = $6 AND deleted_at IS NULL RETURNING *`,
    [module ?? null, title ?? null, note ?? null, remind_at ?? null, id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.delete('/reminders/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE reminders SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
    [id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

app.post('/reminders/:id/restore', requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE reminders SET deleted_at = NULL WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING *',
    [id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.get('/health', (req, res) => res.json({ ok: true }));

const TRANSFER_CATEGORY_NAME = 'انتقال وجه بین حساب';
const INSTALLMENT_REMINDER_LEAD_DAYS = 3;

app.get('/net-worth/history', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT net_worth_rial, cash_rial, investments_rial, debts_rial, created_at
     FROM net_worth_snapshots WHERE user_id = $1 ORDER BY created_at ASC LIMIT 400`,
    [req.userId]
  );
  res.json(result.rows);
});

// Surfaces things that need a human look: transactions nobody categorized,
// bank SMS the parser couldn't read, and transactions still flagged as
// probable duplicates -- instead of these silently sitting unnoticed.
app.get('/data-quality', requireAuth, async (req, res) => {
  const [uncategorized, unparsedSms, duplicates] = await Promise.all([
    pool.query(
      `SELECT t.id, t.amount_rial, t.direction, t.created_at, a.display_name AS account_name
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.status = 'confirmed' AND t.category_id IS NULL
       ORDER BY t.created_at DESC LIMIT 50`,
      [req.userId]
    ),
    pool.query(
      `SELECT id, bank_code, raw_text, created_at FROM unparsed_sms WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    ),
    pool.query(
      `SELECT t.id, t.amount_rial, t.direction, t.created_at, t.note, a.display_name AS account_name
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.note LIKE '%تکراری%'
       ORDER BY t.created_at DESC LIMIT 50`,
      [req.userId]
    ),
  ]);
  res.json({
    uncategorized: uncategorized.rows,
    unparsed_sms: unparsedSms.rows,
    duplicate_flagged: duplicates.rows,
  });
});

app.delete('/unparsed-sms/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM unparsed_sms WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// A tiny, read-only summary endpoint for an iOS Shortcuts home-screen widget --
// identified by api_key like the SMS webhook, since a widget can't hold a login
// session. Keep this response minimal; it's meant to be glanced at, not browsed.
app.get('/widget/summary/:apiKey', async (req, res) => {
  const user = await resolveUserByApiKey(req.params.apiKey);
  if (!user) return res.status(401).json({ error: 'invalid api key' });
  const [accRes, invRes, instRes, debtRes] = await Promise.all([
    pool.query('SELECT COALESCE(SUM(balance_rial),0) AS s FROM accounts WHERE user_id = $1', [user.id]),
    pool.query('SELECT COALESCE(SUM(current_value_rial),0) AS s FROM investments WHERE user_id = $1', [user.id]),
    pool.query(
      `SELECT COALESCE(SUM(installment_amount_rial * (total_count - paid_count)),0) AS s
       FROM installments WHERE status = 'active' AND user_id = $1`,
      [user.id]
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(amount_rial) FILTER (WHERE type = 'i_owe'), 0) AS i_owe,
         COALESCE(SUM(amount_rial) FILTER (WHERE type = 'owed_to_me'), 0) AS owed_to_me
       FROM debts WHERE status = 'open' AND deleted_at IS NULL AND user_id = $1`,
      [user.id]
    ),
  ]);
  const cash = Number(accRes.rows[0].s);
  const investments = Number(invRes.rows[0].s);
  const remainingInstallments = Number(instRes.rows[0].s);
  const iOwe = Number(debtRes.rows[0].i_owe);
  const owedToMe = Number(debtRes.rows[0].owed_to_me);
  res.json({
    cash_rial: cash,
    net_worth_rial: cash + investments + owedToMe - remainingInstallments - iOwe,
    cash_toman: Math.round(cash / 10),
    net_worth_toman: Math.round((cash + investments + owedToMe - remainingInstallments - iOwe) / 10),
  });
});

async function sendPeriodReport(title, sinceDate, untilDate, userId, topic) {
  const txRes = await pool.query(
    `SELECT t.*, c.name AS category_name FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.status = 'confirmed' AND t.user_id = $1 AND t.created_at >= $2 AND t.created_at < $3
       AND (c.name IS NULL OR c.name != $4)`,
    [userId, sinceDate, untilDate, TRANSFER_CATEGORY_NAME]
  );
  const rows = txRes.rows;
  const expense = rows.filter((t) => t.direction === 'expense').reduce((s, t) => s + Number(t.amount_rial), 0);
  const income = rows.filter((t) => t.direction === 'income').reduce((s, t) => s + Number(t.amount_rial), 0);

  const byCategory = {};
  rows.filter((t) => t.direction === 'expense').forEach((t) => {
    const name = t.category_name || 'بدون دسته';
    byCategory[name] = (byCategory[name] || 0) + Number(t.amount_rial);
  });
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  const lines = [
    `⬇️ هزینه: ${fmt(toToman(expense))} ریال`,
    `⬆️ درآمد: ${fmt(toToman(income))} ریال`,
  ];
  if (topCategory) lines.push(`بیشترین هزینه: ${topCategory[0]} (${fmt(toToman(topCategory[1]))} ریال)`);

  await sendNtfy({ title, message: lines.join('\n'), priority: 4, tags: ['bar_chart'], topic });
}

// ---------- Daily: installment due reminder + monthly report on the 1st of the Jalali month (08:00 Asia/Tehran) ----------
// Loops over every user so each person's reminders/reports go to their own data and their own ntfy topic.
cron.schedule('0 8 * * *', async () => {
  try {
    const now = new Date();
    const { jy, jm, jd } = jalaali.toJalaali(now);
    const usersRes = await pool.query('SELECT * FROM users');
    for (const user of usersRes.rows) {
      const topic = user.ntfy_topic;
      const dueRes = await pool.query(
        `SELECT * FROM installments WHERE status = 'active' AND due_day_of_month = $1 AND user_id = $2`,
        [jd, user.id]
      );
      for (const inst of dueRes.rows) {
        await sendNtfy({
          title: '📅 یادآور قسط',
          message: `امروز موعد قسط «${inst.title}» است: ${fmt(toToman(inst.installment_amount_rial))} ریال (قسط ${inst.paid_count + 1} از ${inst.total_count})`,
          priority: 5,
          tags: ['warning', 'calendar'],
          topic,
        });
      }

      // Early heads-up 3 days before the due day too, not just on the day itself.
      const daysInMonth = jalaali.jalaaliMonthLength(jy, jm);
      let dueSoonDay = jd + INSTALLMENT_REMINDER_LEAD_DAYS;
      if (dueSoonDay > daysInMonth) dueSoonDay -= daysInMonth;
      const dueSoonRes = await pool.query(
        `SELECT * FROM installments WHERE status = 'active' AND due_day_of_month = $1 AND user_id = $2`,
        [dueSoonDay, user.id]
      );
      for (const inst of dueSoonRes.rows) {
        await sendNtfy({
          title: '📅 یادآور زودهنگام قسط',
          message: `${INSTALLMENT_REMINDER_LEAD_DAYS} روز دیگه موعد قسط «${inst.title}» است: ${fmt(toToman(inst.installment_amount_rial))} ریال (قسط ${inst.paid_count + 1} از ${inst.total_count})`,
          priority: 3,
          tags: ['calendar'],
          topic,
        });
      }

      // Daily net-worth snapshot, for the growth-over-time chart.
      const [accRes, invRes, instRes, debtRes] = await Promise.all([
        pool.query('SELECT COALESCE(SUM(balance_rial),0) AS s FROM accounts WHERE user_id = $1', [user.id]),
        pool.query(`SELECT COALESCE(SUM(current_value_rial),0) AS s FROM investments WHERE user_id = $1`, [user.id]),
        pool.query(
          `SELECT COALESCE(SUM(installment_amount_rial * (total_count - paid_count)),0) AS s
           FROM installments WHERE status = 'active' AND user_id = $1`,
          [user.id]
        ),
        pool.query(
          `SELECT
             COALESCE(SUM(amount_rial) FILTER (WHERE type = 'i_owe'), 0) AS i_owe,
             COALESCE(SUM(amount_rial) FILTER (WHERE type = 'owed_to_me'), 0) AS owed_to_me
           FROM debts WHERE status = 'open' AND deleted_at IS NULL AND user_id = $1`,
          [user.id]
        ),
      ]);
      const cash = Number(accRes.rows[0].s);
      const investments = Number(invRes.rows[0].s);
      const remainingInstallments = Number(instRes.rows[0].s);
      const iOwe = Number(debtRes.rows[0].i_owe);
      const owedToMe = Number(debtRes.rows[0].owed_to_me);
      const netWorth = cash + investments + owedToMe - remainingInstallments - iOwe;
      await pool.query(
        `INSERT INTO net_worth_snapshots (user_id, net_worth_rial, cash_rial, investments_rial, debts_rial) VALUES ($1, $2, $3, $4, $5)`,
        [user.id, netWorth, cash, investments, remainingInstallments + iOwe]
      );

      if (jd === 1) {
        const prevJy = jm === 1 ? jy - 1 : jy;
        const prevJm = jm === 1 ? 12 : jm - 1;
        const since = jalaali.toGregorian(prevJy, prevJm, 1);
        const until = jalaali.toGregorian(jy, jm, 1);
        await sendPeriodReport(
          '📊 گزارش ماه گذشته',
          new Date(since.gy, since.gm - 1, since.gd),
          new Date(until.gy, until.gm - 1, until.gd),
          user.id,
          topic
        );
      }

      // Salary check: pay period for a Jalali month runs from the last few days of the
      // previous month through day 2 of the current month. Warn on day 3 if nothing landed.
      if (jd === 3) {
        const prevJy = jm === 1 ? jy - 1 : jy;
        const prevJm = jm === 1 ? 12 : jm - 1;
        const prevMonthLength = jalaali.jalaaliMonthLength(prevJy, prevJm);
        const windowStart = jalaali.toGregorian(prevJy, prevJm, prevMonthLength);
        const windowEndG = jalaali.toGregorian(jy, jm, 3);
        const since = new Date(windowStart.gy, windowStart.gm - 1, windowStart.gd);
        const until = new Date(windowEndG.gy, windowEndG.gm - 1, windowEndG.gd);
        const salaryRes = await pool.query(
          `SELECT t.id FROM transactions t
           JOIN categories c ON c.id = t.category_id
           WHERE t.deleted_at IS NULL AND t.user_id = $1 AND t.direction = 'income' AND c.name = 'درآمد کار'
             AND t.created_at >= $2 AND t.created_at < $3`,
          [user.id, since, until]
        );
        if (salaryRes.rows.length === 0) {
          await sendNtfy({
            title: '⚠️ حقوق دریافت نشده؟',
            message: `تا الان (روز ۳ ماه) هیچ تراکنش «درآمد کار»ی برای این دوره ثبت نشده. اگه حقوقت اومده، توی برنامه ثبتش کن.`,
            priority: 4,
            tags: ['warning'],
            topic,
          });
        }
      }

      // Low balance check
      const accountsRes = await pool.query(
        `SELECT * FROM accounts WHERE user_id = $1 AND low_balance_threshold_rial IS NOT NULL AND balance_rial < low_balance_threshold_rial`,
        [user.id]
      );
      for (const acc of accountsRes.rows) {
        await sendNtfy({
          title: '🔴 موجودی کم',
          message: `حساب ${acc.display_name} از حد هشدار موجودی که تعیین کردی پایین‌تر رفته.`,
          priority: 4,
          tags: ['warning'],
          topic,
        });
      }

      // Debt/receivable due reminders
      const debtsRes = await pool.query(
        `SELECT * FROM debts WHERE deleted_at IS NULL AND status = 'open' AND due_date IS NOT NULL AND due_date <= CURRENT_DATE AND user_id = $1`,
        [user.id]
      );
      for (const debt of debtsRes.rows) {
        const label = debt.type === 'i_owe' ? `بدهی به ${debt.person_name}` : `طلب از ${debt.person_name}`;
        await sendNtfy({
          title: '💰 یادآور بدهی/طلب',
          message: `${label}: ${fmt(toToman(debt.amount_rial))} ریال — سررسید گذشته یا امروزه`,
          priority: 4,
          tags: ['moneybag'],
          topic,
        });
      }
    }
  } catch (err) {
    console.error('cron error', err);
  }
});

// ---------- Reminders: check every 5 minutes for due, unsent reminders ----------
cron.schedule('*/5 * * * *', async () => {
  try {
    const dueRes = await pool.query(
      `SELECT r.*, u.ntfy_topic FROM reminders r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.deleted_at IS NULL AND r.sent = false AND r.remind_at <= now()`
    );
    for (const r of dueRes.rows) {
      await sendNtfy({
        title: `⏰ یادآوری (${r.module})`,
        message: r.note ? `${r.title}\n${r.note}` : r.title,
        priority: 5,
        tags: ['alarm_clock'],
        topic: r.ntfy_topic,
      });
      await pool.query('UPDATE reminders SET sent = true WHERE id = $1', [r.id]);
    }
  } catch (err) {
    console.error('reminders cron error', err);
  }
});

// ---------- Weekly report, Saturday mornings (08:00 Asia/Tehran) ----------
cron.schedule('0 8 * * 6', async () => {
  try {
    const until = new Date();
    const since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);
    const usersRes = await pool.query('SELECT * FROM users');
    for (const user of usersRes.rows) {
      await sendPeriodReport('📊 گزارش هفته گذشته', since, until, user.id, user.ntfy_topic);
    }
  } catch (err) {
    console.error('cron error', err);
  }
});

// ---------- Auto-update gold/dollar/coin investment prices from BrsApi (free market rates) ----------
// Requires BRSAPI_KEY in .env; get a free key at https://brsapi.ir/tsetmc-exchange-free-bourse-api-key-request/
const ASSET_TYPE_TO_BRSAPI_SYMBOL = {
  dollar: 'USD',
  gold: 'IR_GOLD_18K',
  coin: 'IR_COIN_EMAMI',
};

async function updateInvestmentPrices() {
  if (!process.env.BRSAPI_KEY) return;
  try {
    // BrsApi's firewall blocks default runtime User-Agents (Node/Python/Go) and can
    // temporarily ban the IP; a real browser User-Agent is required.
    const res = await fetch(`https://Api.BrsApi.ir/Market/Gold_Currency.php?key=${process.env.BRSAPI_KEY}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
    });
    const data = await res.json();
    const allItems = [...(data.gold || []), ...(data.currency || [])];
    const priceBySymbol = {};
    allItems.forEach((item) => { priceBySymbol[item.symbol] = item.price; });

    // Applies to every user's investments alike -- market prices aren't per-user.
    const investmentsRes = await pool.query(
      `SELECT * FROM investments WHERE asset_type IN ('dollar','gold','coin') AND quantity IS NOT NULL`
    );
    for (const inv of investmentsRes.rows) {
      const symbol = ASSET_TYPE_TO_BRSAPI_SYMBOL[inv.asset_type];
      const tomanPrice = priceBySymbol[symbol];
      if (!tomanPrice) continue;
      const currentUnitPriceRial = Math.round(Number(tomanPrice) * 10);
      const currentValueRial = Math.round(Number(inv.quantity) * currentUnitPriceRial);
      await pool.query(
        `UPDATE investments SET current_unit_price_rial = $1, current_value_rial = $2, updated_at = now() WHERE id = $3`,
        [currentUnitPriceRial, currentValueRial, inv.id]
      );
    }
  } catch (err) {
    console.error('investment price update error', err);
  }
}

// Every hour from 8am to 11pm (no point polling overnight when nobody's looking)
cron.schedule('0 8-23 * * *', updateInvestmentPrices);

app.post('/investments/refresh-prices', requireAuth, async (req, res) => {
  if (!process.env.BRSAPI_KEY) return res.status(400).json({ error: 'BRSAPI_KEY not configured' });
  await updateInvestmentPrices();
  const result = await pool.query('SELECT * FROM investments WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
  res.json(result.rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`api listening on ${PORT}`));
