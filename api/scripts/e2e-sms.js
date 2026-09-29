// End-to-end check of the bank-SMS webhook against the running API: every sample in
// test/sms-samples.js goes through the real HTTP route, database writes and balance
// update. Runs as a throwaway user (no password, so it can't be logged into) with one
// account per bank, and removes everything it created afterwards.
//
// Usage (inside the api container, while the API is running):
//   node scripts/e2e-sms.js
const crypto = require('crypto');
const { Pool } = require('pg');
const { BANKS } = require('../src/banks');
const { CASES, NOT_TRANSACTIONS, ONE_TIME_PASSWORDS } = require('../test/sms-samples');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const failures = [];
let checks = 0;
const check = (ok, label) => { checks++; if (!ok) failures.push(label); };

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  const suffix = crypto.randomBytes(4).toString('hex');
  const apiKey = crypto.randomBytes(24).toString('hex');
  // Pushes go to a throwaway ntfy topic so no real phone gets test notifications.
  const user = (await db.query(
    'INSERT INTO users (username, password_hash, api_key, ntfy_topic) VALUES ($1, NULL, $2, $3) RETURNING id',
    [`e2e-${suffix}`, apiKey, `pw-e2e-${suffix}`]
  )).rows[0];
  const account = {};
  try {
    const START = 1000000000;
    for (const b of BANKS) {
      account[b.code] = (await db.query(
        'INSERT INTO accounts (bank_code, bank, display_name, balance_rial, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [`e2e-${b.code}-${suffix}`, b.code, b.name, START, user.id]
      )).rows[0];
    }

    // Every sample, through the per-account URL.
    for (const [bank, text, expected] of CASES) {
      const acc = account[bank];
      const before = Number((await db.query('SELECT balance_rial FROM accounts WHERE id = $1', [acc.id])).rows[0].balance_rial);
      const res = await post(`/webhook/sms/${apiKey}/${acc.bank_code}`, { text });
      const label = `${bank}: ${text.split('\n')[0].slice(0, 30)}`;
      check(res.status === 200 && res.body.parsed === true, `${label} -> not parsed (${JSON.stringify(res.body)})`);
      if (!res.body.transaction_id) continue;
      const tx = (await db.query('SELECT * FROM transactions WHERE id = $1', [res.body.transaction_id])).rows[0];
      const after = Number((await db.query('SELECT balance_rial FROM accounts WHERE id = $1', [acc.id])).rows[0].balance_rial);
      const expectedBalance = expected.balance_after_rial ?? (expected.direction === 'income' ? before + expected.amount_rial : before - expected.amount_rial);
      check(Number(tx.amount_rial) === expected.amount_rial, `${label} -> amount ${tx.amount_rial}, expected ${expected.amount_rial}`);
      check(tx.direction === expected.direction, `${label} -> direction ${tx.direction}`);
      check(tx.status === 'pending' && tx.account_id === acc.id && tx.user_id === user.id, `${label} -> wrong status/account/user`);
      check(after === expectedBalance, `${label} -> balance ${after}, expected ${expectedBalance}`);
    }

    // The original route, where the body names the account.
    const legacy = await post(`/webhook/sms/${apiKey}`, { Bank: account.resalat.bank_code, Text: 'e2e\n-12,340\nمانده: 5,000,000' });
    check(legacy.body.parsed === true, `legacy route -> ${JSON.stringify(legacy.body)}`);

    // Retrying the exact same SMS within 5 minutes must not create a second transaction.
    const replay = await post(`/webhook/sms/${apiKey}/${account.resalat.bank_code}`, { text: 'e2e\n-12,340\nمانده: 5,000,000' });
    check(replay.body.idempotent_replay === true, `replay -> ${JSON.stringify(replay.body)}`);

    // One-time passwords: acknowledged, never stored.
    const beforeTx = Number((await db.query('SELECT count(*) FROM transactions WHERE user_id = $1', [user.id])).rows[0].count);
    for (const text of ONE_TIME_PASSWORDS) {
      const res = await post(`/webhook/sms/${apiKey}/${account.mellat.bank_code}`, { text });
      check(res.body.ignored === 'one-time password', `OTP not ignored: ${text.slice(0, 25)}`);
    }
    const afterTx = Number((await db.query('SELECT count(*) FROM transactions WHERE user_id = $1', [user.id])).rows[0].count);
    const otpStored = Number((await db.query(`SELECT count(*) FROM unparsed_sms WHERE user_id = $1 AND raw_text ~ '(رمز|كد|کد|OTP)'`, [user.id])).rows[0].count);
    check(afterTx === beforeTx && otpStored === 0, `OTP stored somewhere (transactions +${afterTx - beforeTx}, unparsed ${otpStored})`);

    // Non-transaction messages go to the data-quality report, not the ledger.
    for (const text of NOT_TRANSACTIONS) {
      const res = await post(`/webhook/sms/${apiKey}/${account.mellat.bank_code}`, { text });
      check(res.body.parsed === false, `non-transaction parsed: ${text.slice(0, 25)}`);
    }
    const unparsed = Number((await db.query('SELECT count(*) FROM unparsed_sms WHERE user_id = $1', [user.id])).rows[0].count);
    check(unparsed === NOT_TRANSACTIONS.length, `unparsed_sms has ${unparsed}, expected ${NOT_TRANSACTIONS.length}`);

    // Wrong key / unknown account are rejected.
    check((await post(`/webhook/sms/not-a-key/${account.mellat.bank_code}`, { text: 'x' })).status === 401, 'bad api key accepted');
    check((await post(`/webhook/sms/${apiKey}/no-such-account`, { text: 'x' })).status === 404, 'unknown account accepted');
  } finally {
    await db.query('DELETE FROM transactions WHERE user_id = $1', [user.id]);
    await db.query('DELETE FROM unparsed_sms WHERE user_id = $1', [user.id]);
    await db.query('DELETE FROM balance_edit_log WHERE user_id = $1', [user.id]);
    await db.query('DELETE FROM accounts WHERE user_id = $1', [user.id]);
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    await db.end();
  }

  console.log(`e2e sms: ${checks - failures.length}/${checks} checks passed across ${BANKS.length} banks, ${CASES.length} samples`);
  failures.forEach((f) => console.log('  FAIL', f));
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((err) => { console.error('e2e failed to run:', err); process.exitCode = 1; });
