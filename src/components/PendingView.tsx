import React, { useState } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Tag, 
  FileText, 
  AlertCircle, 
  Check, 
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { Transaction, Category, Installment } from '../types';
import { formatRialAsToman, toPersianDigits, getBankMeta, formatShamsi } from '../utils/formatters';

interface PendingViewProps {
  pendingTransactions: Transaction[];
  categories: Category[];
  installments: Installment[];
  onConfirm: (id: number, categoryId: number | null, note: string | null) => Promise<void>;
  onConfirmInstallment: (id: number, installmentId: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onOpenSmsSimulator: () => void;
}

export const PendingView: React.FC<PendingViewProps> = ({
  pendingTransactions,
  categories,
  installments,
  onConfirm,
  onConfirmInstallment,
  onDelete,
  onOpenSmsSimulator,
}) => {
  // Local state for edits on cards
  const [selectedCats, setSelectedCats] = useState<{ [id: number]: number | '' }>({});
  const [notes, setNotes] = useState<{ [id: number]: string }>({});
  const [loadingIds, setLoadingIds] = useState<{ [id: number]: boolean }>({});

  const handleConfirm = async (t: Transaction) => {
    setLoadingIds((prev) => ({ ...prev, [t.id]: true }));
    try {
      const categoryId = selectedCats[t.id] !== undefined 
        ? (selectedCats[t.id] === '' ? null : Number(selectedCats[t.id])) 
        : t.category_id;
      const note = notes[t.id] !== undefined ? notes[t.id] : t.note;
      await onConfirm(t.id, categoryId, note);
    } finally {
      setLoadingIds((prev) => ({ ...prev, [t.id]: false }));
    }
  };

  const handleConfirmAsInstallment = async (t: Transaction, installmentId: number) => {
    setLoadingIds((prev) => ({ ...prev, [t.id]: true }));
    try {
      await onConfirmInstallment(t.id, installmentId);
    } finally {
      setLoadingIds((prev) => ({ ...prev, [t.id]: false }));
    }
  };

  if (pendingTransactions.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center max-w-xl mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 ring-1 ring-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-100">همه تراکنش‌ها تعیین‌تکلیف شده‌اند!</h3>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          هیچ پیامک بانکی بدون دسته‌بندی وجود ندارد. به محض رسیدن پیامک جدید یا فراخوانی وب‌هوک، در این صفحه ظاهر خواهد شد.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button
            onClick={onOpenSmsSimulator}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>تست پارسر و ارسال پیامک نمونه</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>تراکنش‌های در انتظار تعیین دسته‌بندی</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-num">
              {toPersianDigits(pendingTransactions.length)} عدد
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            تراکنش‌های استخراج‌شده از پیامک‌های بانکی؛ دسته‌بندی را مشخص کنید تا قطعی شود.
          </p>
        </div>
      </div>

      <div className="space-y-3.5">
        {pendingTransactions.map((tx) => {
          const isIncome = tx.direction === 'income';
          const meta = getBankMeta(tx.account_name || 'blu');
          const currentCat = selectedCats[tx.id] !== undefined ? selectedCats[tx.id] : (tx.category_id || '');
          const currentNote = notes[tx.id] !== undefined ? notes[tx.id] : (tx.note || '');
          const isLoading = !!loadingIds[tx.id];

          // Check if there is an active installment matching this exact amount
          const matchingInstallment = installments.find(
            (i) => i.status === 'active' && i.installment_amount_rial === tx.amount_rial && i.paid_count < i.total_count
          );

          // Matching categories by direction
          const filteredCategories = categories.filter((c) => c.direction === tx.direction);

          return (
            <div
              key={tx.id}
              className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 hover:border-slate-700 transition-all"
            >
              {/* Header: Bank & Amount */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncome ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {isIncome ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100">{tx.account_name}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${meta.chipBg}`}>
                        {isIncome ? 'واریز' : 'برداشت'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-num">
                      {formatShamsi(tx.created_at)}
                    </span>
                  </div>
                </div>

                {/* Amount display */}
                <div className="text-left" dir="ltr">
                  <div
                    className={`text-lg sm:text-xl font-black font-num ${
                      isIncome ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isIncome ? '+' : '-'}{formatRialAsToman(tx.amount_rial)}
                    <span className="text-xs font-normal ml-1">تومان</span>
                  </div>
                  {tx.balance_after_rial != null && (
                    <div className="text-[10px] text-slate-400 font-num">
                      مانده: {formatRialAsToman(tx.balance_after_rial)} ت
                    </div>
                  )}
                </div>
              </div>

              {/* Raw SMS Preview Box */}
              {tx.raw_text && (
                <div className="mt-3 bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 text-xs text-slate-300 font-sans flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div className="overflow-hidden text-ellipsis line-clamp-2">
                    <span className="text-slate-400 font-medium">متن پیامک: </span>
                    <span>{tx.raw_text}</span>
                  </div>
                </div>
              )}

              {/* Smart Installment Suggestion Pill */}
              {matchingInstallment && !isIncome && (
                <div className="mt-3 bg-indigo-950/40 border border-indigo-700/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-xs text-indigo-200">
                      مبلغ منطبق بر قسط <strong className="text-white">«{matchingInstallment.title}»</strong> است.
                    </span>
                  </div>
                  <button
                    onClick={() => handleConfirmAsInstallment(tx, matchingInstallment.id)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>تایید به عنوان پرداخت این قسط</span>
                  </button>
                </div>
              )}

              {/* Inputs: Category & Note */}
              <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Category Picker */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">دسته‌بندی تراکنش:</label>
                  <select
                    value={currentCat}
                    onChange={(e) => setSelectedCats((prev) => ({ ...prev, [tx.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="">انتخاب دسته‌بندی...</option>
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Note */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">توضیحات (اختیاری):</label>
                  <input
                    type="text"
                    placeholder="مثلا: خرید سوپرمارکت، هزینه کافه..."
                    value={currentNote}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => onDelete(tx.id)}
                  disabled={isLoading}
                  className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 p-2 rounded-xl transition-colors flex items-center gap-1.5"
                  title="حذف این تراکنش بدون کسر از مانده"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">حذف پیامک</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConfirm(tx)}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isLoading ? 'در حال ثبت...' : 'ثبت و قطعی‌سازی'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
