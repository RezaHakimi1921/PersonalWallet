import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Trash2, 
  Calendar, 
  Tag, 
  Building2, 
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Transaction, Account, Category } from '../types';
import { formatRialAsToman, toPersianDigits, formatShamsi, getBankMeta } from '../utils/formatters';

interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onDeleteTransaction: (id: number, revertBalance: boolean) => Promise<void>;
  onOpenManual: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  accounts,
  categories,
  onDeleteTransaction,
  onOpenManual,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<number | 'all'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [expandedTxId, setExpandedTxId] = useState<number | null>(null);

  // Confirmed transactions
  const confirmedList = useMemo(() => {
    return transactions.filter((t) => t.status === 'confirmed');
  }, [transactions]);

  // Filtered
  const filteredList = useMemo(() => {
    return confirmedList.filter((t) => {
      if (directionFilter !== 'all' && t.direction !== directionFilter) return false;
      if (selectedAccountId !== 'all' && t.account_id !== selectedAccountId) return false;
      if (selectedCategoryId !== 'all' && t.category_id !== selectedCategoryId) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchNote = t.note?.toLowerCase().includes(q);
        const matchRaw = t.raw_text?.toLowerCase().includes(q);
        const matchCat = t.category_name?.toLowerCase().includes(q);
        const matchAcc = t.account_name?.toLowerCase().includes(q);
        if (!matchNote && !matchRaw && !matchCat && !matchAcc) return false;
      }
      return true;
    });
  }, [confirmedList, directionFilter, selectedAccountId, selectedCategoryId, searchTerm]);

  // Stats for current filtered view
  const totalFilteredExpense = filteredList
    .filter((t) => t.direction === 'expense')
    .reduce((s, t) => s + t.amount_rial, 0);

  const totalFilteredIncome = filteredList
    .filter((t) => t.direction === 'income')
    .reduce((s, t) => s + t.amount_rial, 0);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Search & Filter Header Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        {/* Search input and Direction Tabs */}
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجو در توضیحات، متن پیامک یا دسته..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors min-h-[40px]"
            />
          </div>

          {/* Direction toggle pill */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto">
            <button
              onClick={() => setDirectionFilter('all')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-medium transition-all text-center min-h-[34px] flex items-center justify-center ${
                directionFilter === 'all' ? 'bg-slate-800 text-white shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              همه ({toPersianDigits(confirmedList.length)})
            </button>
            <button
              onClick={() => setDirectionFilter('expense')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-medium transition-all text-center min-h-[34px] flex items-center justify-center ${
                directionFilter === 'expense' ? 'bg-rose-500/25 text-rose-300 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              مخارج
            </button>
            <button
              onClick={() => setDirectionFilter('income')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-medium transition-all text-center min-h-[34px] flex items-center justify-center ${
                directionFilter === 'income' ? 'bg-emerald-500/25 text-emerald-300 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              واریزها
            </button>
          </div>
        </div>

        {/* Dropdown Filters (Account & Category) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          {/* Account Filter */}
          <div className="flex-1 sm:flex-initial min-w-[140px] flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 min-h-[36px]">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-transparent text-slate-300 focus:outline-none text-xs w-full cursor-pointer"
            >
              <option value="all">تمام حساب‌ها</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex-1 sm:flex-initial min-w-[140px] flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 min-h-[36px]">
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-transparent text-slate-300 focus:outline-none text-xs w-full cursor-pointer"
            >
              <option value="all">تمام دسته‌بندی‌ها</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.direction === 'income' ? 'واریز' : 'هزینه'})
                </option>
              ))}
            </select>
          </div>

          {(directionFilter !== 'all' || selectedAccountId !== 'all' || selectedCategoryId !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setDirectionFilter('all');
                setSelectedAccountId('all');
                setSelectedCategoryId('all');
                setSearchTerm('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 px-2.5 py-1.5 rounded-lg bg-blue-950/40 border border-blue-800/40 min-h-[36px] flex items-center"
            >
              پاک کردن فیلترها
            </button>
          )}
        </div>
      </div>

      {/* Filter Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
          <span className="text-slate-400">مجموع هزینه‌های فیلترشده:</span>
          <span className="font-bold text-rose-400 font-num text-sm">
            {formatRialAsToman(totalFilteredExpense)} تومان
          </span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
          <span className="text-slate-400">مجموع واریزی‌های فیلترشده:</span>
          <span className="font-bold text-emerald-400 font-num text-sm">
            +{formatRialAsToman(totalFilteredIncome)} تومان
          </span>
        </div>
      </div>

      {/* Transactions List */}
      {filteredList.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
          تراکنشی با این مشخصات یافت نشد.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredList.map((tx) => {
            const isIncome = tx.direction === 'income';
            const meta = getBankMeta(tx.account_name || 'blu');
            const isExpanded = expandedTxId === tx.id;

            return (
              <div
                key={tx.id}
                className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 hover:border-slate-700/90 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left (RTL Right): Icon & Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {isIncome ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                          {tx.note || tx.category_name || 'تراکنش بدون عنوان'}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0 ${meta.chipBg}`}>
                          {tx.account_name}
                        </span>
                        {tx.category_name && (
                          <span className="text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md shrink-0">
                            {tx.category_name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-num flex items-center gap-2 flex-wrap">
                        <span>{formatShamsi(tx.created_at)}</span>
                        {tx.balance_after_rial != null && (
                          <span className="text-slate-500">· مانده: {formatRialAsToman(tx.balance_after_rial)} ت</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right (RTL Left): Amount & Expand Toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left" dir="ltr">
                      <div
                        className={`text-sm sm:text-base font-bold font-num ${
                          isIncome ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isIncome ? '+' : '-'}{formatRialAsToman(tx.amount_rial)}
                        <span className="text-[10px] font-normal ml-1">تومان</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                      className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
                      title="نمایش جزئیات بیشتر"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2.5 text-xs text-slate-300">
                    {tx.raw_text && (
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 font-mono text-[11px] text-slate-400 leading-relaxed">
                        <span className="text-slate-500 block text-[10px] font-sans mb-1">متن خام پیامک:</span>
                        {tx.raw_text}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 font-num">
                        شناسه سیستمی: #{tx.id}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm('آیا از حذف این تراکنش اطمینان دارید؟')) {
                            onDeleteTransaction(tx.id, false);
                          }
                        }}
                        className="text-rose-400 hover:text-rose-300 flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف تراکنش</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
