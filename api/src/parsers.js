function toEnglishDigits(str) {
  return str
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function toNumber(str) {
  return parseInt(toEnglishDigits(str).replace(/[,٬]/g, ''), 10);
}

// رسالت و پاسارگاد: همون فرمت مشترک
function parseSignedFormat(text) {
  const signMatch = text.match(/([+-])\s*([\d,]+)/);
  const balanceMatch = text.match(/مانده:\s*([\d,]+)/);
  if (!signMatch) return null;

  const amount = toNumber(signMatch[2]);
  const direction = signMatch[1] === '+' ? 'income' : 'expense';
  const balance = balanceMatch ? toNumber(balanceMatch[1]) : null;

  return { amount_rial: amount, direction, balance_after_rial: balance };
}

function parseBlu(text) {
  const amountMatch = text.match(/([\d,]+)\s*ریال/);
  const balanceMatch = text.match(/موجودی:\s*([\d,]+)/);
  if (!amountMatch) return null;

  const amount = toNumber(amountMatch[1]);
  const balance = balanceMatch ? toNumber(balanceMatch[1]) : null;

  let direction = null;
  if (text.includes('پرید')) direction = 'expense';
  else if (text.includes('نشست')) direction = 'income';
  if (!direction) return null;

  return { amount_rial: amount, direction, balance_after_rial: balance };
}

// Best-effort parser for banks we have no verified sample for. Amounts in bank SMS
// are comma-grouped, which keeps dates, times and masked card numbers from matching.
const AMOUNT = String.raw`\d{1,3}(?:,\d{3})+|\d{4,}`;
const EXPENSE_WORDS = /برداشت|خرید|کسر|پرداخت|انتقال\s*از|بدهکار/;
const INCOME_WORDS = /واریز|افزایش|بستانکار|انتقال\s*به\s*حساب\s*شما|سود/;

function parseGeneric(rawText) {
  const text = toEnglishDigits(rawText).replace(/٬/g, ',');
  const balanceMatch = text.match(new RegExp(`(?:مانده|موجودی)\\s*[:：]?\\s*(${AMOUNT})`));
  const balance = balanceMatch ? toNumber(balanceMatch[1]) : null;
  const withoutBalance = balanceMatch ? text.replace(balanceMatch[0], ' ') : text;

  let amount = null;
  let direction = null;
  const signed = withoutBalance.match(new RegExp(`(^|[\\s:])([+-])\\s*(${AMOUNT})`, 'm'));
  if (signed) {
    amount = toNumber(signed[3]);
    direction = signed[2] === '+' ? 'income' : 'expense';
  } else {
    const candidates = [
      new RegExp(`مبلغ\\s*[:：]?\\s*(${AMOUNT})`),
      new RegExp(`(${AMOUNT})\\s*ریال`),
      /(?<![\d/])(\d{1,3}(?:,\d{3})+)(?![\d/])/,
      /(?<![\d/.])(\d{4,})(?![\d/.])/,
    ];
    for (const re of candidates) {
      const m = withoutBalance.match(re);
      if (m) { amount = toNumber(m[1]); break; }
    }
    const expenseAt = withoutBalance.search(EXPENSE_WORDS);
    const incomeAt = withoutBalance.search(INCOME_WORDS);
    if (expenseAt >= 0 && (incomeAt < 0 || expenseAt < incomeAt)) direction = 'expense';
    else if (incomeAt >= 0) direction = 'income';
  }

  if (!amount || amount <= 0 || !direction) return null;
  return { amount_rial: amount, direction, balance_after_rial: balance };
}

const PARSERS = {
  resalat: parseSignedFormat,
  pasargad: parseSignedFormat,
  blu: parseBlu,
};

function parseSms(bankCode, text) {
  const parser = PARSERS[bankCode] || parseGeneric;
  return parser(text);
}

module.exports = { parseSms };
