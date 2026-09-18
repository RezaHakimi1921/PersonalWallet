import React from 'react';
import { 
  Wallet, 
  Clock, 
  ArrowLeftRight, 
  Building2, 
  CalendarClock, 
  TrendingUp, 
  Tags, 
  PlusCircle, 
  MessageSquareCode, 
  RotateCw,
  LayoutDashboard
} from 'lucide-react';
import { TabType, OverviewSummary } from '../types';
import { formatRialAsToman } from '../utils/formatters';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  pendingCount: number;
  overview: OverviewSummary | null;
  onOpenManual: () => void;
  onOpenSmsSimulator: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  overview,
  onOpenManual,
  onOpenSmsSimulator,
  onRefresh,
  isLoading,
}) => {
  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'overview', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'pending', label: 'در انتظار تایید', icon: Clock, badge: pendingCount },
    { id: 'transactions', label: 'تراکنش‌ها', icon: ArrowLeftRight },
    { id: 'accounts', label: 'حساب‌های بانکی', icon: Building2 },
    { id: 'installments', label: 'اقساط و وام‌ها', icon: CalendarClock },
    { id: 'investments', label: 'سرمایه‌گذاری', icon: TrendingUp },
    { id: 'categories', label: 'دسته‌بندی‌ها', icon: Tags },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 transition-all">
      {/* Top Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Brand & Net Worth */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-100 tracking-tight">کیف پول شخصی</h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/50">
                PWA نسخه ۲.۰
              </span>
            </div>
            {overview && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5 font-num">
                <span>دارایی خالص:</span>
                <span className="font-bold text-slate-200">
                  {formatRialAsToman(overview.netWorthRial)} تومان
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            id="btn-refresh"
            onClick={onRefresh}
            title="بروزرسانی اطلاعات"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all active:scale-95"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* SMS Simulator Button */}
          <button
            id="btn-sms-sim"
            onClick={onOpenSmsSimulator}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/40 text-xs font-medium transition-all active:scale-95"
            title="شبیه‌ساز و تست پارسر پیامک بانکی"
          >
            <MessageSquareCode className="w-4 h-4 text-indigo-400" />
            <span>تست پیامک بانک</span>
          </button>

          {/* Manual Entry Button */}
          <button
            id="btn-manual-tx"
            onClick={onOpenManual}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-600/30 transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>ثبت تراکنش</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Scrollable on mobile) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <nav className="flex gap-1.5 overflow-x-auto py-2 scrollbar-none no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 relative ${
                  isActive
                    ? 'bg-slate-800/90 text-white shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950 font-num">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
