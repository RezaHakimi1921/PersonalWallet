import React, { useState } from 'react';
import { 
  Building2, 
  ArrowLeftRight, 
  Plus, 
  Edit3, 
  CreditCard, 
  Check, 
  X, 
  Wallet,
  Coins
} from 'lucide-react';
import { Account } from '../types';
import { formatRialAsToman, toPersianDigits, getBankMeta } from '../utils/formatters';

interface AccountsViewProps {
  accounts: Account[];
  onUpdateAccount: (id: number, updates: Partial<Account>) => Promise<void>;
  onAddAccount: (newAcc: Partial<Account>) => Promise<void>;
  onOpenTransfer: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  onUpdateAccount,
  onAddAccount,
  onOpenTransfer,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBalanceToman, setEditBalanceToman] = useState('');
  const [editName, setEditName] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newBankCode, setNewBankCode] = useState('mellat');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newBalanceToman, setNewBalanceToman] = useState('');
  const [newCardNumber, setNewCardNumber] = useState('');

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance_rial), 0);

  const startEdit = (acc: Account) => {
    setEditingId(acc.id);
    setEditBalanceToman(String(Math.round(acc.balance_rial / 10)));
    setEditName(acc.display_name);
  };

  const saveEdit = async (id: number) => {
    const valToman = Number(editBalanceToman.replace(/[,،]/g, ''));
    if (isNaN(valToman)) return;
    await onUpdateAccount(id, {
      display_name: editName,
      balance_rial: valToman * 10,
    });
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisplayName || !newBalanceToman) return;
    const amountToman = Number(newBalanceToman.replace(/[,،]/g, ''));
    await onAddAccount({
      bank_code: newBankCode,
      display_name: newDisplayName,
      balance_rial: amountToman * 10,
      card_number: newCardNumber || undefined,
    });
    setShowAddModal(false);
    setNewDisplayName('');
    setNewBalanceToman('');
    setNewCardNumber('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Quick Transfer */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>حساب‌های بانکی و کیف‌پول‌ها</span>
            <span className="text-xs font-normal text-slate-400">
              ({toPersianDigits(accounts.length)} حساب متصل)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مجموع موجودی نقد: <strong className="text-emerald-400 font-num">{formatRialAsToman(totalBalance)} تومان</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            id="btn-internal-transfer"
            onClick={onOpenTransfer}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
          >
            <ArrowLeftRight className="w-4 h-4 text-blue-400" />
            <span>انتقال بین‌بانکی</span>
          </button>

          <button
            id="btn-add-account"
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن حساب جدید</span>
          </button>
        </div>
      </div>

      {/* Realistic Bank Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const meta = getBankMeta(acc.bank_code);
          const isEditing = editingId === acc.id;

          return (
            <div
              key={acc.id}
              className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between min-h-[190px] shadow-lg transition-all ${
                acc.bank_code === 'blu'
                  ? 'bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 border-blue-500/40 text-white'
                  : acc.bank_code === 'rasalat'
                  ? 'bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-950 border-emerald-500/40 text-white'
                  : acc.bank_code === 'pasargad'
                  ? 'bg-gradient-to-br from-amber-800 via-stone-900 to-slate-950 border-amber-500/40 text-white'
                  : 'bg-gradient-to-br from-slate-800 to-slate-950 border-slate-700 text-white'
              }`}
            >
              {/* Card Top: Bank Title & Chip */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 opacity-80" />
                  <span className="font-bold text-sm tracking-wide">{acc.display_name}</span>
                </div>
                {/* Micro SIM Chip illusion */}
                <div className="w-7 h-5 rounded-md bg-amber-400/80 border border-amber-300/40 shadow-inner flex items-center justify-center">
                  <div className="w-4 h-3 border border-amber-600/40 rounded-sm" />
                </div>
              </div>

              {/* Card Middle: Card number */}
              <div className="my-3">
                <div className="text-xs opacity-70 tracking-wider font-mono text-left" dir="ltr">
                  {acc.card_number || '•••• •••• •••• ' + toPersianDigits(acc.id.toString().slice(-4))}
                </div>
              </div>

              {/* Card Bottom: Balance & Actions */}
              <div className="pt-3 border-t border-white/10 flex items-end justify-between">
                <div>
                  <span className="text-[10px] opacity-70 block mb-0.5">موجودی حساب</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={editBalanceToman}
                        onChange={(e) => setEditBalanceToman(e.target.value)}
                        className="w-28 bg-black/40 border border-white/30 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                      />
                      <button
                        onClick={() => saveEdit(acc.id)}
                        className="p-1 bg-emerald-500 rounded-md text-white"
                        title="ذخیره"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 bg-white/20 rounded-md text-white"
                        title="انصراف"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-lg font-black font-num tracking-tight">
                      {formatRialAsToman(acc.balance_rial)} <span className="text-xs font-normal opacity-80">تومان</span>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <button
                    onClick={() => startEdit(acc)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title="ویرایش موجودی دستی"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">افزودن حساب یا کیف‌پول جدید</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">نوع بانک / حساب:</label>
                <select
                  value={newBankCode}
                  onChange={(e) => setNewBankCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                >
                  <option value="mellat">بانک ملت</option>
                  <option value="melli">بانک ملی</option>
                  <option value="saman">بانک سامان</option>
                  <option value="tejarat">بانک تجارت</option>
                  <option value="sepah">بانک سپه</option>
                  <option value="keshavarzi">بانک کشاورزی</option>
                  <option value="cash">کیف پول نقدی (وجه دستی)</option>
                  <option value="crypto">کیف‌پول رمزارز / تتر</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">نام نمایشی:</label>
                <input
                  type="text"
                  placeholder="مثلا: بانک ملت شخصی، کیف پول ارزی..."
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">موجودی اولیه (تومان):</label>
                <input
                  type="number"
                  placeholder="مثلا: ۵۰۰۰۰۰۰"
                  value={newBalanceToman}
                  onChange={(e) => setNewBalanceToman(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">شماره کارت یا حساب (اختیاری):</label>
                <input
                  type="text"
                  placeholder="۶۰۳۷-۹۹۷۵-****-****"
                  value={newCardNumber}
                  onChange={(e) => setNewCardNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-left"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl"
                >
                  ایجاد حساب
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
