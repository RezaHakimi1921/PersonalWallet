// Run with: npm test (node's built-in test runner, no dependencies).
// Formats marked "real" follow actual bank SMS layouts (numbers changed); they
// include the quirks that matter: Arabic ي/ك, invisible bidi marks (‎, ‪),
// Persian digits and separators, labels with no space before the number.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSms, looksLikeOneTimePassword } = require('../src/parsers');
const { BANKS } = require('../src/banks');
const { CASES, NOT_TRANSACTIONS, ONE_TIME_PASSWORDS } = require('./sms-samples');

for (const [bank, text, expected] of CASES) {
  test(`${bank}: ${text.split('\n').find((l) => l.trim() && !/^-+$/.test(l.trim())).slice(0, 40)}`, () => {
    assert.deepEqual(parseSms(bank, text), expected);
  });
}

test('every bank in the catalog has at least one sample', () => {
  const covered = new Set(CASES.map(([bank]) => bank));
  const missing = BANKS.map((b) => b.code).filter((code) => !covered.has(code));
  assert.deepEqual(missing, []);
});

for (const text of NOT_TRANSACTIONS) {
  test(`not a transaction: ${text.slice(0, 30)}`, () => {
    assert.equal(parseSms('mellat', text), null);
  });
}

for (const text of ONE_TIME_PASSWORDS) {
  test(`one-time password is recognised: ${text.split('\n').pop().slice(0, 30)}`, () => {
    assert.equal(looksLikeOneTimePassword(text), true);
  });
}

test('transaction SMS are not mistaken for one-time passwords', () => {
  for (const [, text] of CASES) assert.equal(looksLikeOneTimePassword(text), false, text);
});
