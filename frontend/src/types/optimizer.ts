export interface StockUniverseItem {
  symbol: string;
  name: string;
  sector: string;
  cost: number;
  expected_return_pct: number;
  volatility_pct: number;
  index_group?: string;
  one_year_return_pct?: number;
  trading_days_count?: number;
  has_missing_days?: boolean;
}

export { NSE_200_STOCKS as NSE_STOCKS_CATALOG } from '../data/nse200Catalog';

export interface PickedStock {
  symbol: string;
  name: string;
  sector: string;
  cost: number;
  expected_profit: number;
  expected_return_pct: number;
  volatility_pct: number;
  weight_pct: number;
  shares: number;
  is_exclusive?: boolean;
  pick_order?: number;
}

export interface AlgoResult {
  algorithm: string;
  budget_used: number;
  unallocated_budget: number;
  budget_utilization_pct: number;
  expected_return_rupees: number;
  expected_return_pct: number;
  volatility_pct: number;
  sharpe_ratio: number;
  stocks_count: number;
  runtime_ms: number;
  stocks: PickedStock[];
}

export interface ComparisonData {
  budget: number;
  risk_aversion: number;
  risk_label: string;
  verdict: string;
  educational_note: string;
  unit_step?: number;
  scale_note?: string | null;
  comparison_id?: number;
  exclusive_picks: {
    only_greedy: string[];
    only_knapsack: string[];
    common: string[];
  };
  winners: {
    expected_return: 'greedy' | 'knapsack' | 'tie';
    sharpe_ratio: 'greedy' | 'knapsack' | 'tie';
    speed: 'greedy' | 'knapsack' | 'tie';
    budget_utilization: 'greedy' | 'knapsack' | 'tie';
    profit_diff_rupees: number;
    speed_ratio: number;
  };
  greedy: AlgoResult;
  knapsack: AlgoResult;
}

export interface HistoryItem {
  id: number;
  budget: number;
  risk_aversion: number;
  risk_label: string;
  verdict: string;
  created_at: string;
  selected_symbols: string[];
  runs: Array<{
    algorithm: string;
    budget_used: number;
    expected_return: number;
    sharpe_ratio: number;
    execution_time_ms: number;
  }>;
}
