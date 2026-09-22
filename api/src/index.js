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

function toToman(rial) {
  return Math.round(rial);
}

function fmt(n) {
  return n.toLocaleString('en-US');
}

// Fires immediately whenever a balance changes, instead of waiting for the daily cron.
async function checkLowBalance(accountId) {
  try {
    const res = await pool.query(
      'SELECT * FROM accounts WHERE id = $1 AND low_balance_threshold_rial IS NOT NULL AND balance_rial < low_balance_threshold_rial',
      [accountId]
    );
    for (const acc of res.rows) {
      await sendNtfy({
        title: '🔴 موجودی کم',
        message: `حساب ${acc.display_name} از حد هشدار موجودی که تعیین کردی پایین‌تر رفته.`,
        priority: 4,
        tags: ['warning'],
      });
    }
  } catch (err) {
    console.error('low balance check error', err);
  }
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
      // Not a transaction SMS (or couldn't be parsed) -- just alert with the raw text
      // instead of creating a fake zero-amount transaction that clutters the pending list.
      await sendNtfy({
        title: `⚠️ پیامک ${account.display_name} پارس نشد`,
        message: text,
        priority: 4,
        tags: ['warning'],
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
  let where = 'WHERE t.deleted_at IS NULL';
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

app.get('/transactions/trash', async (req, res) => {
  const result = await pool.query(
    `SELECT t.*, a.display_name AS account_name, c.name AS category_name
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.deleted_at IS NOT NULL
     ORDER BY t.deleted_at DESC
     LIMIT 100`
  );
  res.json(result.rows);
});

// Manual entry: for when the automatic SMS webhook doesn't fire.
app.post('/transactions/manual', async (req, res) => {
  const { account_id, amount_rial, direction, category_id, note, tags } = req.body || {};
  if (!account_id || !amount_rial || !['expense', 'income'].includes(direction)) {
    return res.status(400).json({ error: 'account_id, amount_rial and direction are required' });
  }
  const client = await pool.connect();
  try {
    const accountRes = await client.query('SELECT * FROM accounts WHERE id = $1', [account_id]);
    if (accountRes.rows.length === 0) return res.status(404).json({ error: 'account not found' });
    const account = accountRes.rows[0];

    const newBalance = direction === 'income'
      ? account.balance_rial + Number(amount_rial)
      : account.balance_rial - Number(amount_rial);
    await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [newBalance, account_id]);
    checkLowBalance(account_id);

    const txRes = await client.query(
      `INSERT INTO transactions (account_id, amount_rial, direction, balance_after_rial, raw_text, status, category_id, note, tags)
       VALUES ($1, $2, $3, $4, 'manual entry', 'confirmed', $5, $6, $7) RETURNING *`,
      [account_id, amount_rial, direction, newBalance, category_id || null, note || null, tags || null]
    );
    res.json(txRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  } finally {
    client.release();
  }
});

// Soft-delete a transaction (reverses its balance effect; recoverable via /restore).
app.delete('/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const tx = txRes.rows[0];

    const accountRes = await client.query('SELECT * FROM accounts WHERE id = $1', [tx.account_id]);
    const account = accountRes.rows[0];
    const revertedBalance = tx.direction === 'income'
      ? Number(account.balance_rial) - Number(tx.amount_rial)
      : Number(account.balance_rial) + Number(tx.amount_rial);
    await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [revertedBalance, tx.account_id]);
    await client.query('UPDATE transactions SET deleted_at = now() WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  } finally {
    client.release();
  }
});

// Restore a soft-deleted transaction (re-applies its balance effect).
app.post('/transactions/:id/restore', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const tx = txRes.rows[0];

    const accountRes = await client.query('SELECT * FROM accounts WHERE id = $1', [tx.account_id]);
    const account = accountRes.rows[0];
    const restoredBalance = tx.direction === 'income'
      ? Number(account.balance_rial) + Number(tx.amount_rial)
      : Number(account.balance_rial) - Number(tx.amount_rial);
    await client.query('UPDATE accounts SET balance_rial = $1 WHERE id = $2', [restoredBalance, tx.account_id]);
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
app.put('/transactions/:id/edit', async (req, res) => {
  const { id } = req.params;
  const { amount_rial, direction, account_id, category_id, note, tags } = req.body || {};
  const client = await pool.connect();
  try {
    const txRes = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const tx = txRes.rows[0];

    const newAmount = amount_rial != null ? Number(amount_rial) : Number(tx.amount_rial);
    const newDirection = direction || tx.direction;
    const newAccountId = account_id != null ? Number(account_id) : tx.account_id;

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

app.post('/transactions/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const { category_id, note, tags } = req.body || {};
  const result = await pool.query(
    `UPDATE transactions SET category_id = $1, note = $2, status = 'confirmed', tags = COALESCE($3, tags) WHERE id = $4 RETURNING *`,
    [category_id || null, note || null, tags || null, id]
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

app.post('/accounts', async (req, res) => {
  const { display_name, balance_rial, card_number, account_number, iban, cvv2, expiry, low_balance_threshold_rial } = req.body || {};
  if (!display_name) return res.status(400).json({ error: 'display_name is required' });
  const bank_code = `manual-${Date.now()}`;
  const result = await pool.query(
    `INSERT INTO accounts (bank_code, display_name, balance_rial, card_number, account_number, iban, cvv2, expiry, low_balance_threshold_rial)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [bank_code, display_name, balance_rial || 0, card_number || null, account_number || null, iban || null, cvv2 || null, expiry || null, low_balance_threshold_rial || null]
  );
  res.json(result.rows[0]);
});

app.put('/accounts/:id', async (req, res) => {
  const { id } = req.params;
  const { display_name, balance_rial, card_number, account_number, iban, cvv2, expiry, low_balance_threshold_rial } = req.body || {};
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
     WHERE id = $9 RETURNING *`,
    [display_name ?? null, balance_rial ?? null, card_number ?? null, account_number ?? null, iban ?? null, cvv2 ?? null, expiry ?? null, low_balance_threshold_rial ?? null, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  if (balance_rial != null || low_balance_threshold_rial != null) await checkLowBalance(id);
  res.json(result.rows[0]);
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
  const result = await pool.query('SELECT * FROM installments WHERE deleted_at IS NULL ORDER BY status, due_day_of_month');
  res.json(result.rows);
});

app.get('/installments/trash', async (req, res) => {
  const result = await pool.query('SELECT * FROM installments WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
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

app.put('/installments/:id', async (req, res) => {
  const { id } = req.params;
  const { title, installment_amount_rial, total_count, due_day_of_month, note } = req.body || {};
  const result = await pool.query(
    `UPDATE installments SET
       title = COALESCE($1, title),
       installment_amount_rial = COALESCE($2, installment_amount_rial),
       total_count = COALESCE($3, total_count),
       due_day_of_month = COALESCE($4, due_day_of_month),
       note = COALESCE($5, note)
     WHERE id = $6 RETURNING *`,
    [title ?? null, installment_amount_rial ?? null, total_count ?? null, due_day_of_month ?? null, note ?? null, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.delete('/installments/:id', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE installments SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
    [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

app.post('/installments/:id/restore', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE installments SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
    [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
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
    `INSERT INTO investments (title, asset_type, quantity, purchase_unit_price_rial, current_unit_price_rial, invested_amount_rial, current_value_rial, note)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $7) RETURNING *`,
    [
      title, asset_type || 'other', quantity ?? null, purchase_unit_price_rial ?? null,
      computedInvested, current_value_rial ?? computedInvested, note || null,
    ]
  );
  res.json(result.rows[0]);
});

app.put('/investments/:id', async (req, res) => {
  const { id } = req.params;
  const { current_value_rial, current_unit_price_rial, note } = req.body || {};
  const client = await pool.connect();
  try {
    let resolvedCurrentValue = current_value_rial;
    if (current_unit_price_rial != null) {
      const invRes = await client.query('SELECT quantity FROM investments WHERE id = $1', [id]);
      const quantity = invRes.rows[0]?.quantity;
      if (quantity != null) resolvedCurrentValue = Math.round(Number(quantity) * Number(current_unit_price_rial));
    }
    const result = await client.query(
      `UPDATE investments SET
         current_value_rial = COALESCE($1, current_value_rial),
         current_unit_price_rial = COALESCE($2, current_unit_price_rial),
         note = COALESCE($3, note),
         updated_at = now()
       WHERE id = $4 RETURNING *`,
      [resolvedCurrentValue ?? null, current_unit_price_rial ?? null, note ?? null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

// ---------- Debts & receivables ----------
app.get('/debts', async (req, res) => {
  const result = await pool.query('SELECT * FROM debts WHERE deleted_at IS NULL ORDER BY status, due_date NULLS LAST');
  res.json(result.rows);
});

app.get('/debts/trash', async (req, res) => {
  const result = await pool.query('SELECT * FROM debts WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(result.rows);
});

app.post('/debts', async (req, res) => {
  const { type, person_name, amount_rial, due_date, note } = req.body || {};
  if (!['i_owe', 'owed_to_me'].includes(type) || !person_name || !amount_rial) {
    return res.status(400).json({ error: 'type, person_name and amount_rial are required' });
  }
  const result = await pool.query(
    `INSERT INTO debts (type, person_name, amount_rial, due_date, note) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [type, person_name, amount_rial, due_date || null, note || null]
  );
  res.json(result.rows[0]);
});

app.put('/debts/:id', async (req, res) => {
  const { id } = req.params;
  const { person_name, amount_rial, due_date, status, note } = req.body || {};
  const result = await pool.query(
    `UPDATE debts SET
       person_name = COALESCE($1, person_name),
       amount_rial = COALESCE($2, amount_rial),
       due_date = COALESCE($3, due_date),
       status = COALESCE($4, status),
       note = COALESCE($5, note)
     WHERE id = $6 AND deleted_at IS NULL RETURNING *`,
    [person_name ?? null, amount_rial ?? null, due_date ?? null, status ?? null, note ?? null, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.delete('/debts/:id', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE debts SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
    [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// Partial or full repayment against an existing debt/receivable: subtracts the
// amount and auto-settles once it reaches zero, instead of always marking done.
app.post('/debts/:id/repay', async (req, res) => {
  const { id } = req.params;
  const { amount_rial } = req.body || {};
  if (!amount_rial) return res.status(400).json({ error: 'amount_rial is required' });
  const debtRes = await pool.query('SELECT * FROM debts WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (debtRes.rows.length === 0) return res.status(404).json({ error: 'not found' });
  const debt = debtRes.rows[0];
  const remaining = Math.max(0, Number(debt.amount_rial) - Number(amount_rial));
  const result = await pool.query(
    `UPDATE debts SET amount_rial = $1, status = $2 WHERE id = $3 RETURNING *`,
    [remaining, remaining === 0 ? 'settled' : debt.status, id]
  );
  res.json(result.rows[0]);
});

app.post('/debts/:id/restore', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE debts SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
    [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

// ---------- Reminders module: a generic reminder system. Installments, debts, bills,
// etc. are all just entries tagged with a "module" label so they show up in one place. ----------
app.get('/reminders', async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM reminders WHERE deleted_at IS NULL ORDER BY sent ASC, remind_at ASC`
  );
  res.json(result.rows);
});

app.get('/reminders/trash', async (req, res) => {
  const result = await pool.query('SELECT * FROM reminders WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(result.rows);
});

app.post('/reminders', async (req, res) => {
  const { module, title, note, remind_at } = req.body || {};
  if (!title || !remind_at) return res.status(400).json({ error: 'title and remind_at are required' });
  const result = await pool.query(
    `INSERT INTO reminders (module, title, note, remind_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [module || 'عمومی', title, note || null, remind_at]
  );
  res.json(result.rows[0]);
});

app.put('/reminders/:id', async (req, res) => {
  const { id } = req.params;
  const { module, title, note, remind_at } = req.body || {};
  const result = await pool.query(
    `UPDATE reminders SET
       module = COALESCE($1, module),
       title = COALESCE($2, title),
       note = COALESCE($3, note),
       remind_at = COALESCE($4, remind_at),
       sent = false
     WHERE id = $5 AND deleted_at IS NULL RETURNING *`,
    [module ?? null, title ?? null, note ?? null, remind_at ?? null, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.delete('/reminders/:id', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE reminders SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
    [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

app.post('/reminders/:id/restore', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE reminders SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
    [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(result.rows[0]);
});

app.get('/health', (req, res) => res.json({ ok: true }));

async function sendPeriodReport(title, sinceDate, untilDate) {
  const txRes = await pool.query(
    `SELECT t.*, c.name AS category_name FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.status = 'confirmed' AND t.created_at >= $1 AND t.created_at < $2
       AND (c.name IS NULL OR c.name != $3)`,
    [sinceDate, untilDate, TRANSFER_CATEGORY_NAME]
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

  await sendNtfy({ title, message: lines.join('\n'), priority: 4, tags: ['bar_chart'] });
}

const TRANSFER_CATEGORY_NAME = 'انتقال وجه بین حساب';

// ---------- Daily: installment due reminder + monthly report on the 1st of the Jalali month (08:00 Asia/Tehran) ----------
cron.schedule('0 8 * * *', async () => {
  try {
    const now = new Date();
    const { jy, jm, jd } = jalaali.toJalaali(now);
    const dueRes = await pool.query(
      `SELECT * FROM installments WHERE status = 'active' AND due_day_of_month = $1`,
      [jd]
    );
    for (const inst of dueRes.rows) {
      await sendNtfy({
        title: '📅 یادآور قسط',
        message: `امروز موعد قسط «${inst.title}» است: ${fmt(toToman(inst.installment_amount_rial))} ریال (قسط ${inst.paid_count + 1} از ${inst.total_count})`,
        priority: 5,
        tags: ['warning', 'calendar'],
      });
    }

    if (jd === 1) {
      const prevJy = jm === 1 ? jy - 1 : jy;
      const prevJm = jm === 1 ? 12 : jm - 1;
      const since = jalaali.toGregorian(prevJy, prevJm, 1);
      const until = jalaali.toGregorian(jy, jm, 1);
      await sendPeriodReport(
        '📊 گزارش ماه گذشته',
        new Date(since.gy, since.gm - 1, since.gd),
        new Date(until.gy, until.gm - 1, until.gd)
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
         WHERE t.deleted_at IS NULL AND t.direction = 'income' AND c.name = 'درآمد کار'
           AND t.created_at >= $1 AND t.created_at < $2`,
        [since, until]
      );
      if (salaryRes.rows.length === 0) {
        await sendNtfy({
          title: '⚠️ حقوق دریافت نشده؟',
          message: `تا الان (روز ۳ ماه) هیچ تراکنش «درآمد کار»ی برای این دوره ثبت نشده. اگه حقوقت اومده، توی برنامه ثبتش کن.`,
          priority: 4,
          tags: ['warning'],
        });
      }
    }

    // Low balance check
    const accountsRes = await pool.query(
      `SELECT * FROM accounts WHERE low_balance_threshold_rial IS NOT NULL AND balance_rial < low_balance_threshold_rial`
    );
    for (const acc of accountsRes.rows) {
      await sendNtfy({
        title: '🔴 موجودی کم',
        message: `حساب ${acc.display_name} از حد هشدار موجودی که تعیین کردی پایین‌تر رفته.`,
        priority: 4,
        tags: ['warning'],
      });
    }

    // Debt/receivable due reminders
    const debtsRes = await pool.query(
      `SELECT * FROM debts WHERE deleted_at IS NULL AND status = 'open' AND due_date IS NOT NULL AND due_date <= CURRENT_DATE`
    );
    for (const debt of debtsRes.rows) {
      const label = debt.type === 'i_owe' ? `بدهی به ${debt.person_name}` : `طلب از ${debt.person_name}`;
      await sendNtfy({
        title: '💰 یادآور بدهی/طلب',
        message: `${label}: ${fmt(toToman(debt.amount_rial))} ریال — سررسید گذشته یا امروزه`,
        priority: 4,
        tags: ['moneybag'],
      });
    }
  } catch (err) {
    console.error('cron error', err);
  }
});

// ---------- Reminders: check every 5 minutes for due, unsent reminders ----------
cron.schedule('*/5 * * * *', async () => {
  try {
    const dueRes = await pool.query(
      `SELECT * FROM reminders WHERE deleted_at IS NULL AND sent = false AND remind_at <= now()`
    );
    for (const r of dueRes.rows) {
      await sendNtfy({
        title: `⏰ یادآوری (${r.module})`,
        message: r.note ? `${r.title}\n${r.note}` : r.title,
        priority: 5,
        tags: ['alarm_clock'],
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
    await sendPeriodReport('📊 گزارش هفته گذشته', since, until);
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
    const res = await fetch(`https://BrsApi.ir/Api/Market/Gold_Currency.php?key=${process.env.BRSAPI_KEY}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
    });
    const data = await res.json();
    const allItems = [...(data.gold || []), ...(data.currency || [])];
    const priceBySymbol = {};
    allItems.forEach((item) => { priceBySymbol[item.symbol] = item.price; });

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

// Every 6 hours
cron.schedule('0 */6 * * *', updateInvestmentPrices);

app.post('/investments/refresh-prices', async (req, res) => {
  if (!process.env.BRSAPI_KEY) return res.status(400).json({ error: 'BRSAPI_KEY not configured' });
  await updateInvestmentPrices();
  const result = await pool.query('SELECT * FROM investments ORDER BY created_at DESC');
  res.json(result.rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`api listening on ${PORT}`));
