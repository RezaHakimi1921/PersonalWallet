import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Types
export interface Account {
  id: number;
  bank_code: string;
  display_name: string;
  balance_rial: number;
  card_number?: string;
  color?: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  direction: 'expense' | 'income';
  is_active: boolean;
  icon?: string;
  created_at: string;
}

export interface Installment {
  id: number;
  title: string;
  type: 'installment' | 'loan';
  total_amount_rial: number | null;
  installment_amount_rial: number;
  total_count: number;
  paid_count: number;
  due_day_of_month: number;
  status: 'active' | 'completed';
  note: string | null;
  created_at: string;
}

export interface Investment {
  id: number;
  title: string;
  invested_amount_rial: number;
  current_value_rial: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  account_name?: string;
  amount_rial: number;
  direction: 'expense' | 'income';
  balance_after_rial: number | null;
  raw_text: string;
  bank_reported_time: string | null;
  status: 'pending' | 'confirmed';
  category_id: number | null;
  category_name?: string;
  note: string | null;
  installment_id: number | null;
  created_at: string;
}

interface DatabaseSchema {
  accounts: Account[];
  categories: Category[];
  installments: Installment[];
  investments: Investment[];
  transactions: Transaction[];
}

function getInitialData(): DatabaseSchema {
  const now = new Date().toISOString();
  return {
    accounts: [
      { id: 1, bank_code: 'rasalat', display_name: 'بانک رسالت', balance_rial: 259203041, card_number: '5041-7210-****-4412', color: '#059669', created_at: now },
      { id: 2, bank_code: 'blu', display_name: 'بلو بانک', balance_rial: 3859212, card_number: '6219-8619-****-8831', color: '#2563eb', created_at: now },
      { id: 3, bank_code: 'pasargad', display_name: 'بانک پاسارگاد', balance_rial: 6326366, card_number: '5022-2910-****-1921', color: '#d97706', created_at: now }
    ],
    categories: [
      { id: 1, name: 'رفت و آمد', direction: 'expense', is_active: true, icon: 'Car', created_at: now },
      { id: 2, name: 'خوراکی', direction: 'expense', is_active: true, icon: 'ShoppingBag', created_at: now },
      { id: 3, name: 'غذا', direction: 'expense', is_active: true, icon: 'Utensils', created_at: now },
      { id: 4, name: 'خانواده', direction: 'expense', is_active: true, icon: 'Heart', created_at: now },
      { id: 5, name: 'شخصی', direction: 'expense', is_active: true, icon: 'User', created_at: now },
      { id: 6, name: 'وسیله نقلیه', direction: 'expense', is_active: true, icon: 'Wrench', created_at: now },
      { id: 7, name: 'توسعه شخصی', direction: 'expense', is_active: true, icon: 'BookOpen', created_at: now },
      { id: 8, name: 'هدیه', direction: 'expense', is_active: true, icon: 'Gift', created_at: now },
      { id: 9, name: 'آرایشگاه', direction: 'expense', is_active: true, icon: 'Scissors', created_at: now },
      { id: 10, name: 'قسط', direction: 'expense', is_active: true, icon: 'CreditCard', created_at: now },
      { id: 11, name: 'ناشناخته', direction: 'expense', is_active: true, icon: 'HelpCircle', created_at: now },
      { id: 12, name: 'درآمد کار', direction: 'income', is_active: true, icon: 'Briefcase', created_at: now },
      { id: 13, name: 'درآمد شخصی', direction: 'income', is_active: true, icon: 'TrendingUp', created_at: now },
      { id: 14, name: 'ناشناخته', direction: 'income', is_active: true, icon: 'HelpCircle', created_at: now }
    ],
    installments: [
      {
        id: 1,
        title: 'وام رسالت',
        type: 'loan',
        total_amount_rial: 500000000,
        installment_amount_rial: 25000000,
        total_count: 24,
        paid_count: 8,
        due_day_of_month: 15,
        status: 'active',
        note: 'وام قرض‌الحسنه کارمزد ۲٪',
        created_at: now
      },
      {
        id: 2,
        title: 'قسط لپ‌تاپ (دیجی‌پی)',
        type: 'installment',
        total_amount_rial: 800000000,
        installment_amount_rial: 80000000,
        total_count: 10,
        paid_count: 4,
        due_day_of_month: 25,
        status: 'active',
        note: 'خرید اقساطی لپ‌تاپ',
        created_at: now
      }
    ],
    investments: [
      {
        id: 1,
        title: 'صندوق طلا (عیار / کهربا)',
        invested_amount_rial: 1500000000,
        current_value_rial: 1820000000,
        note: 'خرید پله‌ای واحدهای طلا',
        created_at: now,
        updated_at: now
      },
      {
        id: 2,
        title: 'تتر (USDT)',
        invested_amount_rial: 800000000,
        current_value_rial: 940000000,
        note: 'پس‌انداز ارزی نوبیتکس',
        created_at: now,
        updated_at: now
      }
    ],
    transactions: [
      {
        id: 1,
        account_id: 2,
        amount_rial: 1250000,
        direction: 'expense',
        balance_after_rial: 3859212,
        raw_text: 'خرید از اسنپ فود - مبلغ: ۱۲۵،۰۰۰ ریال از حساب بلو پرید. موجودی: ۳،۸۵۹،۲۱۲',
        bank_reported_time: '14:20',
        status: 'pending',
        category_id: null,
        note: 'سفارش ناهار اسنپ',
        installment_id: null,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 2,
        account_id: 1,
        amount_rial: 25000000,
        direction: 'expense',
        balance_after_rial: 259203041,
        raw_text: '-۲۵،۰۰۰،۰۰۰ مانده: ۲۵۹،۲۰۳،۰۴۱ انتقال پایا رسالت',
        bank_reported_time: '09:15',
        status: 'pending',
        category_id: null,
        note: 'احتمالاً قسط رسالت',
        installment_id: 1,
        created_at: new Date(Date.now() - 3600000 * 6).toISOString()
      },
      {
        id: 3,
        account_id: 1,
        amount_rial: 150000000,
        direction: 'income',
        balance_after_rial: 284203041,
        raw_text: '+۱۵۰،۰۰۰،۰۰۰ مانده: ۲۸۴،۲۰۳،۰۴۱ واریز حقوق',
        bank_reported_time: '11:00',
        status: 'confirmed',
        category_id: 12,
        note: 'واریز حقوق ماهانه',
        installment_id: null,
        created_at: new Date(Date.now() - 3600000 * 48).toISOString()
      },
      {
        id: 4,
        account_id: 2,
        amount_rial: 4500000,
        direction: 'expense',
        balance_after_rial: 5109212,
        raw_text: 'خرید از فروشگاه هایپرمی',
        bank_reported_time: '19:40',
        status: 'confirmed',
        category_id: 2,
        note: 'خرید هفتگی سوپرمارکت',
        installment_id: null,
        created_at: new Date(Date.now() - 3600000 * 72).toISOString()
      }
    ]
  };
}

