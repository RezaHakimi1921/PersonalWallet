// Trackable market assets, priced from BrsApi's Gold_Currency feed. `symbol` is
// BrsApi's own symbol; `asset_type` must stay within the investments table's
// CHECK constraint (gold/coin/dollar/other).
const ASSET_CATALOG = [
  { symbol: 'IR_COIN_EMAMI', name: 'سکه تمام امامی', group: 'coin', unit: 'عدد', asset_type: 'coin' },
  { symbol: 'IR_COIN_BAHAR', name: 'سکه تمام بهار آزادی', group: 'coin', unit: 'عدد', asset_type: 'coin' },
  { symbol: 'IR_COIN_HALF', name: 'نیم سکه', group: 'coin', unit: 'عدد', asset_type: 'coin' },
  { symbol: 'IR_COIN_QUARTER', name: 'ربع سکه', group: 'coin', unit: 'عدد', asset_type: 'coin' },
  { symbol: 'IR_COIN_1G', name: 'سکه یک گرمی', group: 'coin', unit: 'عدد', asset_type: 'coin' },
  { symbol: 'IR_GOLD_18K', name: 'طلای ۱۸ عیار', group: 'gold', unit: 'گرم', asset_type: 'gold' },
  { symbol: 'IR_GOLD_24K', name: 'طلای ۲۴ عیار', group: 'gold', unit: 'گرم', asset_type: 'gold' },
  { symbol: 'IR_GOLD_MELTED', name: 'طلای آب‌شده', group: 'gold', unit: 'مثقال', asset_type: 'gold' },
  { symbol: 'USD', name: 'دلار آمریکا', group: 'currency', unit: 'دلار', asset_type: 'dollar' },
  { symbol: 'EUR', name: 'یورو', group: 'currency', unit: 'یورو', asset_type: 'dollar' },
  { symbol: 'GBP', name: 'پوند انگلیس', group: 'currency', unit: 'پوند', asset_type: 'dollar' },
  { symbol: 'AED', name: 'درهم امارات', group: 'currency', unit: 'درهم', asset_type: 'dollar' },
  { symbol: 'TRY', name: 'لیر ترکیه', group: 'currency', unit: 'لیر', asset_type: 'dollar' },
  { symbol: 'CAD', name: 'دلار کانادا', group: 'currency', unit: 'دلار', asset_type: 'dollar' },
  { symbol: 'CHF', name: 'فرانک سوئیس', group: 'currency', unit: 'فرانک', asset_type: 'dollar' },
  { symbol: 'USDT_IRT', name: 'تتر', group: 'crypto', unit: 'تتر', asset_type: 'other' },
  { symbol: 'BTC', name: 'بیت‌کوین', group: 'crypto', unit: 'BTC', asset_type: 'other' },
  { symbol: 'ETH', name: 'اتریوم', group: 'crypto', unit: 'ETH', asset_type: 'other' },
];

const CATALOG_BY_SYMBOL = Object.fromEntries(ASSET_CATALOG.map((a) => [a.symbol, a]));

// Rows created before per-asset symbols existed only had a coarse asset_type.
const LEGACY_TYPE_TO_SYMBOL = { gold: 'IR_GOLD_18K', coin: 'IR_COIN_EMAMI', dollar: 'USD' };

// BrsApi's firewall bans IPs that poll too often, so share one fetch across callers.
const PRICE_CACHE_MS = 10 * 60 * 1000;
let cache = { at: 0, bySymbol: null };

async function getMarketPrices({ force = false } = {}) {
  if (!process.env.BRSAPI_KEY) return null;
  if (!force && cache.bySymbol && Date.now() - cache.at < PRICE_CACHE_MS) return cache.bySymbol;
  // A real browser User-Agent is required; default runtime UAs get the IP banned.
  const res = await fetch(`https://Api.BrsApi.ir/Market/Gold_Currency.php?key=${process.env.BRSAPI_KEY}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    },
  });
  const data = await res.json();
  const bySymbol = {};
  [...(data.gold || []), ...(data.currency || []), ...(data.cryptocurrency || [])].forEach((item) => {
    bySymbol[item.symbol] = { price: Number(item.price), unit: item.unit };
  });
  cache = { at: Date.now(), bySymbol };
  return bySymbol;
}

// Rial price of one unit. Toman-quoted items ×10; dollar-quoted crypto goes through USD.
function unitPriceRial(prices, symbol) {
  if (!prices) return null;
  const item = prices[symbol];
  if (!item || !item.price) return null;
  if (item.unit === 'تومان') return Math.round(item.price * 10);
  if (item.unit === 'دلار' && prices.USD?.price) return Math.round(item.price * prices.USD.price * 10);
  return null;
}

module.exports = { ASSET_CATALOG, CATALOG_BY_SYMBOL, LEGACY_TYPE_TO_SYMBOL, getMarketPrices, unitPriceRial };
