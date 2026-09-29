// Major Iranian banks. `code` is stored on accounts.bank and picks the SMS parser;
// `prefixes` are card BINs used to recognise the bank from a card number (longest
// match wins, so Blu's 8-digit prefixes beat Saman's 6-digit one). Logos live in
// pwa/banks/ (from masihgh/iranian-bank-list, MIT). `sms: 'tested'` means we have a
// parser verified against real messages; the rest go through the generic parser.
const BANKS = [
  { code: 'melli', name: 'بانک ملی ایران', prefixes: ['603799', '636214'], logo: 'melli.svg', color: '#1d3f8f' },
  { code: 'mellat', name: 'بانک ملت', prefixes: ['610433', '991975'], logo: 'mellat.svg', color: '#d12236' },
  { code: 'saderat', name: 'بانک صادرات', prefixes: ['603769'], logo: 'saderat.svg', color: '#29166f' },
  { code: 'tejarat', name: 'بانک تجارت', prefixes: ['627353', '585983'], logo: 'tejarat.svg', color: '#290fad' },
  { code: 'sepah', name: 'بانک سپه', prefixes: ['589210', '627381'], logo: 'sepah.svg', color: '#0093dd' },
  { code: 'keshavarzi', name: 'بانک کشاورزی', prefixes: ['603770', '639217'], logo: 'keshavarzi.svg', color: '#1f5a14' },
  { code: 'maskan', name: 'بانک مسکن', prefixes: ['628023'], logo: 'maskan.svg', color: '#d10f0f' },
  { code: 'refah', name: 'بانک رفاه کارگران', prefixes: ['589463'], logo: 'refahkargaran.svg', color: '#1e7a00' },
  { code: 'postbank', name: 'پست بانک ایران', prefixes: ['627760'], logo: 'post.svg', color: '#008840' },
  { code: 'pasargad', name: 'بانک پاسارگاد', prefixes: ['502229', '639347'], logo: 'pasargad.svg', color: '#b8860b', sms: 'tested' },
  { code: 'saman', name: 'بانک سامان', prefixes: ['621986'], logo: 'saman.svg', color: '#0090c5' },
  { code: 'blu', name: 'بلو (بانک سامان)', prefixes: ['62198618', '62198619'], logo: 'blu.svg', color: '#3094ea', sms: 'tested' },
  { code: 'parsian', name: 'بانک پارسیان', prefixes: ['622106', '639194', '627884'], logo: 'parsian.svg', color: '#a10f1f' },
  { code: 'eghtesadnovin', name: 'بانک اقتصاد نوین', prefixes: ['627412'], logo: 'eghtesad.svg', color: '#5c2e91' },
  { code: 'shahr', name: 'بانک شهر', prefixes: ['502806', '504706'], logo: 'shahr.svg', color: '#c40000' },
  { code: 'karafarin', name: 'بانک کارآفرین', prefixes: ['627488', '502910'], logo: 'karafarin.svg', color: '#168474' },
  { code: 'sina', name: 'بانک سینا', prefixes: ['639346'], logo: 'sina.svg', color: '#16469c' },
  { code: 'dey', name: 'بانک دی', prefixes: ['502938'], logo: 'day.svg', color: '#008a9f' },
  { code: 'resalat', name: 'بانک قرض‌الحسنه رسالت', prefixes: ['504172'], logo: 'resalat.svg', color: '#0092cf', sms: 'tested' },
  { code: 'ghavamin', name: 'بانک قوامین (ادغام در سپه)', prefixes: ['639599'], logo: 'ghavvamin.svg', color: '#0e8a42' },
  { code: 'mehriran', name: 'بانک قرض‌الحسنه مهر ایران', prefixes: ['606373'], logo: 'mehriran.svg', color: '#00a653' },
  { code: 'toseesaderat', name: 'بانک توسعه صادرات', prefixes: ['627648', '207177'], logo: 'tosesaderat.svg', color: '#066e16' },
  { code: 'sanatmadan', name: 'بانک صنعت و معدن', prefixes: ['627961'], logo: 'sanatmadan.svg', color: '#0f317e' },
  { code: 'gardeshgari', name: 'بانک گردشگری', prefixes: ['505416'], logo: 'gardeshgari.svg', color: '#af0a0f' },
  { code: 'iranzamin', name: 'بانک ایران زمین', prefixes: ['505785'], logo: 'iranzamin.svg', color: '#490fa2' },
  { code: 'sarmayeh', name: 'بانک سرمایه', prefixes: ['639607'], logo: 'sarmaye.svg', color: '#6b6b6b' },
];

const BANK_BY_CODE = Object.fromEntries(BANKS.map((b) => [b.code, b]));

function detectBankFromCard(cardNumber) {
  const digits = String(cardNumber || '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/\D/g, '');
  if (digits.length < 6) return null;
  let best = null;
  for (const bank of BANKS) {
    for (const p of bank.prefixes) {
      if (digits.startsWith(p) && (!best || p.length > best.len)) best = { code: bank.code, len: p.length };
    }
  }
  return best ? best.code : null;
}

module.exports = { BANKS, BANK_BY_CODE, detectBankFromCard };
