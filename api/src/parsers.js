// Bank SMS -> { amount_rial, direction, balance_after_rial }, or null when the text
// isn't a money movement we can read with confidence. Real bank SMS mix Arabic and
// Persian letters (ي/ی, ك/ک), Persian and Latin digits, and invisible bidi marks
// around numbers, so everything is normalized before any pattern runs.

const BIDI_MARKS = /[‎‏‪-‮⁦-⁩﻿]/g;

function normalize(text) {
  return String(text)
    .replace(BIDI_MARKS, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٬/g, ',');
}

function toNumber(str) {
  return parseInt(str.replace(/,/g, ''), 10);
}

// Money is comma-grouped in bank SMS; a bare run of 4+ digits is accepted only where
// a label says it's an amount (e.g. «برداشت500000»), never on its own -- bare digits
// are card, account and tracking numbers.
const GROUPED = String.raw`\d{1,3}(?:,\d{3})+`;
const LABELLED = String.raw`\d{1,3}(?:,\d{3})+|\d{4,}`;

const EXPENSE_WORDS = String.raw`برداشت|خرید|کسر|پرداخت|پرید|بدهکار|انتقال(?!\s*به\s*(?:حساب|کارت)\s*شما)`;
const INCOME_WORDS = String.raw`واریز|نشست|بستانکار|افزایش\s*موجودی|انتقال\s*به\s*(?:حساب|کارت)\s*شما|سود`;

function findBalance(text) {
  const m = text.match(new RegExp(`(?:مانده|موجودی)(?:\\s*حساب)?\\s*[:：]?\\s*(${LABELLED})`));
  return m ? { value: toNumber(m[1]), matched: m[0] } : null;
}

function findDirectionByWords(text) {
  const expenseAt = text.search(new RegExp(EXPENSE_WORDS));
  const incomeAt = text.search(new RegExp(INCOME_WORDS));
  if (expenseAt < 0 && incomeAt < 0) return null;
  if (incomeAt < 0) return 'expense';
  if (expenseAt < 0) return 'income';
  return expenseAt < incomeAt ? 'expense' : 'income';
}

function tomanAware(amount, after) {
  return /^\s*تومان/.test(after) ? amount * 10 : amount;
}

function findAmount(text) {
  // 1. A signed amount («-50,000», «:+8,000,000») carries its own direction.
  const signed = text.match(new RegExp(`(?:^|[\\s:])([+-])\\s*(${GROUPED}|\\d{4,})(?![\\d,])`, 'm'));
  if (signed) return { value: toNumber(signed[2]), direction: signed[1] === '+' ? 'income' : 'expense' };

  // 2. «مبلغ: 1,000,000»
  const labelled = text.match(new RegExp(`مبلغ\\s*[:：]?\\s*(${LABELLED})`));
  if (labelled) return { value: tomanAware(toNumber(labelled[1]), text.slice(labelled.index + labelled[0].length)) };

  // 3. Right after a movement word on the same line: «خرید پایانه فروش: 900,000», «برداشت500,000».
  const keyword = text.match(new RegExp(`(?:${EXPENSE_WORDS}|${INCOME_WORDS})[^\\n\\d]{0,25}?(${LABELLED})(?![\\d/])`));
  if (keyword) return { value: tomanAware(toNumber(keyword[1]), text.slice(keyword.index + keyword[0].length)) };

  // 4. A grouped number with its currency: «4,218,500 ریال».
  const currency = text.match(new RegExp(`(${GROUPED})\\s*(ریال|تومان)`));
  if (currency) return { value: currency[2] === 'تومان' ? toNumber(currency[1]) * 10 : toNumber(currency[1]) };

  // 5. Any other grouped number.
  const grouped = text.match(new RegExp(`(?<![\\d/,])(${GROUPED})(?![\\d/,])`));
  if (grouped) return { value: toNumber(grouped[1]) };
  return null;
}

function parseGeneric(text) {
  const balance = findBalance(text);
  const withoutBalance = balance ? text.replace(balance.matched, ' ') : text;
  const amount = findAmount(withoutBalance);
  if (!amount || !(amount.value > 0)) return null;
  const direction = amount.direction || findDirectionByWords(withoutBalance);
  if (!direction) return null;
  return { amount_rial: amount.value, direction, balance_after_rial: balance ? balance.value : null };
}

// Resalat and Pasargad: account line, a signed amount on its own line, «مانده:».
function parseSignedFormat(text) {
  const signMatch = text.match(new RegExp(`(?:^|[\\s:])([+-])\\s*(${GROUPED}|\\d{4,})`, 'm'));
  if (!signMatch) return null;
  const balance = findBalance(text);
  return {
    amount_rial: toNumber(signMatch[2]),
    direction: signMatch[1] === '+' ? 'income' : 'expense',
    balance_after_rial: balance ? balance.value : null,
  };
}

// Blu: «X ریال از حساب شما پرید» / «X ریال به حساب شما نشست».
function parseBlu(text) {
  const balance = findBalance(text);
  const withoutBalance = balance ? text.replace(balance.matched, ' ') : text;
  const amountMatch = withoutBalance.match(new RegExp(`(${GROUPED})\\s*ریال`));
  if (!amountMatch) return null;
  let direction = null;
  if (withoutBalance.includes('پرید')) direction = 'expense';
  else if (withoutBalance.includes('نشست')) direction = 'income';
  if (!direction) return null;
  return { amount_rial: toNumber(amountMatch[1]), direction, balance_after_rial: balance ? balance.value : null };
}

const PARSERS = {
  resalat: parseSignedFormat,
  pasargad: parseSignedFormat,
  blu: parseBlu,
};

// A bank-specific parser gets first try; if it can't read the message, the generic one does.
function parseSms(bankCode, rawText) {
  const text = normalize(rawText);
  const specific = PARSERS[bankCode];
  return (specific && specific(text)) || parseGeneric(text);
}

// Banks send one-time/dynamic passwords from the same sender as transaction SMS.
const ONE_TIME_PASSWORD = /رمز\s*(پویا|یکبار|دوم|اینترنتی)|کد\s*(تایید|تأیید|یکبار|فعال‌?سازی|امنیتی)|رمز\s*عبور|\bOTP\b|password|verification/i;
function looksLikeOneTimePassword(rawText) {
  return ONE_TIME_PASSWORD.test(normalize(rawText));
}

module.exports = { parseSms, normalize, looksLikeOneTimePassword };