function loadData(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading db file, restoring initial data', err);
  }
  const init = getInitialData();
  saveData(init);
  return init;
}

function saveData(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db file', err);
  }
}

// Persian / English digits converter
function toEnglishDigits(str: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(persian[i], 'g'), String(i));
    res = res.replace(new RegExp(arabic[i], 'g'), String(i));
  }
  return res;
}

function parseNumber(str: string): number {
  const clean = toEnglishDigits(str).replace(/[,،\s_]/g, '');
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}

// Bank SMS Parsers (exact match with user's parsers.js + general fallback)
export function parseSms(bankCode: string, text: string): { amount_rial: number; direction: 'expense' | 'income'; balance_after_rial: number | null } | null {
  const normText = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

  if (bankCode === 'rasalat' || bankCode === 'pasargad') {
    const signMatch = normText.match(/([+-])\s*([\d,،]+)/);
    const balanceMatch = normText.match(/مانده:\s*([\d,،]+)/);
    if (signMatch) {
      const amount = parseNumber(signMatch[2]);
      const direction: 'expense' | 'income' = signMatch[1] === '+' ? 'income' : 'expense';
      const balance = balanceMatch ? parseNumber(balanceMatch[1]) : null;
      if (amount > 0) return { amount_rial: amount, direction, balance_after_rial: balance };
    }
  }

  if (bankCode === 'blu') {
    const amountMatch = normText.match(/([\d,،]+)\s*(?:ریال|تومان)?/);
    const balanceMatch = normText.match(/موجودی:\s*([\d,،]+)/);
    if (amountMatch) {
      let amount = parseNumber(amountMatch[1]);
      // Blu often reports in Rials
      if (normText.includes('تومان')) {
        amount = amount * 10;
      }
      const balance = balanceMatch ? parseNumber(balanceMatch[1]) : null;
      let direction: 'expense' | 'income' | null = null;
      if (normText.includes('پرید') || normText.includes('برداشت') || normText.includes('خرید') || normText.includes('انتقال به')) {
        direction = 'expense';
      } else if (normText.includes('نشست') || normText.includes('واریز') || normText.includes('دریافت')) {
        direction = 'income';
      }
      if (direction && amount > 0) {
        return { amount_rial: amount, direction, balance_after_rial: balance };
      }
    }
  }

  // General Iranian bank SMS fallback
  const isIncome = normText.includes('+') || normText.includes('واریز') || normText.includes('نشست');
  const isExpense = normText.includes('-') || normText.includes('برداشت') || normText.includes('پرید') || normText.includes('خرید');
  
  const amountMatch = normText.match(/(?:مبلغ|مبلغ:|مبلغ\s*تراکنش:|به مبلغ)\s*([\d,،]+)/i) ||
                      normText.match(/([+-])\s*([\d,،]+)/) ||
                      normText.match(/([\d,،]{4,})\s*(?:ریال|تومان)?/);
                      
  const balanceMatch = normText.match(/(?:مانده|موجودی|مانده حساب):\s*([\d,،]+)/i);

  if (amountMatch && (isIncome || isExpense)) {
    let amount = parseNumber(amountMatch[1] || amountMatch[2]);
    if (normText.includes('تومان')) {
      amount = amount * 10;
    }
    const balance = balanceMatch ? parseNumber(balanceMatch[1]) : null;
    return {
      amount_rial: amount,
      direction: isIncome ? 'income' : 'expense',
      balance_after_rial: balance
    };
  }

  return null;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Summary / Overview stats
app.get('/api/overview', (req, res) => {
  const db = loadData();
  const totalBalanceRial = db.accounts.reduce((sum, a) => sum + (Number(a.balance_rial) || 0), 0);
  const totalInvestmentsRial = db.investments.reduce((sum, i) => sum + (Number(i.current_value_rial) || 0), 0);
  const totalInvestedOriginalRial = db.investments.reduce((sum, i) => sum + (Number(i.invested_amount_rial) || 0), 0);
  
  const totalLoanRemainingRial = db.installments
    .filter(i => i.status === 'active')
    .reduce((sum, i) => sum + ((i.total_count - i.paid_count) * i.installment_amount_rial), 0);

  const pendingCount = db.transactions.filter(t => t.status === 'pending').length;

  // Monthly income and expense (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const recentConfirmed = db.transactions.filter(t => t.status === 'confirmed' && t.created_at >= thirtyDaysAgo);
  
  const monthlyExpenseRial = recentConfirmed
    .filter(t => t.direction === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount_rial) || 0), 0);
    
  const monthlyIncomeRial = recentConfirmed
    .filter(t => t.direction === 'income')
    .reduce((sum, t) => sum + (Number(t.amount_rial) || 0), 0);

  const netWorthRial = totalBalanceRial + totalInvestmentsRial - totalLoanRemainingRial;

  res.json({
    totalBalanceRial,
    totalInvestmentsRial,
    totalInvestedOriginalRial,
    investmentProfitRial: totalInvestmentsRial - totalInvestedOriginalRial,
    totalLoanRemainingRial,
    netWorthRial,
    monthlyExpenseRial,
    monthlyIncomeRial,
    pendingCount,
    accountsCount: db.accounts.length,
    activeInstallmentsCount: db.installments.filter(i => i.status === 'active').length
  });
});

