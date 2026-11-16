export interface StockItem {
  id: number;
  symbol: string;
  clean_symbol: string;
  exchange: string;
  company_name: string;
  sector: string;
  is_active: boolean;
  index_group: 'nifty50' | 'next50' | 'midcap100';
  last_price: number;
  last_updated: string;
  expected_return_pct: number;
  volatility_pct: number;
  one_year_return_pct: number;
  today_change_pct: number;
  today_change_amount: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  best_day_pct: number;
  best_day_date: string;
  worst_day_pct: number;
  worst_day_date: string;
  sparkline: number[];
}

export interface StockKeyNumbers {
  one_year_return_pct: number;
  volatility_pct: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  best_day_pct: number;
  best_day_date: string;
  worst_day_pct: number;
  worst_day_date: string;
}

export interface StockPricePoint {
  date: string;
  adj_close: number;
}
