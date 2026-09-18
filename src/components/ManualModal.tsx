import React, { useState } from 'react';
import { 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Building2, 
  Tag, 
  FileText, 
  Check, 
  CreditCard 
} from 'lucide-react';
import { Account, Category } from '../types';
import { formatMoney, toPersianDigits, formatRialAsToman } from '../utils/formatters';

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  onSubmit: (tx: {
    account_id: number;
    amount_rial: number;
    direction: 'expense' | 'income';
    category_id: number | null;
    note: string | null;
  }) => Promise<void>;
}

export const ManualModal: React.FC<ManualModalProps> = ({
  isOpen,
  onClose,
  accounts,
  categories,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const [accountId, setAccountId] = useState<number>(accounts[0]?.id || 1);
  const [direction, setDirection] = useState<'expense' | 'income'>('expense');
  const [amountToman, setAmountToman] = useState<string>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const filteredCategories = categories.filter((c) => c.direction === direction);

  const quickAmounts = [50000, 100000, 200000, 500000, 1000000, 2000000];

  const handleQuickAdd = (addToman: number) => {
    const current = Number(amountToman.replace(/[,،]/g, '')) || 0;
    setAmountToman(String(current + addToman));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = Number(amountToman.replace(/[,،]/g, ''));
    if (!cleanAmount || cleanAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        account_id: accountId,
        amount_rial: cleanAmount * 10,
        direction,
        category_id: categoryId === '' ? null : Number(categoryId),
        note: note.trim() || null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-100">ثبت دستی تراکنش جدید</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Direction Pill */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setDirection('expense');
                setCategoryId('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all ${
                direction === 'expense'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>کسر از حساب (هزینه)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDirection('income');
                setCategoryId('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all ${
                direction === 'income'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>واریز به حساب (درآمد)</span>
            </button>
          </div>

          {/* Account Picker */}
          <div>
            <label className="text-slate-400 block mb-1">انتخاب حساب بانکی / کیف پول:</label>
            <div className="relative">
              <select
                value={accountId}
                onChange={(e) => setAccountId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name} (موجودی: {formatRialAsToman(a.balance_rial)} تومان)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400">مبلغ تراکنش (تومان):</label>
              {amountToman && (
                <span className="text-slate-300 font-num text-[11px]">
                  {formatMoney(Number(amountToman.replace(/[,،]/g, '')))} تومان
                </span>
              )}
            </div>
            <input
              type="number"
              placeholder="مثلا: ۲۵۰۰۰۰"
              value={amountToman}
              onChange={(e) => setAmountToman(e.target.value)}
              required
              min="1000"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-num text-sm focus:outline-none focus:border-blue-500 text-left"
              dir="ltr"
            />

            {/* Quick amount chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAdd(amt)}
                  className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] font-num transition-all"
                >
                  +{toPersianDigits(amt >= 1000000 ? amt / 1000000 + ' م' : amt / 1000 + ' هـ')}
                </button>
              ))}
              {amountToman && (
                <button
                  type="button"
                  onClick={() => setAmountToman('')}
                  className="px-2 py-1 rounded-lg bg-rose-950/40 text-rose-300 text-[10px]"
                >
                  پاک کردن
                </button>
              )}
            </div>
          </div>

          {/* Category Picker */}
          <div>
            <label className="text-slate-400 block mb-1">دسته‌بندی:</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="">بدون دسته‌بندی / ناشناخته</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Note Input */}
          <div>
            <label className="text-slate-400 block mb-1">شرح یا توضیحات (اختیاری):</label>
            <input
              type="text"
              placeholder="مثلا: خرید کتاب، ناهار، پاداش کاری..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت قطعی تراکنش'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