// Test SMS parser live endpoint
app.post('/api/sms-parser/test', (req, res) => {
  const { bank_code, text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'متن پیامک الزامی است' });
  const parsed = parseSms(bank_code || 'blu', text);
  res.json({ parsed });
});

// Webhook: incoming bank SMS (matching original iOS Shortcut trigger)
app.post('/api/webhook/sms', (req, res) => {
  const body: Record<string, any> = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    body[k.toLowerCase()] = v;
  }
  const bank = body.bank?.toLowerCase();
  const text = body.text;

  if (!bank || !text) {
    return res.status(400).json({ error: 'bank and text are required' });
  }

  const db = loadData();
  const account = db.accounts.find(a => a.bank_code.toLowerCase() === bank);
  if (!account) {
    return res.status(404).json({ error: `حساب بانکی با شناسه ${bank} یافت نشد` });
  }

  const parsed = parseSms(bank, text);
  const now = new Date().toISOString();

  if (!parsed) {
    const newTx: Transaction = {
      id: Date.now(),
      account_id: account.id,
      amount_rial: 0,
      direction: 'expense',
      balance_after_rial: account.balance_rial,
      raw_text: text,
      bank_reported_time: null,
      status: 'pending',
      category_id: null,
      note: 'پیامک به‌صورت خودکار پارس نشد (نیازمند بررسی)',
      installment_id: null,
      created_at: now
    };
    db.transactions.unshift(newTx);
    saveData(db);
    return res.json({ ok: true, parsed: false, transaction_id: newTx.id });
  }

  const { amount_rial, direction, balance_after_rial } = parsed;
  const newBalance = balance_after_rial != null
    ? balance_after_rial
    : direction === 'income'
      ? account.balance_rial + amount_rial
      : account.balance_rial - amount_rial;

  account.balance_rial = newBalance;

  // Check matching installment
  let matchedInstallmentId: number | null = null;
  if (direction === 'expense') {
    const matched = db.installments.find(i => i.status === 'active' && i.installment_amount_rial === amount_rial && i.paid_count < i.total_count);
    if (matched) {
      matchedInstallmentId = matched.id;
    }
  }

  const newTx: Transaction = {
    id: Date.now(),
    account_id: account.id,
    amount_rial,
    direction,
    balance_after_rial: newBalance,
    raw_text: text,
    bank_reported_time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    status: 'pending',
    category_id: null,
    note: matchedInstallmentId ? 'تطبیق با قسط فعال پیدا شد' : null,
    installment_id: matchedInstallmentId,
    created_at: now
  };

  db.transactions.unshift(newTx);
  saveData(db);

  res.json({
    ok: true,
    parsed: true,
    transaction_id: newTx.id,
    new_balance_rial: newBalance,
    matched_installment_id: matchedInstallmentId
  });
});

