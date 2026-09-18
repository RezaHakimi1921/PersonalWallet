export interface Account {
  id: number;
  bank_code: string;
  display_name: string;
  balance_rial: number;
  card_number?: string;
  color?: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  direction: 'expense' | 'income';
  is_active: boolean;
  icon?: string;
  created_at: string;
}

export interface Installment {
  id: number;
  title: string;
  type: 'installment' | 'loan';
  total_amount_rial: number | null;
  installment_amount_rial: number;
  total_count: number;
  paid_count: number;
  due_day_of_month: number;
  status: 'active' | 'completed';
  note: string | null;
  created_at: string;
}

export interface Investment {
  id: number;
  title: string;
  invested_amount_rial: number;
  current_value_rial: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  account_name?: string;
  account_color?: string;
  amount_rial: number;
  direction: 'expense' | 'income';
  balance_after_rial: number | null;
  raw_text: string;
  bank_reported_time: string | null;
  status: 'pending' | 'confirmed';
  category_id: number | null;
  category_name?: string;
  note: string | null;
  installment_id: number | null;
  created_at: string;
}

export interface OverviewSummary {
  totalBalanceRial: number;
  totalInvestmentsRial: number;
  totalInvestedOriginalRial: number;
  investmentProfitRial: number;
  totalLoanRemainingRial: number;
  netWorthRial: number;
  monthlyExpenseRial: number;
  monthlyIncomeRial: number;
  pendingCount: number;
  accountsCount: number;
  activeInstallmentsCount: number;
}

export type TabType = 'pending' | 'transactions' | 'accounts' | 'installments' | 'investments' | 'categories' | 'overview';
