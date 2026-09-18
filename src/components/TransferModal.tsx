import React, { useState } from 'react';
import { X, ArrowLeftRight, Check, AlertCircle } from 'lucide-react';
import { Account } from '../types';
import { formatRialAsToman, formatMoney, toPersianDigits } from '../utils/formatters';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onTransfer: (data: {
    from_account_id: number;
    to_account_id: number;
    amount_rial: number;
    note?: string;
  }) => Promise<void>;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onTransfer,
}) => {
  if (!isOpen) return null;

  const [fromId, setFromId] = useState<number>(accounts[0]?.id || 1);
  const [toId, setToId] = useState<number>(accounts[1]?.id || accounts[0]?.id || 1);
  const [amountToman, setAmountToman] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fromAccount = accounts.find((a) => a.id === fromId);
  const toAccount = accounts.find((a) => a.id === toId);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fromId === toId) {
      setError('حساب مبدا و مقصد نمی‌تواند یکسان باشد.');
      return;
    }

    const cleanAmount = Number(amountToman.replace(/[,،]/g, ''));
    if (!cleanAmount || cleanAmount <= 0) {
      setError('مبلغ انتقال نامعتبر است.');
      return;
    }

    if (fromAccount && cleanAmount * 10 > fromAccount.balance_rial) {
      setError('موجودی حساب مبدا برای این انتقال کافی نیست.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onTransfer({
        from_account_id: fromId,
        to_account_id: toId,
        amount_rial: cleanAmount * 10,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'خطا در انتقال وجه');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-100">انتقال داخلی بین حساب‌ها</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleTransfer} className="space-y-3.5 text-xs">
          {/* From account */}
          <div>
            <label className="text-slate-400 block mb-1">از حساب (مبدا):</label>
            <select
              value={fromId}
              onChange={(e) => setFromId(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name} (موجودی: {formatRialAsToman(a.balance_rial)} تومان)
                </option>
              ))}
            </select>
          </div>

          {/* To account */}
          <div>
            <label className="text-slate-400 block mb-1">به حساب (مقصد):</label>
            <select
              value={toId}
              onChange={(e) => setToId(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name} (موجودی: {formatRialAsToman(a.balance_rial)} تومان)
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400">مبلغ انتقال (تومان):</label>
              {amountToman && (
                <span className="text-slate-300 font-num text-[11px]">
                  {formatMoney(Number(amountToman.replace(/[,،]/g, '')))} تومان
                </span>
              )}
            </div>
            <input
              type="number"
              placeholder="مثلا: ۱۰۰۰۰۰۰"
              value={amountToman}
              onChange={(e) => setAmountToman(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-num text-sm text-left"
              dir="ltr"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-slate-400 block mb-1">توضیح یا علت انتقال (اختیاری):</label>
            <input
              type="text"
              placeholder="مثلا: شارژ کارت بلو، پس‌انداز ماهانه..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال انتقال...' : 'تایید و انتقال وجه'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