// Transactions list
app.get('/api/transactions', (req, res) => {
  const { status, direction, account_id, search } = req.query;
  const db = loadData();
  
  let list = db.transactions.map(t => {
    const acc = db.accounts.find(a => a.id === t.account_id);
    const cat = db.categories.find(c => c.id === t.category_id);
    return {
      ...t,
      account_name: acc ? acc.display_name : 'حساب نامشخص',
      category_name: cat ? cat.name : null,
      account_color: acc?.color || '#3b82f6'
    };
  });

  if (status) {
    list = list.filter(t => t.status === status);
  }
  if (direction) {
    list = list.filter(t => t.direction === direction);
  }
  if (account_id) {
    list = list.filter(t => t.account_id === Number(account_id));
  }
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(t =>
      (t.note && t.note.toLowerCase().includes(q)) ||
      (t.raw_text && t.raw_text.toLowerCase().includes(q)) ||
      (t.account_name && t.account_name.toLowerCase().includes(q)) ||
      (t.category_name && t.category_name.toLowerCase().includes(q))
    );
  }

  // Sort descending
  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(list);
});

// Manual transaction
app.post('/api/transactions/manual', (req, res) => {
  const { account_id, amount_rial, direction, category_id, note, created_at } = req.body || {};
  if (!account_id || !amount_rial || !['expense', 'income'].includes(direction)) {
    return res.status(400).json({ error: 'مشخصات تراکنش ناقص است' });
  }

  const db = loadData();
  const account = db.accounts.find(a => a.id === Number(account_id));
  if (!account) return res.status(404).json({ error: 'حساب یافت نشد' });

  const amount = Number(amount_rial);
  const newBalance = direction === 'income'
    ? account.balance_rial + amount
    : account.balance_rial - amount;

  account.balance_rial = newBalance;

  const newTx: Transaction = {
    id: Date.now(),
    account_id: account.id,
    amount_rial: amount,
    direction,
    balance_after_rial: newBalance,
    raw_text: 'ثبت دستی',
    bank_reported_time: null,
    status: 'confirmed',
    category_id: category_id ? Number(category_id) : null,
    note: note || null,
    installment_id: null,
    created_at: created_at || new Date().toISOString()
  };

  db.transactions.unshift(newTx);
  saveData(db);

  res.json(newTx);
});

