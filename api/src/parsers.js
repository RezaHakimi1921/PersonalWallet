function toEnglishDigits(str) {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  return str.replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
}

function toNumber(str) {
  return parseInt(toEnglishDigits(str).replace(/,/g, ''), 10);
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

const PARSERS = {
  rasalat: parseSignedFormat,
  pasargad: parseSignedFormat,
  blu: parseBlu,
};

function parseSms(bankCode, text) {
  const parser = PARSERS[bankCode];
  if (!parser) return null;
  return parser(text);
}

module.exports = { parseSms };
