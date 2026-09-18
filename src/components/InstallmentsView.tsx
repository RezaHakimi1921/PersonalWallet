import React, { useState } from 'react';
import { 
  CalendarClock, 
  Plus, 
  CheckCircle2, 
  Trash2, 
  Check, 
  X, 
  CreditCard, 
  AlertCircle,
  Building2
} from 'lucide-react';
import { Installment, Account } from '../types';
import { formatRialAsToman, toPersianDigits } from '../utils/formatters';

interface InstallmentsViewProps {
  installments: Installment[];
  accounts: Account[];
  onPayInstallment: (id: number, accountId?: number) => Promise<void>;
  onAddInstallment: (newInst: Partial<Installment>) => Promise<void>;
  onDeleteInstallment: (id: number) => Promise<void>;
}

export const InstallmentsView: React.FC<InstallmentsViewProps> = ({
  installments,
  accounts,
  onPayInstallment,
  onAddInstallment,
  onDeleteInstallment,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'installment' | 'loan'>('installment');
  const [installmentAmountToman, setInstallmentAmountToman] = useState('');
  const [totalCount, setTotalCount] = useState('');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('');
  const [note, setNote] = useState('');

  const [payingId, setPayingId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(accounts[0]?.id || 1);

  const activeList = installments.filter((i) => i.status === 'active');
  const completedList = installments.filter((i) => i.status === 'completed');

  const totalRemainingDebt = activeList.reduce(
    (sum, i) => sum + (i.total_count - i.paid_count) * i.installment_amount_rial,
    0
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !installmentAmountToman || !totalCount || !dueDayOfMonth) return;
    const amountToman = Number(installmentAmountToman.replace(/[,،]/g, ''));
    await onAddInstallment({
      title,
      type,
      installment_amount_rial: amountToman * 10,
      total_count: Number(totalCount),
      due_day_of_month: Number(dueDayOfMonth),
      note: note || undefined,
    });
    setShowAddModal(false);
    setTitle('');
    setInstallmentAmountToman('');
    setTotalCount('');
    setDueDayOfMonth('');
    setNote('');
  };

  const confirmPay = async (id: number) => {
    await onPayInstallment(id, selectedAccountId);
    setPayingId(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>اقساط و وام‌های فعال</span>
            <span className="text-xs font-normal text-slate-400">
              ({toPersianDigits(activeList.length)} مورد فعال)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مجموع کل بدهی باقی‌مانده: <strong className="text-rose-400 font-num">{formatRialAsToman(totalRemainingDebt)} تومان</strong>
          </p>
        </div>

        <button
          id="btn-add-installment"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت وام یا قسط جدید</span>
        </button>
      </div>

      {/* Active Installments Cards */}
      <div className="space-y-3.5">
        {activeList.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            هیچ قسط یا وام فعالی ثبت نشده است.
          </div>
        ) : (
          activeList.map((inst) => {
            const percent = Math.round((inst.paid_count / inst.total_count) * 100);
            const remainingCount = inst.total_count - inst.paid_count;
            const remainingToman = (remainingCount * inst.installment_amount_rial) / 10;
            const isPaying = payingId === inst.id;

            return (
              <div
                key={inst.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-100">{inst.title}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800/40">
                        {inst.type === 'loan' ? 'وام بانکی' : 'قسط خرید کالا'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/40 font-num">
                        موعد: {toPersianDigits(inst.due_day_of_month)}ام ماه
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 font-num flex-wrap">
                      <span>مبلغ هر قسط: <strong className="text-slate-200">{formatRialAsToman(inst.installment_amount_rial)} تومان</strong></span>
                      <span>مانده بدهی: <strong className="text-rose-400">{formatRialAsToman(remainingToman * 10)} تومان</strong></span>
                      {inst.note && <span className="text-slate-500 font-sans">({inst.note})</span>}
                    </div>
                  </div>

                  {/* Quick Payment Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPayingId(isPaying ? null : inst.id)}
                      className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold transition-all"
                    >
                      {isPaying ? 'انصراف' : 'ثبت پرداخت قسط'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`آیا از حذف قسط «${inst.title}» اطمینان دارید؟`)) {
                          onDeleteInstallment(inst.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-num mb-1.5">
                    <span>پرداخت‌شده: {toPersianDigits(inst.paid_count)} از {toPersianDigits(inst.total_count)} قسط</span>
                    <span>{toPersianDigits(percent)}٪ تکمیل</span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Pay confirmation sub-panel */}
                {isPaying && (
                  <div className="mt-3.5 pt-3 border-t border-slate-800 bg-slate-950/60 p-3 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-300">کسر مبلغ قسط از حساب:</span>
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.display_name} ({formatRialAsToman(a.balance_rial)} تومان)
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => confirmPay(inst.id)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تایید پرداخت قسط {toPersianDigits(inst.paid_count + 1)}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Completed Installments Section */}
      {completedList.length > 0 && (
        <div className="mt-8 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>اقساط و وام‌های تسویه‌شده ({toPersianDigits(completedList.length)})</span>
          </h3>

          <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
            {completedList.map((inst) => (
              <div
                key={inst.id}
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-300 line-through">{inst.title}</span>
                  <span className="text-[10px] text-emerald-400 mr-2">تسویه شده</span>
                </div>
                <div className="flex items-center gap-3 font-num text-slate-400">
                  <span>{toPersianDigits(inst.total_count)} قسط کامل</span>
                  <button
                    onClick={() => onDeleteInstallment(inst.id)}
                    className="text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">افزودن قسط یا وام جدید</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">عنوان وام یا قسط:</label>
                <input
                  type="text"
                  placeholder="مثلا: وام قرض‌الحسنه رسالت، قسط گوشی..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">نوع تعهد:</label>
                  <select
                    value={type}
                    onChange={(e: any) => setType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="installment">قسط کالا</option>
                    <option value="loan">وام بانکی</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">روز سررسید در ماه (۱ تا ۳۱):</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="مثلا: ۱۵"
                    value={dueDayOfMonth}
                    onChange={(e) => setDueDayOfMonth(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">مبلغ هر قسط (تومان):</label>
                  <input
                    type="number"
                    placeholder="مثلا: ۲۵۰۰۰۰۰"
                    value={installmentAmountToman}
                    onChange={(e) => setInstallmentAmountToman(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">تعداد کل اقساط:</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="مثلا: ۱۲"
                    value={totalCount}
                    onChange={(e) => setTotalCount(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">یادداشت (اختیاری):</label>
                <input
                  type="text"
                  placeholder="کارمزد، شماره قرارداد و..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl"
                >
                  ثبت قسط جدید
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