// Confirm pending transaction
app.post('/api/transactions/:id/confirm', (req, res) => {
  const id = Number(req.params.id);
  const { category_id, note } = req.body || {};
  const db = loadData();

  const tx = db.transactions.find(t => t.id === id);
  if (!tx) return res.status(404).json({ error: 'تراکنش یافت نشد' });

  tx.category_id = category_id ? Number(category_id) : null;
  if (note !== undefined) tx.note = note;
  tx.status = 'confirmed';

  saveData(db);
  res.json(tx);
});

// Confirm as installment
app.post('/api/transactions/:id/confirm-installment', (req, res) => {
  const id = Number(req.params.id);
  const installmentId = Number(req.query.installment_id || req.body?.installment_id);
  if (!installmentId) return res.status(400).json({ error: 'installment_id required' });

  const db = loadData();
  const tx = db.transactions.find(t => t.id === id);
  if (!tx) return res.status(404).json({ error: 'تراکنش پیدا نشد' });

  const inst = db.installments.find(i => i.id === installmentId);
  if (!inst) return res.status(404).json({ error: 'قسط پیدا نشد' });

  // Find or use category 'قسط'
  let cat = db.categories.find(c => c.name === 'قسط' && c.direction === 'expense');
  if (!cat) {
    cat = { id: Date.now(), name: 'قسط', direction: 'expense', is_active: true, created_at: new Date().toISOString() };
    db.categories.push(cat);
  }

  tx.category_id = cat.id;
  tx.status = 'confirmed';
  tx.installment_id = inst.id;
  tx.note = tx.note ? `${tx.note} (قسط: ${inst.title})` : `پرداخت قسط ${inst.title}`;

  inst.paid_count += 1;
  if (inst.paid_count >= inst.total_count) {
    inst.status = 'completed';
  }

  saveData(db);
  res.json({ ok: true, installment: inst, transaction: tx });
});

// Delete or cancel transaction
app.delete('/api/transactions/:id', (req, res) => {
  const id = Number(req.params.id);
  const { revertBalance } = req.query;
  const db = loadData();

  const txIndex = db.transactions.findIndex(t => t.id === id);
  if (txIndex === -1) return res.status(404).json({ error: 'تراکنش پیدا نشد' });

  const tx = db.transactions[txIndex];
  if (revertBalance === 'true') {
    const acc = db.accounts.find(a => a.id === tx.account_id);
    if (acc) {
      if (tx.direction === 'expense') {
        acc.balance_rial += tx.amount_rial;
      } else {
        acc.balance_rial -= tx.amount_rial;
      }
    }
  }

  db.transactions.splice(txIndex, 1);
  saveData(db);
  res.json({ ok: true });
});

// Accounts
app.get('/api/accounts', (req, res) => {
  const db = loadData();
  res.json(db.accounts);
});

app.post('/api/accounts', (req, res) => {
  const { display_name, bank_code, balance_rial, card_number, color } = req.body || {};
  if (!display_name || !bank_code) return res.status(400).json({ error: 'نام و کد بانک الزامی است' });

  const db = loadData();
  const newAccount: Account = {
    id: Date.now(),
    bank_code: bank_code.toLowerCase().trim(),
    display_name: display_name.trim(),
    balance_rial: Number(balance_rial) || 0,
    card_number: card_number || undefined,
    color: color || '#3b82f6',
    created_at: new Date().toISOString()
  };

  db.accounts.push(newAccount);
  saveData(db);
  res.json(newAccount);
});

app.put('/api/accounts/:id', (req, res) => {
  const id = Number(req.params.id);
  const { display_name, balance_rial, card_number, color } = req.body || {};
  const db = loadData();
  const acc = db.accounts.find(a => a.id === id);
  if (!acc) return res.status(404).json({ error: 'حساب پیدا نشد' });

  if (display_name) acc.display_name = display_name;
  if (balance_rial !== undefined) acc.balance_rial = Number(balance_rial);
  if (card_number !== undefined) acc.card_number = card_number;
  if (color !== undefined) acc.color = color;

  saveData(db);
  res.json(acc);
});

