const express = require('express');
const { Pool } = require('pg');
const cron = require('node-cron');
const jalaali = require('jalaali-js');

const { parseSms } = require('./parsers');
const { sendNtfy } = require('./ntfy');

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(express.json());

function toToman(rial) {
  return Math.round(rial / 10);
}

function fmt(n) {
  return n.toLocaleString('en-US');
}

// ---------- Webhook: incoming bank SMS ----------
app.post('/webhook/sms', async (req, res) => {
  // iOS Shortcuts auto-capitalizes single-word field names (e.g. "Text"), so match keys case-insensitively.
  const body = {};
  for (const [k, v] of Object.entries(req.body || {})) body[k.toLowerCase()] = v;
  const bank = body.bank?.toLowerCase();
  const text = body.text;
  if (!bank || !text) return res.status(400).json({ error: 'bank and text are required' });

  const client = await pool.connect();
  try {
    const accountRes = await client.query('SELECT * FROM accounts WHERE bank_code = $1', [bank]);
    if (accountRes.rows.length === 0) {
      return res.status(404).json({ error: `unknown bank code: ${bank}` });
    }
    const account = accountRes.rows[0];
    const parsed = parseSms(bank, text);

    if (!parsed) {
      // dead-letter: could not parse, still store raw text so nothing is lost
      const insertRes = await client.query(
        `INSERT INTO transactions (account_id, amount_rial, direction, raw_text, status)
         VALUES ($1, 0, 'expense', $2, 'pending') RETURNING id`,
        [account.id, text]
      );
      await sendNtfy({
        title: `⚠️ پیامک ${account.display_name} پارس نشد`,
        message: text,
        priority: 4,
        tags: ['warning'],
      });
      return res.json({ ok: true, parsed: false, transaction_id: insertRes.rows[0].id });
    }

    const { amount_rial, direction, balance_after_rial } = parsed;
    const newBalance = balance_after_rial != null
      ? balance_after_rial
      : direction === 'income'
        ? account.balance_rial + amount_rial
        : account.balance_rial - amount_rial;

    await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [newBalance, account.id]);

    const txRes = await client.query(
      `INSERT INTO transactions (account_id, amount_rial, direction, balance_after_rial, raw_text, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
      [account.id, amount_rial, direction, newBalance, text]
    );
    const txId = txRes.rows[0].id;

    // check for matching installments (only for expenses)
    let matches = [];
    if (direction === 'expense') {
      const matchRes = await client.query(
        `SELECT id, title FROM installments
         WHERE status = 'active' AND installment_amount_rial = $1 AND paid_count < total_count`,
        [amount_rial]
      );
      matches = matchRes.rows;
    }

    const directionLabel = direction === 'income' ? 'واریز' : 'برداشت';
    const sign = direction === 'income' ? '🟢' : '🔴';
    let message = `${sign} ${fmt(toToman(amount_rial))} تومان ${directionLabel} - ${account.display_name}\nموجودی: ${fmt(toToman(newBalance))} تومان`;

    const actions = [];
    if (matches.length === 1) {
      message += `\n\nاحتمالاً قسط «${matches[0].title}» بود.`;
      actions.push({
        action: 'http',
        label: 'بله قسط بود',
        url: `${PUBLIC_BASE_URL}/api/transactions/${txId}/confirm-installment?installment_id=${matches[0].id}`,
        method: 'POST',
        clear: true,
      });
    } else if (matches.length > 1) {
      message += `\n\nچند قسط با این مبلغ پیدا شد: ${matches.map((m) => m.title).join(', ')}`;
      matches.slice(0, 2).forEach((m) => {
        actions.push({
          action: 'http',
          label: m.title,
          url: `${PUBLIC_BASE_URL}/api/transactions/${txId}/confirm-installment?installment_id=${m.id}`,
          method: 'POST',
          clear: true,
        });
      });
    }
    actions.push({ action: 'view', label: 'دسته‌بندی', url: `${PUBLIC_BASE_URL}/#/tx/${txId}` });

    await sendNtfy({ title: 'تراکنش جدید', message, actions, priority: 4 });

    res.json({ ok: true, parsed: true, transaction_id: txId, new_balance_rial: newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  } finally {
    client.release();
  }
});

// ---------- Transactions ----------
app.get('/transactions', async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE t.status = $1';
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

app.post('/transactions/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const { category_id, note } = req.body || {};
  const result = await pool.query(
    `UPDATE transactions SET category_id = $1, note = $2, status = 'confirmed' WHERE id = $3 RETURNING *`,
    [category_id || null, note || null, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.post('/transactions/:id/confirm-installment', async (req, res) => {
  const { id } = req.params;
  const installmentId = req.query.installment_id || req.body?.installment_id;
  if (!installmentId) return res.status(400).json({ error: 'installment_id required' });

  const client = await pool.connect();
  try {
    const catRes = await client.query(`SELECT id FROM categories WHERE name = 'قسط' AND direction = 'expense'`);
    const categoryId = catRes.rows[0]?.id || null;

    const txRes = await client.query(
      `UPDATE transactions SET category_id = $1, status = 'confirmed', installment_id = $2 WHERE id = $3 RETURNING *`,
      [categoryId, installmentId, id]
    );
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'transaction not found' });

    const instRes = await client.query(
      `UPDATE installments SET paid_count = paid_count + 1 WHERE id = $1 RETURNING *`,
      [installmentId]
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
app.get('/accounts', async (req, res) => {
  const result = await pool.query('SELECT * FROM accounts ORDER BY id');
  res.json(result.rows);
});

// ---------- Categories ----------
app.get('/categories', async (req, res) => {
  const result = await pool.query('SELECT * FROM categories WHERE is_active = true ORDER BY direction, name');
  res.json(result.rows);
});

app.post('/categories', async (req, res) => {
  const { name, direction } = req.body || {};
  if (!name || !['expense', 'income'].includes(direction)) {
    return res.status(400).json({ error: 'name and valid direction are required' });
  }
  const result = await pool.query(
    'INSERT INTO categories (name, direction) VALUES ($1, $2) RETURNING *',
    [name, direction]
  );
  res.json(result.rows[0]);
});

app.put('/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body || {};
  const result = await pool.query(
    `UPDATE categories SET name = COALESCE($1, name), is_active = COALESCE($2, is_active) WHERE id = $3 RETURNING *`,
    [name ?? null, is_active ?? null, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

// ---------- Installments / Loans ----------
app.get('/installments', async (req, res) => {
  const result = await pool.query('SELECT * FROM installments ORDER BY status, due_day_of_month');
  res.json(result.rows);
});

app.post('/installments', async (req, res) => {
  const { title, type, total_amount_rial, installment_amount_rial, total_count, due_day_of_month, note } = req.body || {};
  if (!title || !installment_amount_rial || !total_count || !due_day_of_month) {
    return res.status(400).json({ error: 'missing required fields' });
  }
  const result = await pool.query(
    `INSERT INTO installments (title, type, total_amount_rial, installment_amount_rial, total_count, due_day_of_month, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [title, type || 'installment', total_amount_rial || null, installment_amount_rial, total_count, due_day_of_month, note || null]
  );
  res.json(result.rows[0]);
});

app.post('/installments/:id/pay', async (req, res) => {
  const { id } = req.params;
  const instRes = await pool.query('UPDATE installments SET paid_count = paid_count + 1 WHERE id = $1 RETURNING *', [id]);
  if (instRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
  const inst = instRes.rows[0];
  if (inst.paid_count >= inst.total_count) {
    await pool.query(`UPDATE installments SET status = 'completed' WHERE id = $1`, [id]);
  }
  res.json(inst);
});

// ---------- Investments ----------
app.get('/investments', async (req, res) => {
  const result = await pool.query('SELECT * FROM investments ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/investments', async (req, res) => {
  const { title, invested_amount_rial, current_value_rial, note } = req.body || {};
  if (!title || !invested_amount_rial) return res.status(400).json({ error: 'missing required fields' });
  const result = await pool.query(
    `INSERT INTO investments (title, invested_amount_rial, current_value_rial, note)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [title, invested_amount_rial, current_value_rial ?? invested_amount_rial, note || null]
  );
  res.json(result.rows[0]);
});

app.put('/investments/:id', async (req, res) => {
  const { id } = req.params;
  const { current_value_rial, note } = req.body || {};
  const result = await pool.query(
    `UPDATE investments SET current_value_rial = COALESCE($1, current_value_rial), note = COALESCE($2, note), updated_at = now() WHERE id = $3 RETURNING *`,
    [current_value_rial ?? null, note ?? null, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ---------- Daily installment due reminder (08:00 Asia/Tehran) ----------
cron.schedule('0 8 * * *', async () => {
  try {
    const now = new Date();
    const { jd } = jalaali.toJalaali(now);
    const dueRes = await pool.query(
      `SELECT * FROM installments WHERE status = 'active' AND due_day_of_month = $1`,
      [jd]
    );
    for (const inst of dueRes.rows) {
      await sendNtfy({
        title: '📅 یادآور قسط',
        message: `امروز موعد قسط «${inst.title}» است: ${fmt(toToman(inst.installment_amount_rial))} تومان (قسط ${inst.paid_count + 1} از ${inst.total_count})`,
        priority: 5,
        tags: ['warning', 'calendar'],
      });
    }
  } catch (err) {
    console.error('cron error', err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`api listening on ${PORT}`));
