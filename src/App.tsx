import React, { useState, useEffect, useCallback } from 'react';
import { 
  TabType, 
  Account, 
  Category, 
  Installment, 
  Investment, 
  Transaction, 
  OverviewSummary 
} from './types';
import { Navbar } from './components/Navbar';
import { OverviewView } from './components/OverviewView';
import { PendingView } from './components/PendingView';
import { TransactionsView } from './components/TransactionsView';
import { AccountsView } from './components/AccountsView';
import { InstallmentsView } from './components/InstallmentsView';
import { InvestmentsView } from './components/InvestmentsView';
import { CategoriesView } from './components/CategoriesView';
import { ManualModal } from './components/ManualModal';
import { SmsSimulatorModal } from './components/SmsSimulatorModal';
import { TransferModal } from './components/TransferModal';
import { Plus, CheckCircle, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Core Data State
  const [overview, setOverview] = useState<OverviewSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Modals
  const [isManualOpen, setIsManualOpen] = useState<boolean>(false);
  const [isSmsSimOpen, setIsSmsSimOpen] = useState<boolean>(false);
  const [isTransferOpen, setIsTransferOpen] = useState<boolean>(false);

  // Privacy Mode State (Masking/Blurring account numbers and balances)
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('wallet_privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  const togglePrivacyMode = () => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('wallet_privacy_mode', String(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch all app data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ovRes, accRes, catRes, instRes, invRes, txRes] = await Promise.all([
        fetch('/api/overview').then((r) => r.json()),
        fetch('/api/accounts').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/installments').then((r) => r.json()),
        fetch('/api/investments').then((r) => r.json()),
        fetch('/api/transactions').then((r) => r.json()),
      ]);

      setOverview(ovRes);
      setAccounts(accRes);
      setCategories(catRes);
      setInstallments(instRes);
      setInvestments(invRes);
      setTransactions(txRes);
    } catch (err) {
      console.error('Failed to fetch data', err);
      showToast('خطا در برقراری ارتباط با سرور', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Check for deep link hash from notification or bookmark
    if (window.location.hash.startsWith('#/tx/')) {
      setActiveTab('pending');
    }
  }, [fetchData]);

  // Derived: pending transactions
  const pendingTransactions = transactions.filter((t) => t.status === 'pending');

  // Handlers
  const handleConfirmPending = async (id: number, categoryId: number | null, note: string | null) => {
    try {
      const res = await fetch(`/api/transactions/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId, note }),
      });
      if (!res.ok) throw new Error();
      showToast('تراکنش با موفقیت قطعی شد');
      await fetchData();
    } catch {
      showToast('خطا در ثبت تراکنش', 'error');
    }
  };

  const handleConfirmInstallment = async (id: number, installmentId: number) => {
    try {
      const res = await fetch(`/api/transactions/${id}/confirm-installment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installment_id: installmentId }),
      });
      if (!res.ok) throw new Error();
      showToast('پرداخت قسط با موفقیت ثبت شد');
      await fetchData();
    } catch {
      showToast('خطا در ثبت قسط', 'error');
    }
  };

  const handleDeleteTransaction = async (id: number, revertBalance: boolean = false) => {
    try {
      const res = await fetch(`/api/transactions/${id}?revertBalance=${revertBalance}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      showToast('تراکنش حذف شد');
      await fetchData();
    } catch {
      showToast('خطا در حذف تراکنش', 'error');
    }
  };

  const handleManualTransaction = async (txData: {
    account_id: number;
    amount_rial: number;
    direction: 'expense' | 'income';
    category_id: number | null;
    note: string | null;
  }) => {
    const res = await fetch('/api/transactions/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txData),
    });
    if (!res.ok) throw new Error();
    showToast('تراکنش دستی با موفقیت ثبت شد');
    await fetchData();
  };

  const handleUpdateAccount = async (id: number, updates: Partial<Account>) => {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error();
    showToast('اطلاعات حساب بروزرسانی شد');
    await fetchData();
  };

  const handleAddAccount = async (newAcc: Partial<Account>) => {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAcc),
    });
    if (!res.ok) throw new Error();
    showToast('حساب بانکی جدید با موفقیت اضافه شد');
    await fetchData();
  };

  const handleTransfer = async (transferData: {
    from_account_id: number;
    to_account_id: number;
    amount_rial: number;
    note?: string;
  }) => {
    const res = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transferData),
    });
    if (!res.ok) throw new Error();
    showToast('انتقال بین‌بانکی با موفقیت انجام شد');
    await fetchData();
  };

  const handlePayInstallment = async (id: number, accountId?: number) => {
    const res = await fetch(`/api/installments/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: accountId }),
    });
    if (!res.ok) throw new Error();
    showToast('پرداخت قسط ثبت شد و از موجودی کسر گردید');
    await fetchData();
  };

  const handleAddInstallment = async (newInst: Partial<Installment>) => {
    const res = await fetch('/api/installments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInst),
    });
    if (!res.ok) throw new Error();
    showToast('قسط یا وام جدید با موفقیت ثبت شد');
    await fetchData();
  };

  const handleDeleteInstallment = async (id: number) => {
    const res = await fetch(`/api/installments/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error();
    showToast('قسط حذف شد');
    await fetchData();
  };

  const handleAddInvestment = async (newInv: Partial<Investment>) => {
    const res = await fetch('/api/investments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInv),
    });
    if (!res.ok) throw new Error();
    showToast('دارایی جدید با موفقیت اضافه شد');
    await fetchData();
  };

  const handleUpdateInvestment = async (id: number, updates: Partial<Investment>) => {
    const res = await fetch(`/api/investments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error();
    showToast('ارزش روز دارایی بروزرسانی شد');
    await fetchData();
  };

  const handleDeleteInvestment = async (id: number) => {
    const res = await fetch(`/api/investments/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error();
    showToast('سرمایه‌گذاری حذف شد');
    await fetchData();
  };

  const handleAddCategory = async (cat: Partial<Category>) => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cat),
    });
    if (!res.ok) throw new Error();
    showToast('دسته‌بندی جدید ثبت شد');
    await fetchData();
  };

  const handleUpdateCategory = async (id: number, updates: Partial<Category>) => {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error();
    showToast('دسته‌بندی بروزرسانی شد');
    await fetchData();
  };

  const handleTriggerWebhook = async (bank: string, text: string) => {
    const res = await fetch('/api/webhook/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank, text }),
    });
    const data = await res.json();
    await fetchData();
    setActiveTab('pending');
    return data;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-20 sm:pb-8">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-700 text-emerald-300'
              : 'bg-rose-950/90 border-rose-700 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingTransactions.length}
        overview={overview}
        onOpenManual={() => setIsManualOpen(true)}
        onOpenSmsSimulator={() => setIsSmsSimOpen(true)}
        onRefresh={fetchData}
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview' && (
          <OverviewView
            overview={overview}
            accounts={accounts}
            pendingTransactions={pendingTransactions}
            installments={installments}
            recentTransactions={transactions.slice(0, 10)}
            categories={categories}
            onNavigateTab={setActiveTab}
            onOpenSmsSimulator={() => setIsSmsSimOpen(true)}
            isPrivacyMode={isPrivacyMode}
            onTogglePrivacyMode={togglePrivacyMode}
          />
        )}

        {activeTab === 'pending' && (
          <PendingView
            pendingTransactions={pendingTransactions}
            categories={categories}
            installments={installments}
            onConfirm={handleConfirmPending}
            onConfirmInstallment={handleConfirmInstallment}
            onDelete={(id) => handleDeleteTransaction(id, false)}
            onOpenSmsSimulator={() => setIsSmsSimOpen(true)}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenManual={() => setIsManualOpen(true)}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsView
            accounts={accounts}
            onUpdateAccount={handleUpdateAccount}
            onAddAccount={handleAddAccount}
            onOpenTransfer={() => setIsTransferOpen(true)}
            isPrivacyMode={isPrivacyMode}
            onTogglePrivacyMode={togglePrivacyMode}
          />
        )}

        {activeTab === 'installments' && (
          <InstallmentsView
            installments={installments}
            accounts={accounts}
            onPayInstallment={handlePayInstallment}
            onAddInstallment={handleAddInstallment}
            onDeleteInstallment={handleDeleteInstallment}
          />
        )}

        {activeTab === 'investments' && (
          <InvestmentsView
            investments={investments}
            onAddInvestment={handleAddInvestment}
            onUpdateInvestment={handleUpdateInvestment}
            onDeleteInvestment={handleDeleteInvestment}
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesView
            categories={categories}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
          />
        )}
      </main>

      {/* Mobile Floating Action Button (FAB) */}
      <button
        id="mobile-fab"
        onClick={() => setIsManualOpen(true)}
        className="sm:hidden fixed bottom-5 left-5 z-40 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/40 flex items-center justify-center active:scale-95 transition-all"
        title="ثبت سریع تراکنش"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modals */}
      <ManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        accounts={accounts}
        categories={categories}
        onSubmit={handleManualTransaction}
      />

      <SmsSimulatorModal
        isOpen={isSmsSimOpen}
        onClose={() => setIsSmsSimOpen(false)}
        accounts={accounts}
        onTriggerWebhook={handleTriggerWebhook}
      />

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        accounts={accounts}
        onTransfer={handleTransfer}
      />
    </div>
  );
}