// Internal transfer between accounts
app.post('/api/transfers', (req, res) => {
  const { from_account_id, to_account_id, amount_rial, note } = req.body || {};
  if (!from_account_id || !to_account_id || !amount_rial) {
    return res.status(400).json({ error: 'اطلاعات انتقال ناقص است' });
  }

  const db = loadData();
  const fromAcc = db.accounts.find(a => a.id === Number(from_account_id));
  const toAcc = db.accounts.find(a => a.id === Number(to_account_id));

  if (!fromAcc || !toAcc) return res.status(404).json({ error: 'حساب‌های مبدا یا مقصد یافت نشدند' });
  if (fromAcc.id === toAcc.id) return res.status(400).json({ error: 'حساب مبدا و مقصد نمی‌تواند یکسان باشد' });

  const amount = Number(amount_rial);
  fromAcc.balance_rial -= amount;
  toAcc.balance_rial += amount;

  const now = new Date().toISOString();
  // Find or create 'انتقال داخلی' categories
  let expCat = db.categories.find(c => c.name === 'انتقال داخلی' && c.direction === 'expense');
  if (!expCat) {
    expCat = { id: Date.now(), name: 'انتقال داخلی', direction: 'expense', is_active: true, created_at: now };
    db.categories.push(expCat);
  }
  let incCat = db.categories.find(c => c.name === 'انتقال داخلی' && c.direction === 'income');
  if (!incCat) {
    incCat = { id: Date.now() + 1, name: 'انتقال داخلی', direction: 'income', is_active: true, created_at: now };
    db.categories.push(incCat);
  }

  const txFrom: Transaction = {
    id: Date.now(),
    account_id: fromAcc.id,
    amount_rial: amount,
    direction: 'expense',
    balance_after_rial: fromAcc.balance_rial,
    raw_text: `انتقال به ${toAcc.display_name}`,
    bank_reported_time: null,
    status: 'confirmed',
    category_id: expCat.id,
    note: note ? `${note} (انتقال به ${toAcc.display_name})` : `انتقال به ${toAcc.display_name}`,
    installment_id: null,
    created_at: now
  };

  const txTo: Transaction = {
    id: Date.now() + 1,
    account_id: toAcc.id,
    amount_rial: amount,
    direction: 'income',
    balance_after_rial: toAcc.balance_rial,
    raw_text: `دریافت انتقال از ${fromAcc.display_name}`,
    bank_reported_time: null,
    status: 'confirmed',
    category_id: incCat.id,
    note: note ? `${note} (انتقال از ${fromAcc.display_name})` : `انتقال از ${fromAcc.display_name}`,
    installment_id: null,
    created_at: now
  };

  db.transactions.unshift(txTo);
  db.transactions.unshift(txFrom);
  saveData(db);

  res.json({ ok: true, from_account: fromAcc, to_account: toAcc });
});

// Categories
app.get('/api/categories', (req, res) => {
  const db = loadData();
  res.json(db.categories.filter(c => c.is_active));
});

app.post('/api/categories', (req, res) => {
  const { name, direction, icon } = req.body || {};
  if (!name || !['expense', 'income'].includes(direction)) {
    return res.status(400).json({ error: 'نام و نوع دسته‌بندی الزامی است' });
  }

  const db = loadData();
  const newCat: Category = {
    id: Date.now(),
    name: name.trim(),
    direction,
    is_active: true,
    icon: icon || 'Tag',
    created_at: new Date().toISOString()
  };

  db.categories.push(newCat);
  saveData(db);
  res.json(newCat);
});

app.put('/api/categories/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, is_active, icon } = req.body || {};
  const db = loadData();
  const cat = db.categories.find(c => c.id === id);
  if (!cat) return res.status(404).json({ error: 'دسته‌بندی پیدا نشد' });

  if (name) cat.name = name;
  if (is_active !== undefined) cat.is_active = is_active;
  if (icon) cat.icon = icon;

  saveData(db);
  res.json(cat);
});

// Installments
app.get('/api/installments', (req, res) => {
  const db = loadData();
  res.json(db.installments);
});

