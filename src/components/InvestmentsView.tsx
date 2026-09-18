import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Coins, 
  Sparkles,
  PieChart
} from 'lucide-react';
import { Investment } from '../types';
import { formatRialAsToman, toPersianDigits, formatShamsi } from '../utils/formatters';

interface InvestmentsViewProps {
  investments: Investment[];
  onAddInvestment: (newInv: Partial<Investment>) => Promise<void>;
  onUpdateInvestment: (id: number, updates: Partial<Investment>) => Promise<void>;
  onDeleteInvestment: (id: number) => Promise<void>;
}

export const InvestmentsView: React.FC<InvestmentsViewProps> = ({
  investments,
  onAddInvestment,
  onUpdateInvestment,
  onDeleteInvestment,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [investedAmountToman, setInvestedAmountToman] = useState('');
  const [currentValueToman, setCurrentValueToman] = useState('');
  const [note, setNote] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [newValToman, setNewValToman] = useState('');

  const totalInvested = investments.reduce((s, i) => s + Number(i.invested_amount_rial), 0);
  const totalCurrentValue = investments.reduce((s, i) => s + Number(i.current_value_rial), 0);
  const totalProfitRial = totalCurrentValue - totalInvested;
  const totalProfitPercent = totalInvested > 0 ? Math.round((totalProfitRial / totalInvested) * 100) : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !investedAmountToman) return;
    const invToman = Number(investedAmountToman.replace(/[,،]/g, ''));
    const curToman = currentValueToman ? Number(currentValueToman.replace(/[,،]/g, '')) : invToman;

    await onAddInvestment({
      title,
      invested_amount_rial: invToman * 10,
      current_value_rial: curToman * 10,
      note: note || undefined,
    });

    setShowAddModal(false);
    setTitle('');
    setInvestedAmountToman('');
    setCurrentValueToman('');
    setNote('');
  };

  const startEdit = (inv: Investment) => {
    setEditingId(inv.id);
    setNewValToman(String(Math.round(inv.current_value_rial / 10)));
  };

  const saveEdit = async (id: number) => {
    const val = Number(newValToman.replace(/[,،]/g, ''));
    if (isNaN(val)) return;
    await onUpdateInvestment(id, { current_value_rial: val * 10 });
    setEditingId(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Overview Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>سبد سرمایه‌گذاری و دارایی‌ها</span>
            <span className="text-xs font-normal text-slate-400">
              ({toPersianDigits(investments.length)} دارایی ثبت شده)
            </span>
          </h2>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 flex-wrap">
            <span>ارزش روز کل: <strong className="text-purple-400 font-num">{formatRialAsToman(totalCurrentValue)} تومان</strong></span>
            <span>اصل سرمایه: <strong className="text-slate-300 font-num">{formatRialAsToman(totalInvested)} تومان</strong></span>
            <span className={`font-num font-bold ${totalProfitRial >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalProfitRial >= 0 ? '+' : ''}{formatRialAsToman(totalProfitRial)} تومان ({toPersianDigits(totalProfitPercent)}%)
            </span>
          </div>
        </div>

        <button
          id="btn-add-investment"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن دارایی جدید</span>
        </button>
      </div>

      {/* Investments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {investments.map((inv) => {
          const profitRial = inv.current_value_rial - inv.invested_amount_rial;
          const profitPercent = inv.invested_amount_rial > 0
            ? ((profitRial / inv.invested_amount_rial) * 100).toFixed(1)
            : '0';
          const isProfitable = profitRial >= 0;
          const isEditing = editingId === inv.id;

          return (
            <div
              key={inv.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100">{inv.title}</h3>
                      {inv.note && <span className="text-[11px] text-slate-400">{inv.note}</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`آیا از حذف سرمایه‌گذاری «${inv.title}» مطمئن هستید؟`)) {
                        onDeleteInvestment(inv.id);
                      }
                    }}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-4 space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>مبلغ سرمایه‌گذاری اولیه:</span>
                    <span className="font-num text-slate-200 font-medium">
                      {formatRialAsToman(inv.invested_amount_rial)} تومان
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">ارزش روز فعلی:</span>
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={newValToman}
                          onChange={(e) => setNewValToman(e.target.value)}
                          className="w-24 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-100"
                        />
                        <button onClick={() => saveEdit(inv.id)} className="p-1 bg-emerald-600 rounded text-white">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 bg-slate-800 rounded text-slate-300">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-num font-bold text-purple-300">
                          {formatRialAsToman(inv.current_value_rial)} تومان
                        </span>
                        <button
                          onClick={() => startEdit(inv)}
                          className="p-1 text-slate-500 hover:text-slate-300"
                          title="بروزرسانی ارزش روز"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">سود / زیان کل:</span>
                    <span
                      className={`font-num font-bold flex items-center gap-1 ${
                        isProfitable ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isProfitable ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>
                        {isProfitable ? '+' : ''}{formatRialAsToman(profitRial)} تومان ({toPersianDigits(profitPercent)}%)
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[10px] text-slate-500 font-num text-left" dir="ltr">
                آخرین بروزرسانی: {formatShamsi(inv.updated_at || inv.created_at)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">افزودن دارایی / سرمایه‌گذاری جدید</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">عنوان دارایی:</label>
                <input
                  type="text"
                  placeholder="مثلا: صندوق طلا عیار، تتر، سکه امامی، سهام فملی..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">مبلغ سرمایه‌گذاری شده (تومان):</label>
                <input
                  type="number"
                  placeholder="مثلا: ۱۰۰۰۰۰۰۰"
                  value={investedAmountToman}
                  onChange={(e) => setInvestedAmountToman(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">ارزش روز فعلی (تومان - اختیاری):</label>
                <input
                  type="number"
                  placeholder="در صورت خالی بودن، برابر با مبلغ اولیه در نظر گرفته می‌شود"
                  value={currentValueToman}
                  onChange={(e) => setCurrentValueToman(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">یادداشت (اختیاری):</label>
                <input
                  type="text"
                  placeholder="توضیحات پلتفرم، تعداد واحدها..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 min-h-[38px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl min-h-[40px]"
                >
                  ثبت سرمایه‌گذاری
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl min-h-[40px]"
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
