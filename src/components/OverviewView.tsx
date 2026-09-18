import React from 'react';
import { 
  PiggyBank, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  Eye,
  EyeOff
} from 'lucide-react';
import { OverviewSummary, Account, Transaction, Installment, Category } from '../types';
import { formatRialAsToman, toPersianDigits, getBankMeta, formatShamsi } from '../utils/formatters';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface OverviewViewProps {
  overview: OverviewSummary | null;
  accounts: Account[];
  pendingTransactions: Transaction[];
  installments: Installment[];
  recentTransactions: Transaction[];
  categories: Category[];
  onNavigateTab: (tab: any) => void;
  onOpenSmsSimulator: () => void;
  isPrivacyMode?: boolean;
  onTogglePrivacyMode?: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

export const OverviewView: React.FC<OverviewViewProps> = ({
  overview,
  accounts,
  pendingTransactions,
  installments,
  recentTransactions,
  categories,
  onNavigateTab,
  onOpenSmsSimulator,
  isPrivacyMode = false,
  onTogglePrivacyMode,
}) => {
  if (!overview) return null;

  // Calculate category breakdown for recent expenses
  const expenseByCategory: { [key: string]: number } = {};
  recentTransactions
    .filter((t) => t.direction === 'expense' && t.category_id)
    .forEach((t) => {
      const cat = categories.find((c) => c.id === t.category_id);
      const name = cat ? cat.name : 'سایر';
      expenseByCategory[name] = (expenseByCategory[name] || 0) + t.amount_rial;
    });

  const chartData = Object.entries(expenseByCategory).map(([name, amount_rial]) => ({
    name,
    value: Math.round(amount_rial / 10),
  }));

  // Nearest upcoming installment
  const activeLoans = installments.filter((i) => i.status === 'active');

  return (
    <div className="space-y-6">
      {/* Top Header with Title and Privacy Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-100">نمای کلی و داشبورد مالی</h2>
          <p className="text-xs text-slate-400 mt-0.5">وضعیت موجودی نقد حساب‌های بانکی و مانده بدهی وام‌ها</p>
        </div>

        {onTogglePrivacyMode && (
          <button
            id="btn-toggle-privacy-overview"
            onClick={onTogglePrivacyMode}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all active:scale-95 shrink-0 ${
              isPrivacyMode
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 shadow-sm'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title={isPrivacyMode ? 'آشکارسازی اطلاعات حساب و موجودی‌ها' : 'محو کردن موجودی و اطلاعات حساب (حفظ حریم خصوصی)'}
          >
            {isPrivacyMode ? (
              <>
                <EyeOff className="w-4 h-4 text-amber-400" />
                <span>حالت محرمانه (فعال)</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-slate-400" />
                <span>محو کردن ارقام حساب</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Alert banner if there are pending transactions */}
      {pendingTransactions.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-semibold text-amber-200 text-sm">
                {toPersianDigits(pendingTransactions.length)} پیامک بانکی در انتظار تایید
              </h4>
              <p className="text-xs text-amber-400/80 mt-0.5">
                تراکنش‌های جدید از پیامک‌ها دریافت شده‌اند و نیاز به دسته‌بندی دارند.
              </p>
            </div>
          </div>
          <button
            id="btn-goto-pending"
            onClick={() => onNavigateTab('pending')}
            className="w-full sm:w-auto text-center px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 min-h-[40px] flex items-center justify-center"
          >
            مشاهده و تایید تراکنش‌ها
          </button>
        </div>
      )}

      {/* Primary 4 Metric Cards (Focused purely on Cash Balance, Loan Debt, and Monthly Flows) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Liquid Cash in Banks */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">موجودی نقدی در حساب‌ها</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className={`text-xl sm:text-2xl font-black text-emerald-400 font-num tracking-tight break-words ${isPrivacyMode ? 'privacy-blur select-none' : ''}`}>
              {isPrivacyMode ? '••••••••' : formatRialAsToman(overview.totalBalanceRial)} <span className="text-xs font-normal text-slate-400">تومان</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              مجموع موجودی {toPersianDigits(accounts.length)} حساب بانکی فعال
            </p>
          </div>
        </div>

        {/* 2. Total Loan Debt Remaining */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">مانده کل بدهی وام‌ها</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className={`text-xl sm:text-2xl font-black text-rose-400 font-num tracking-tight break-words ${isPrivacyMode ? 'privacy-blur select-none' : ''}`}>
              {isPrivacyMode ? '••••••••' : formatRialAsToman(overview.totalLoanRemainingRial)} <span className="text-xs font-normal text-slate-400">تومان</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              مجموع اقساط پرداخت‌نشده تسهیلات
            </p>
          </div>
        </div>

        {/* 3. Monthly Income Inflows */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">درآمد و واریزی‌های ماه</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className={`text-xl sm:text-2xl font-black text-blue-400 font-num tracking-tight break-words ${isPrivacyMode ? 'privacy-blur select-none' : ''}`}>
              {isPrivacyMode ? '••••••••' : `+${formatRialAsToman(overview.monthlyIncomeRial)}`} <span className="text-xs font-normal text-slate-400">تومان</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              واریزی‌های تایید شده ۳۰ روز گذشته
            </p>
          </div>
        </div>

        {/* 4. Monthly Expense Outflows */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">مخارج و هزینه‌های ماه</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className={`text-xl sm:text-2xl font-black text-amber-400 font-num tracking-tight break-words ${isPrivacyMode ? 'privacy-blur select-none' : ''}`}>
              {isPrivacyMode ? '••••••••' : `-${formatRialAsToman(overview.monthlyExpenseRial)}`} <span className="text-xs font-normal text-slate-400">تومان</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              برداشت و هزینه‌های ۳۰ روز گذشته
            </p>
          </div>
        </div>
      </div>

      {/* Middle Row: Bank Cards Carousel & Monthly Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bank Accounts Status Preview */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">موجودی حساب‌های بانکی</h3>
              <p className="text-xs text-slate-400 mt-0.5">همگام با پیامک‌های تراکنش خودکار</p>
            </div>
            <button
              onClick={() => onNavigateTab('accounts')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              مدیریت حساب‌ها ←
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {accounts.map((acc) => {
              const meta = getBankMeta(acc.bank_code);
              return (
                <div
                  key={acc.id}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${meta.chipBg}`}>
                      {acc.display_name}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className={`text-lg font-bold text-slate-100 font-num ${isPrivacyMode ? 'privacy-blur select-none' : ''}`}>
                      {isPrivacyMode ? '••••••••' : formatRialAsToman(acc.balance_rial)}
                    </div>
                    <div className="text-[11px] text-slate-500 font-num">
                      تومان
                    </div>
                  </div>
                  {acc.card_number && (
                    <div className="mt-2 pt-2 border-t border-slate-800/50 text-[10px] text-slate-500 font-mono tracking-wider text-left" dir="ltr">
                      {isPrivacyMode ? '•••• •••• •••• ••••' : acc.card_number}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 30-Day Cash Flow Mini Box */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-100 text-sm">جریان مالی (۳۰ روز گذشته)</h3>
            <p className="text-xs text-slate-400 mt-0.5">ورودی و خروجی تایید شده</p>

            <div className="mt-5 space-y-3">
              {/* Income */}
              <div className="bg-slate-950/50 rounded-xl p-3 border border-emerald-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">واریز و درآمد</span>
                    <span className={`text-sm font-bold text-emerald-400 font-num ${isPrivacyMode ? 'privacy-blur select-none' : ''}`}>
                      {isPrivacyMode ? '•••••••• تومان' : `+${formatRialAsToman(overview.monthlyIncomeRial)} تومان`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expense */}
              <div className="bg-slate-950/50 rounded-xl p-3 border border-rose-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">برداشت و مخارج</span>
                    <span className={`text-sm font-bold text-rose-400 font-num ${isPrivacyMode ? 'privacy-blur select-none' : ''}`}>
                      {isPrivacyMode ? '•••••••• تومان' : `-${formatRialAsToman(overview.monthlyExpenseRial)} تومان`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>تراز این دوره:</span>
            <span
              className={`font-bold font-num ${isPrivacyMode ? 'privacy-blur select-none' : ''} ${
                overview.monthlyIncomeRial >= overview.monthlyExpenseRial ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPrivacyMode
                ? '••••••••'
                : `${formatRialAsToman(overview.monthlyIncomeRial - overview.monthlyExpenseRial)} تومان`}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Expense Chart & Upcoming Loan Due Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Expense by Category Pie Chart */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-100 text-sm">سهم هزینه‌ها به تفکیک دسته‌بندی</h3>
            <span className="text-xs text-slate-400">تراکنش‌های اخیر</span>
          </div>

          {chartData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-xs">
              <span>هنوز هزینه‌ای با دسته‌بندی مشخص ثبت نشده است</span>
            </div>
          ) : (
            <div className="h-56 flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${toPersianDigits(Number(val).toLocaleString())} تومان`, '']}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="space-y-1.5 overflow-y-auto max-h-48 text-xs text-slate-300 w-full sm:w-auto">
                {chartData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="truncate max-w-[110px]">{item.name}</span>
                    </div>
                    <span className="font-num text-slate-400 font-medium">
                      {toPersianDigits(item.value.toLocaleString())} ت
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Loans & Installments Status */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-100 text-sm">اقساط و وام‌های فعال</h3>
              <button
                onClick={() => onNavigateTab('installments')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                مشاهده همه ←
              </button>
            </div>

            {activeLoans.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-2" />
                <span>هیچ قسط فعالی ندارید</span>
              </div>
            ) : (
              <div className="space-y-3">
                {activeLoans.slice(0, 3).map((loan) => {
                  const percent = Math.round((loan.paid_count / loan.total_count) * 100);
                  return (
                    <div key={loan.id} className="bg-slate-950/50 border border-slate-800/70 rounded-xl p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-200">{loan.title}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-num">
                          موعد: {toPersianDigits(loan.due_day_of_month)}ام هر ماه
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-2 font-num">
                        <span>مبلغ هر قسط: {formatRialAsToman(loan.installment_amount_rial)} تومان</span>
                        <span>{toPersianDigits(loan.paid_count)} از {toPersianDigits(loan.total_count)} ({toPersianDigits(percent)}%)</span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">شبیه‌ساز پیامک بانک برای تست:</span>
            <button
              onClick={onOpenSmsSimulator}
              className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
              تست پارسر بانک ←
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
