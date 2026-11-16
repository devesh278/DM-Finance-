import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  StockHolding,
  DEMO_STOCKS,
  computePortfolioMetrics,
} from '../data/mockPortfolio';
import { formatINR, formatPercent } from '../utils/formatters';
import { AllocationChart } from './AllocationChart';
import { AddStockModal } from './AddStockModal';

interface DashboardProps {
  onNavigateToOptimizer?: () => void;
  onNavigateHome?: () => void;
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  isDemo?: boolean;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onShowToast?: (msg: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToOptimizer,
  isLoading = false,
  hasError = false,
  onRetry,
  isDemo = false,
  onOpenAuth,
  onShowToast,
}) => {
  const [holdings, setHoldings] = useState<StockHolding[]>(() => {
    const saved = localStorage.getItem('dalal_holdings_v2');
    if (saved) return JSON.parse(saved);
    localStorage.removeItem('dalal_holdings');
    localStorage.setItem('dalal_holdings_v2', JSON.stringify(DEMO_STOCKS));
    return DEMO_STOCKS;
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editShares, setEditShares] = useState<number>(0);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);

  // Tooltip states
  const [volatilityTooltipOpen, setVolatilityTooltipOpen] = useState(false);
  const [sharpeTooltipOpen, setSharpeTooltipOpen] = useState(false);

  // Sync holdings to localStorage & window event so navbar reset can sync
  const updateHoldings = (newHoldings: StockHolding[]) => {
    setHoldings(newHoldings);
    localStorage.setItem('dalal_holdings_v2', JSON.stringify(newHoldings));
  };

  // Allow resetting / syncing portfolio via custom event
  React.useEffect(() => {
    const handleReset = () => {
      const saved = localStorage.getItem('dalal_holdings_v2');
      if (saved !== null) {
        setHoldings(JSON.parse(saved));
      } else {
        updateHoldings(DEMO_STOCKS);
      }
    };
    window.addEventListener('reset-demo-portfolio', handleReset);
    return () => window.removeEventListener('reset-demo-portfolio', handleReset);
  }, []);

  // Compute all metrics dynamically from active holdings
  const metrics = useMemo(() => computePortfolioMetrics(holdings), [holdings]);

  // Handlers
  const handleAddStock = (newStock: StockHolding) => {
    const existingIndex = holdings.findIndex((h) => h.symbol === newStock.symbol);
    if (existingIndex >= 0) {
      const existing = holdings[existingIndex];
      const combinedShares = existing.shares + newStock.shares;
      const totalCost = (existing.shares * existing.avgBuyPrice) + (newStock.shares * newStock.avgBuyPrice);
      const newAvgBuy = totalCost / combinedShares;

      const updated = [...holdings];
      updated[existingIndex] = {
        ...existing,
        shares: combinedShares,
        avgBuyPrice: Math.round(newAvgBuy * 100) / 100,
      };
      updateHoldings(updated);
    } else {
      updateHoldings([...holdings, newStock]);
    }

    // Briefly highlight the new or updated row in the holdings table
    setHighlightedSymbol(newStock.symbol);
    setTimeout(() => {
      setHighlightedSymbol(null);
    }, 2500);

    // Toast notification per requirement
    const shortName = newStock.name.split(' ')[0];
    onShowToast?.(`Added ${newStock.shares} shares of ${shortName}`);
  };

  const handleRemoveStock = (symbol: string) => {
    updateHoldings(holdings.filter((h) => h.symbol !== symbol));
  };

  const handleStartEdit = (stock: StockHolding) => {
    setEditingSymbol(stock.symbol);
    setEditShares(stock.shares);
  };

  const handleSaveEdit = (symbol: string) => {
    if (editShares <= 0) {
      handleRemoveStock(symbol);
    } else {
      const updated = holdings.map((h) => (h.symbol === symbol ? { ...h, shares: editShares } : h));
      updateHoldings(updated);
    }
    setEditingSymbol(null);
  };

  // Filtered list for search
  const displayedHoldings = metrics.holdingsWithWeights.filter(
    (h) =>
      h.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
      h.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // 1. LOADING STATE
  if (isLoading) {
    return (
      <div className="py-12 px-4 sm:px-8 max-w-6xl mx-auto space-y-8 animate-fade-in font-sans">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 border border-broadsheet-rule dark:border-broadsheet-dark-rule p-8 bg-broadsheet-paper dark:bg-broadsheet-dark-paper animate-pulse space-y-6">
            <div className="h-4 w-28 bg-broadsheet-rule/50 dark:bg-broadsheet-dark-rule/50" />
            <div className="h-14 w-64 bg-broadsheet-rule/50 dark:bg-broadsheet-dark-rule/50" />
            <div className="h-4 w-96 bg-broadsheet-rule/50 dark:bg-broadsheet-dark-rule/50" />
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-broadsheet-rule dark:border-broadsheet-dark-rule">
              <div className="h-10 bg-broadsheet-rule/40 dark:bg-broadsheet-dark-rule/40" />
              <div className="h-10 bg-broadsheet-rule/40 dark:bg-broadsheet-dark-rule/40" />
              <div className="h-10 bg-broadsheet-rule/40 dark:bg-broadsheet-dark-rule/40" />
            </div>
          </div>
          <div className="lg:col-span-4 border border-broadsheet-rule dark:border-broadsheet-dark-rule p-8 bg-broadsheet-paper dark:bg-broadsheet-dark-paper animate-pulse space-y-6">
            <div className="h-4 w-32 bg-broadsheet-rule/50 dark:bg-broadsheet-dark-rule/50" />
            <div className="h-12 bg-broadsheet-rule/40 dark:bg-broadsheet-dark-rule/40" />
            <div className="h-12 bg-broadsheet-rule/40 dark:bg-broadsheet-dark-rule/40" />
            <div className="h-10 bg-broadsheet-rule/50 dark:bg-broadsheet-dark-rule/50" />
          </div>
        </div>
      </div>
    );
  }

  // 2. ERROR STATE
  if (hasError) {
    return (
      <div className="py-24 px-4 sm:px-8 max-w-xl mx-auto text-center font-sans space-y-4">
        <div className="w-12 h-12 rounded-full border border-market-loss dark:border-market-loss-dark mx-auto flex items-center justify-center text-market-loss dark:text-market-loss-dark">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="font-serif text-3xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
          Couldn&apos;t load prices. Try again.
        </h2>
        <p className="text-sm text-broadsheet-muted dark:text-broadsheet-dark-muted max-w-sm mx-auto">
          Market data connection timed out. Check your network or retry.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onRetry || (() => window.location.reload())}
            className="px-6 py-2.5 bg-broadsheet-terracotta hover:bg-broadsheet-terracotta-hover dark:bg-broadsheet-dark-brass dark:hover:bg-broadsheet-dark-brass-hover text-white dark:text-black text-sm font-medium transition-colors shadow-sm inline-flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. EMPTY STATE (New User: Hide P&L and Health cards)
  if (holdings.length === 0) {
    return (
      <div className="py-20 px-4 sm:px-8 max-w-2xl mx-auto text-center font-sans space-y-6">
        <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-10 sm:p-14 shadow-ledger">
          <h2 className="font-serif text-3xl sm:text-4xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal mb-3">
            No stocks yet. Add your first one.
          </h2>
          <p className="text-sm text-broadsheet-ink/75 dark:text-broadsheet-dark-text/75 max-w-md mx-auto mb-8 leading-relaxed">
            Track your real NSE holdings, calculate daily momentum, and compare Greedy vs Knapsack capital allocation.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-6 py-3 bg-broadsheet-terracotta hover:bg-broadsheet-terracotta-hover dark:bg-broadsheet-dark-brass dark:hover:bg-broadsheet-dark-brass-hover text-white dark:text-black font-medium text-sm transition-colors shadow-sm flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add stock</span>
            </button>

            <button
              type="button"
              onClick={() => updateHoldings(DEMO_STOCKS)}
              className="text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted hover:underline"
            >
              Load sample portfolio (5 stocks)
            </button>
          </div>
        </div>

        {/* Add Stock Modal */}
        <AddStockModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAddStock={handleAddStock}
          existingHoldings={holdings}
          isDemo={isDemo}
          onOpenAuth={onOpenAuth}
        />
      </div>
    );
  }

  // 4. MAIN DASHBOARD (Populated State)
  return (
    <div className="py-10 px-4 sm:px-8 max-w-6xl mx-auto space-y-8 animate-fade-in font-sans">
      
      {/* ========================================================
          ROW 1: Wide Card ("Today's P&L") + Narrow Card ("Portfolio health")
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* WIDE CARD: "Today's P&L" (lg:col-span-8) */}
        <div className="lg:col-span-8 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 sm:p-8 shadow-ledger flex flex-col justify-between">
          <div>
            {/* Header: one small label */}
            <div className="flex items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-2.5 mb-5">
              <span className="text-xs uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted font-medium">
                Today&apos;s P&amp;L
              </span>
              <span className="text-[11px] font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted">
                Sample data
              </span>
            </div>

            {/* Big number with ▲/▼ and % */}
            <div className="mb-5">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span
                  className={`font-mono text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight tabular-nums ${
                    metrics.todayGain >= 0
                      ? 'text-market-profit dark:text-market-profit-dark'
                      : 'text-market-loss dark:text-market-loss-dark'
                  }`}
                >
                  {metrics.todayGain >= 0 ? '+' : ''}
                  {formatINR(metrics.todayGain, false)}
                </span>

                <span
                  className={`font-mono text-lg sm:text-xl font-semibold tabular-nums flex items-center ${
                    metrics.todayGain >= 0
                      ? 'text-market-profit dark:text-market-profit-dark'
                      : 'text-market-loss dark:text-market-loss-dark'
                  }`}
                >
                  <span className="mr-1">{metrics.todayGain >= 0 ? '▲' : '▼'}</span>
                  <span>{formatPercent(metrics.todayGainPct, false)}</span>
                </span>
              </div>

              {/* One friendly sentence (computed from real data) */}
              <p className="mt-2.5 text-sm text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 leading-relaxed max-w-xl">
                {metrics.friendlyPnLSentence}
              </p>
            </div>
          </div>

          {/* Exactly 3 metrics: Portfolio value, Invested, Total return */}
          <div className="border-t border-broadsheet-rule dark:border-broadsheet-dark-rule pt-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <span className="text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted block mb-1">
                Portfolio value
              </span>
              <span className="font-mono text-lg font-bold text-broadsheet-ink dark:text-broadsheet-dark-text tabular-nums">
                {formatINR(metrics.totalValue, false)}
              </span>
            </div>

            <div>
              <span className="text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted block mb-1">
                Invested
              </span>
              <span className="font-mono text-lg font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text tabular-nums">
                {formatINR(metrics.totalCost, false)}
              </span>
            </div>

            <div>
              <span className="text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted block mb-1">
                Total return
              </span>
              <span
                className={`font-mono text-lg font-bold tabular-nums ${
                  metrics.totalGain >= 0
                    ? 'text-market-profit dark:text-market-profit-dark'
                    : 'text-market-loss dark:text-market-loss-dark'
                }`}
              >
                {metrics.totalGain >= 0 ? '+' : ''}
                {formatINR(metrics.totalGain, false)}{' '}
                <span className="text-sm font-semibold">
                  ({metrics.totalGain >= 0 ? '+' : ''}{metrics.totalGainPct.toFixed(2)}%)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* NARROW CARD: "Portfolio health" (lg:col-span-4) */}
        <div className="lg:col-span-4 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 sm:p-7 shadow-ledger flex flex-col justify-between">
          <div>
            {/* Header: one small label */}
            <div className="flex items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-2.5 mb-5">
              <span className="text-xs uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted font-medium">
                Portfolio health
              </span>
              <span className="text-[11px] font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted">
                Sample data
              </span>
            </div>

            {/* Volatility & Sharpe ratio with plain-English tooltips */}
            <div className="space-y-4 my-2">
              
              {/* Volatility */}
              <div className="flex items-center justify-between py-2 border-b border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/50">
                <div className="flex items-center space-x-1.5 relative">
                  <span className="text-sm text-broadsheet-ink dark:text-broadsheet-dark-text">
                    Volatility
                  </span>
                  <div
                    className="relative cursor-pointer"
                    onMouseEnter={() => setVolatilityTooltipOpen(true)}
                    onMouseLeave={() => setVolatilityTooltipOpen(false)}
                    onClick={() => setVolatilityTooltipOpen(!volatilityTooltipOpen)}
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-broadsheet-muted dark:text-broadsheet-dark-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text transition-colors" />
                    {volatilityTooltipOpen && (
                      <div className="absolute left-0 bottom-full mb-1.5 w-48 bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black p-2 text-[11px] font-sans shadow-lg z-50 pointer-events-none">
                        How bumpy your returns are over time. Lower means calmer swings.
                      </div>
                    )}
                  </div>
                </div>
                <span className="font-mono text-base font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text tabular-nums">
                  {metrics.volatility}%
                </span>
              </div>

              {/* Sharpe ratio */}
              <div className="flex items-center justify-between py-2 border-b border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/50">
                <div className="flex items-center space-x-1.5 relative">
                  <span className="text-sm text-broadsheet-ink dark:text-broadsheet-dark-text">
                    Sharpe ratio
                  </span>
                  <div
                    className="relative cursor-pointer"
                    onMouseEnter={() => setSharpeTooltipOpen(true)}
                    onMouseLeave={() => setSharpeTooltipOpen(false)}
                    onClick={() => setSharpeTooltipOpen(!sharpeTooltipOpen)}
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-broadsheet-muted dark:text-broadsheet-dark-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text transition-colors" />
                    {sharpeTooltipOpen && (
                      <div className="absolute left-0 bottom-full mb-1.5 w-48 bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black p-2 text-[11px] font-sans shadow-lg z-50 pointer-events-none">
                        Return earned per unit of total risk. Higher is better.
                      </div>
                    )}
                  </div>
                </div>
                <span className="font-mono text-base font-bold text-market-profit dark:text-market-profit-dark tabular-nums">
                  {metrics.sharpeRatio}
                </span>
              </div>

            </div>
          </div>

          {/* Primary Action Button: "Compare Greedy vs Knapsack" */}
          <div className="pt-6">
            <button
              type="button"
              onClick={onNavigateToOptimizer}
              className="w-full py-3 bg-broadsheet-terracotta hover:bg-broadsheet-terracotta-hover dark:bg-broadsheet-dark-brass dark:hover:bg-broadsheet-dark-brass-hover text-white dark:text-black font-sans font-medium text-sm transition-colors text-center shadow-sm"
            >
              Compare Greedy vs Knapsack
            </button>
          </div>

        </div>

      </div>

      {/* ========================================================
          ROW 2: Wide Card ("Your holdings") + Narrow Card ("Allocation")
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* WIDE CARD: "Your holdings" (lg:col-span-8) */}
        <div className="lg:col-span-8 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 shadow-ledger">
          
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-4 mb-4">
            <div>
              <h3 className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
                Your holdings
              </h3>
              <span className="text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted font-mono">
                {holdings.length} stocks
              </span>
            </div>

            <div className="flex items-center space-x-3">
              {/* Search box: "Search your stocks" */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-broadsheet-muted" />
                <input
                  type="text"
                  placeholder="Search your stocks"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-2.5 py-1.5 bg-broadsheet-cream/50 dark:bg-broadsheet-dark-bg border border-broadsheet-rule dark:border-broadsheet-dark-rule text-xs text-broadsheet-ink dark:text-broadsheet-dark-text focus:outline-none focus:border-broadsheet-ink dark:focus:border-broadsheet-dark-text w-36 sm:w-44"
                />
              </div>

              {/* Add Stock Button */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-1.5 bg-broadsheet-terracotta hover:bg-broadsheet-terracotta-hover dark:bg-broadsheet-dark-brass dark:hover:bg-broadsheet-dark-brass-hover text-white dark:text-black font-sans font-medium text-xs transition-colors flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add stock</span>
              </button>
            </div>
          </div>

          {/* Table with exactly 5 columns: Asset, Shares, Price, Today, Total */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule text-[11px] uppercase text-broadsheet-muted dark:text-broadsheet-dark-muted font-medium bg-broadsheet-cream/30 dark:bg-broadsheet-dark-bg/40">
                  <th className="py-2.5 px-3">Asset</th>
                  <th className="py-2.5 px-3 text-right">Shares</th>
                  <th className="py-2.5 px-3 text-right">Price</th>
                  <th className="py-2.5 px-3 text-right">Today</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/40">
                {displayedHoldings.map((stock) => {
                  const totalVal = stock.shares * stock.currentPrice;
                  const totalCost = stock.shares * stock.avgBuyPrice;
                  const totalPnl = totalVal - totalCost;
                  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
                  const dayPnl = stock.shares * stock.dayChange;

                  const isExpanded = expandedSymbol === stock.symbol;
                  const isEditing = editingSymbol === stock.symbol;

                  return (
                    <React.Fragment key={stock.symbol}>
                      <tr
                        onClick={() => setExpandedSymbol(isExpanded ? null : stock.symbol)}
                        className={`group transition-all duration-300 cursor-pointer ${
                          highlightedSymbol === stock.symbol
                            ? 'bg-market-profit/20 dark:bg-market-profit-dark/25 ring-1 ring-market-profit dark:ring-market-profit-dark font-medium'
                            : 'hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg/60'
                        }`}
                      >
                        {/* 1. Asset: Symbol + FULL company name (no truncation) */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-broadsheet-muted">
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </span>
                            <div>
                              <span className="font-bold text-broadsheet-ink dark:text-broadsheet-dark-text block">
                                {stock.symbol}
                              </span>
                              <span className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted block">
                                {stock.name}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Shares (with edit/delete on hover) */}
                        <td
                          className="py-3 px-3 text-right font-mono tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isEditing ? (
                            <div className="flex items-center justify-end space-x-1">
                              <input
                                type="number"
                                min="1"
                                value={editShares}
                                onChange={(e) => setEditShares(parseInt(e.target.value) || 0)}
                                className="w-16 px-1.5 py-0.5 border border-broadsheet-ink dark:border-broadsheet-dark-text bg-white dark:bg-broadsheet-dark-bg text-right font-mono text-xs"
                              />
                              <button
                                onClick={() => handleSaveEdit(stock.symbol)}
                                className="text-[10px] bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black px-1.5 py-0.5"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end space-x-2">
                              <span>{stock.shares}</span>
                              {/* Edit/Delete appear on row hover */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(stock)}
                                  className="p-0.5 text-broadsheet-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text"
                                  title="Edit shares"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStock(stock.symbol)}
                                  className="p-0.5 text-broadsheet-muted hover:text-market-loss dark:hover:text-market-loss-dark"
                                  title="Remove stock"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 3. Price */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">
                          {formatINR(stock.currentPrice)}
                        </td>

                        {/* 4. Today (amount only) */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          <span
                            className={`inline-flex items-center space-x-1 ${
                              dayPnl >= 0
                                ? 'text-market-profit dark:text-market-profit-dark font-medium'
                                : 'text-market-loss dark:text-market-loss-dark font-medium'
                            }`}
                          >
                            <span>{dayPnl >= 0 ? '▲' : '▼'}</span>
                            <span>{formatINR(Math.abs(dayPnl), false)}</span>
                          </span>
                        </td>

                        {/* 5. Total (amount + %) */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          <span
                            className={`inline-flex items-center space-x-1 ${
                              totalPnl >= 0
                                ? 'text-market-profit dark:text-market-profit-dark font-medium'
                                : 'text-market-loss dark:text-market-loss-dark font-medium'
                            }`}
                          >
                            <span>{totalPnl >= 0 ? '▲' : '▼'}</span>
                            <span>{formatINR(Math.abs(totalPnl), false)}</span>
                            <span className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted font-normal ml-1">
                              ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
                            </span>
                          </span>
                        </td>
                      </tr>

                      {/* Expandable row detail: Avg buy price, invested, current value, weight */}
                      {isExpanded && (
                        <tr className="bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg/40 text-[11px] font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted">
                          <td colSpan={5} className="py-2.5 px-8 border-b border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/40">
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                              <span>
                                Avg buy price: <strong className="text-broadsheet-ink dark:text-broadsheet-dark-text">{formatINR(stock.avgBuyPrice)}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Invested: <strong className="text-broadsheet-ink dark:text-broadsheet-dark-text">{formatINR(totalCost, false)}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Value: <strong className="text-broadsheet-ink dark:text-broadsheet-dark-text">{formatINR(totalVal, false)}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Weight: <strong className="text-broadsheet-ink dark:text-broadsheet-dark-text">{stock.currentWeight.toFixed(1)}%</strong>
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

        {/* NARROW CARD: "Allocation" (lg:col-span-4) */}
        <div className="lg:col-span-4">
          <AllocationChart
            holdings={metrics.holdingsWithWeights}
            totalValue={metrics.totalValue}
            onNavigateToOptimizer={onNavigateToOptimizer}
          />
        </div>

      </div>

      {/* Add Stock Modal */}
      <AddStockModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddStock={handleAddStock}
        existingHoldings={holdings}
        isDemo={isDemo}
        onOpenAuth={onOpenAuth}
      />

    </div>
  );
};