app.post('/api/installments', (req, res) => {
  const { title, type, total_amount_rial, installment_amount_rial, total_count, due_day_of_month, note } = req.body || {};
  if (!title || !installment_amount_rial || !total_count || !due_day_of_month) {
    return res.status(400).json({ error: 'اطلاعات قسط ناقص است' });
  }

  const db = loadData();
  const newInst: Installment = {
    id: Date.now(),
    title: title.trim(),
    type: type || 'installment',
    total_amount_rial: total_amount_rial ? Number(total_amount_rial) : null,
    installment_amount_rial: Number(installment_amount_rial),
    total_count: Number(total_count),
    paid_count: 0,
    due_day_of_month: Number(due_day_of_month),
    status: 'active',
    note: note || null,
    created_at: new Date().toISOString()
  };

  db.installments.push(newInst);
  saveData(db);
  res.json(newInst);
});

app.post('/api/installments/:id/pay', (req, res) => {
  const id = Number(req.params.id);
  const { account_id } = req.body || {};
  const db = loadData();
  const inst = db.installments.find(i => i.id === id);
  if (!inst) return res.status(404).json({ error: 'قسط پیدا نشد' });

  inst.paid_count += 1;
  if (inst.paid_count >= inst.total_count) {
    inst.status = 'completed';
  }

  // If user selected an account to deduct from
  if (account_id) {
    const acc = db.accounts.find(a => a.id === Number(account_id));
    if (acc) {
      acc.balance_rial -= inst.installment_amount_rial;
      let cat = db.categories.find(c => c.name === 'قسط' && c.direction === 'expense');
      const now = new Date().toISOString();
      const newTx: Transaction = {
        id: Date.now(),
        account_id: acc.id,
        amount_rial: inst.installment_amount_rial,
        direction: 'expense',
        balance_after_rial: acc.balance_rial,
        raw_text: `پرداخت دستی قسط ${inst.title}`,
        bank_reported_time: null,
        status: 'confirmed',
        category_id: cat?.id || null,
        note: `پرداخت قسط ${inst.paid_count} از ${inst.total_count} (${inst.title})`,
        installment_id: inst.id,
        created_at: now
      };
      db.transactions.unshift(newTx);
    }
  }

  saveData(db);
  res.json(inst);
});

app.delete('/api/installments/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = loadData();
  const index = db.installments.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'قسط پیدا نشد' });

  db.installments.splice(index, 1);
  saveData(db);
  res.json({ ok: true });
});

// Investments
app.get('/api/investments', (req, res) => {
  const db = loadData();
  res.json(db.investments);
});

app.post('/api/investments', (req, res) => {
  const { title, invested_amount_rial, current_value_rial, note } = req.body || {};
  if (!title || !invested_amount_rial) {
    return res.status(400).json({ error: 'عنوان و مبلغ اولیه الزامی است' });
  }

  const db = loadData();
  const now = new Date().toISOString();
  const newInv: Investment = {
    id: Date.now(),
    title: title.trim(),
    invested_amount_rial: Number(invested_amount_rial),
    current_value_rial: current_value_rial ? Number(current_value_rial) : Number(invested_amount_rial),
    note: note || null,
    created_at: now,
    updated_at: now
  };

  db.investments.push(newInv);
  saveData(db);
  res.json(newInv);
});

app.put('/api/investments/:id', (req, res) => {
  const id = Number(req.params.id);
  const { current_value_rial, note, invested_amount_rial, title } = req.body || {};
  const db = loadData();
  const inv = db.investments.find(i => i.id === id);
  if (!inv) return res.status(404).json({ error: 'سرمایه‌گذاری پیدا نشد' });

  if (title) inv.title = title;
  if (invested_amount_rial !== undefined) inv.invested_amount_rial = Number(invested_amount_rial);
  if (current_value_rial !== undefined) inv.current_value_rial = Number(current_value_rial);
  if (note !== undefined) inv.note = note;
  inv.updated_at = new Date().toISOString();

  saveData(db);
  res.json(inv);
});

app.delete('/api/investments/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = loadData();
  const index = db.investments.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'سرمایه‌گذاری پیدا نشد' });

  db.investments.splice(index, 1);
  saveData(db);
  res.json({ ok: true });
});

// Reset seed data
app.post('/api/reset-seed', (req, res) => {
  const init = getInitialData();
  saveData(init);
  res.json({ ok: true, message: 'داده‌ها به حالت اولیه بازنشانی شدند' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PersonalWallet server running on port ${PORT}`);
  });
}

start();
