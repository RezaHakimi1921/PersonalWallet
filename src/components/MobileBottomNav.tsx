import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Clock, 
  ArrowLeftRight, 
  Plus, 
  Menu, 
  Building2, 
  CalendarClock, 
  TrendingUp, 
  Tags, 
  MessageSquareCode, 
  X,
  ChevronUp
} from 'lucide-react';
import { TabType } from '../types';

interface MobileBottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  pendingCount: number;
  onOpenManual: () => void;
  onOpenSmsSimulator: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  onOpenManual,
  onOpenSmsSimulator,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const moreItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'accounts', label: 'حساب‌های بانکی', icon: Building2 },
    { id: 'installments', label: 'اقساط و وام‌ها', icon: CalendarClock },
    { id: 'investments', label: 'سبد سرمایه‌گذاری', icon: TrendingUp },
    { id: 'categories', label: 'دسته‌بندی‌ها', icon: Tags },
  ];

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setShowMoreMenu(false);
  };

  const isMoreActive = ['accounts', 'installments', 'investments', 'categories'].includes(activeTab);

  return (
    <>
      {/* More Options Bottom Sheet */}
      {showMoreMenu && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm sm:hidden flex flex-col justify-end"
          onClick={() => setShowMoreMenu(false)}
        >
          <div 
            className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Menu className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-sm text-slate-100">سایر بخش‌های کیف‌پول</span>
              </div>
              <button 
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl text-xs font-semibold transition-all text-right ${
                      isActive
                        ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300'
                        : 'bg-slate-950 border border-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Test SMS Parser in More Sheet */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenSmsSimulator();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-700/40 text-indigo-300 text-xs font-semibold transition-all"
              >
                <div className="flex items-center gap-2">
                  <MessageSquareCode className="w-4 h-4 text-indigo-400" />
                  <span>شبیه‌ساز و تست پیامک بانک (iOS / Android)</span>
                </div>
                <span className="text-[10px] bg-indigo-900/80 px-2 py-0.5 rounded-full border border-indigo-600/40">
                  تست
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar Shell (Mobile only) */}
      <nav 
        id="mobile-bottom-nav"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 px-3 py-1.5 flex items-center justify-around shadow-2xl"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        {/* 1. Dashboard */}
        <button
          onClick={() => handleSelectTab('overview')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'overview' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 mb-0.5 ${activeTab === 'overview' ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="text-[10px]">داشبورد</span>
        </button>

        {/* 2. Pending */}
        <button
          onClick={() => handleSelectTab('pending')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
            activeTab === 'pending' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Clock className={`w-5 h-5 mb-0.5 ${activeTab === 'pending' ? 'text-blue-400' : 'text-slate-400'}`} />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-amber-500 text-slate-950 font-num leading-tight animate-pulse">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">در انتظار</span>
        </button>

        {/* 3. Center Action Button (FAB) */}
        <div className="relative -top-4 flex items-center justify-center">
          <button
            onClick={onOpenManual}
            id="mobile-center-add-btn"
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-600/40 flex items-center justify-center border-4 border-slate-950 active:scale-95 transition-all"
            title="ثبت سریع تراکنش"
            aria-label="ثبت سریع تراکنش"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* 4. Transactions */}
        <button
          onClick={() => handleSelectTab('transactions')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'transactions' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowLeftRight className={`w-5 h-5 mb-0.5 ${activeTab === 'transactions' ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="text-[10px]">تراکنش‌ها</span>
        </button>

        {/* 5. More Menu */}
        <button
          onClick={() => setShowMoreMenu(true)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
            isMoreActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Menu className={`w-5 h-5 mb-0.5 ${isMoreActive ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="text-[10px]">بیشتر</span>
          {isMoreActive && (
            <span className="absolute -top-0.5 right-2 w-1.5 h-1.5 rounded-full bg-blue-400" />
          )}
        </button>
      </nav>
    </>
  );
};
