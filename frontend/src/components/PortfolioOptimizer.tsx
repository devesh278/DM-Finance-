import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  History,
  AlertCircle,
  RefreshCw,
  Save,
  Search,
  ArrowUpDown,
  Filter,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  StockUniverseItem,
  NSE_STOCKS_CATALOG,
  ComparisonData,
  HistoryItem,
} from '../types/optimizer';
import { formatINR, formatPercent } from '../utils/formatters';
import { runClientComparison } from '../utils/optimizerEngine';
import { apiFetch } from '../utils/apiClient';

interface PortfolioOptimizerProps {
  onBackToDashboard?: () => void;
  user?: { email: string; name: string; isDemo?: boolean } | null;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

export const PortfolioOptimizer: React.FC<PortfolioOptimizerProps> = ({
  user,
  onOpenAuth,
}) => {
  // Live catalog loaded from database (with fallback to the full 200 catalog)
  const [catalog, setCatalog] = useState<StockUniverseItem[]>(NSE_STOCKS_CATALOG);

  // Sync with /api/optimizer/universe from our database
  useEffect(() => {
    apiFetch('/api/optimizer/universe')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.stocks?.length) {
          setCatalog(data.stocks);
        }
      })
      .catch(() => {
        // Fallback to local 200 catalog
      });
  }, []);

  // DEFAULT: Load saved selection from localStorage or default to all Nifty 50 stocks
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dalal_optimizer_selected');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const nifty50 = NSE_STOCKS_CATALOG.filter((s) => s.index_group === 'nifty50').map((s) => s.symbol);
    return nifty50.length > 0 ? nifty50 : NSE_STOCKS_CATALOG.slice(0, 50).map((s) => s.symbol);
  });

  // Sync selectedSymbols to localStorage so selections are preserved across navigation and logout
  useEffect(() => {
    try {
      localStorage.setItem('dalal_optimizer_selected', JSON.stringify(selectedSymbols));
    } catch {}
  }, [selectedSymbols]);

  // Table Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [indexGroupFilter, setIndexGroupFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price_asc' | 'price_desc' | 'return_desc' | 'return_asc'>('name');

  // Friendly warning banner if trying to select > 100 stocks
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  // Risk slider: 0.15 ("Take the chance"), 0.50 ("Balanced"), 0.85 ("Play it safe")
  const [riskAversion, setRiskAversion] = useState<number>(0.50);

  // Helper to remove .NS suffix for display
  const cleanSymbol = (sym: string) => sym.replace(/\.NS$/, '');

  // Distinct sectors from catalog
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((s) => {
      if (s.sector) set.add(s.sector);
    });
    return Array.from(set).sort();
  }, [catalog]);

  // Selected stocks objects
  const chosenStocks = useMemo(() => {
    return catalog.filter((s) => selectedSymbols.includes(s.symbol));
  }, [catalog, selectedSymbols]);

  // Live total cost of selected stocks
  const selectedTotalCost = useMemo(() => {
    return chosenStocks.reduce((sum, s) => sum + Math.ceil(s.cost), 0);
  }, [chosenStocks]);

  // Dynamic budget presets: 20%, 40%, 60%, 80% (Default is 40%)
  const budgetPresets = useMemo(() => {
    const roundToClean = (val: number) => {
      if (val >= 100000) return Math.max(1000, Math.round(val / 5000) * 5000);
      if (val >= 10000) return Math.max(1000, Math.round(val / 1000) * 1000);
      return Math.max(500, Math.round(val / 500) * 500);
    };

    if (selectedTotalCost <= 0) {
      return [
        { label: '20%', value: 10000 },
        { label: '40%', value: 25000 },
        { label: '60%', value: 50000 },
        { label: '80%', value: 75000 },
      ];
    }

    return [
      { label: '20%', value: roundToClean(selectedTotalCost * 0.20) },
      { label: '40%', value: roundToClean(selectedTotalCost * 0.40) },
      { label: '60%', value: roundToClean(selectedTotalCost * 0.60) },
      { label: '80%', value: roundToClean(selectedTotalCost * 0.80) },
    ];
  }, [selectedTotalCost]);

  // Budget state: Defaults to the 40% preset
  const [budget, setBudget] = useState<number>(() => {
    const initialCost = NSE_STOCKS_CATALOG.filter((s) => s.index_group === 'nifty50').reduce((sum, s) => sum + Math.ceil(s.cost), 0);
    return Math.max(1000, Math.round((initialCost * 0.40) / 1000) * 1000);
  });

  // Keep budget updated when quick selects change
  useEffect(() => {
    if (selectedTotalCost > 0) {
      const p40 = budgetPresets[1]?.value || Math.round(selectedTotalCost * 0.40);
      setBudget(p40);
    }
  }, [selectedTotalCost, budgetPresets]);

  // State
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [hasRun, setHasRun] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [savedRunNotice, setSavedRunNotice] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState<boolean>(false);

  // Saved runs history (stored in localStorage and synced with API)
  const [savedRuns, setSavedRuns] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('dalal_optimizer_saved_runs');
    return saved ? JSON.parse(saved) : [];
  });

  const resultsRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Filtered & Sorted Table Rows
  const filteredStocks = useMemo(() => {
    let result = [...catalog];

    // 1. Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          cleanSymbol(s.symbol).toLowerCase().includes(q)
      );
    }

    // 2. Sector filter
    if (sectorFilter !== 'all') {
      result = result.filter((s) => s.sector === sectorFilter);
    }

    // 3. Index group filter
    if (indexGroupFilter !== 'all') {
      result = result.filter((s) => s.index_group === indexGroupFilter);
    }

    // 4. Sort
    result.sort((a, b) => {
      if (sortBy === 'price_asc') return a.cost - b.cost;
      if (sortBy === 'price_desc') return b.cost - a.cost;
      if (sortBy === 'return_desc') return (b.one_year_return_pct ?? b.expected_return_pct) - (a.one_year_return_pct ?? a.expected_return_pct);
      if (sortBy === 'return_asc') return (a.one_year_return_pct ?? a.expected_return_pct) - (b.one_year_return_pct ?? b.expected_return_pct);
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [catalog, searchQuery, sectorFilter, indexGroupFilter, sortBy]);

  // Validation rules
  const cheapestLotPrice = useMemo(() => {
    if (chosenStocks.length === 0) return 0;
    return Math.min(...chosenStocks.map((s) => Math.ceil(s.cost)));
  }, [chosenStocks]);

  const isSelectionTooSmall = selectedSymbols.length < 2;
  const isBudgetTooLow = budget < cheapestLotPrice;
  const canRun = !isSelectionTooSmall && !isBudgetTooLow && !isLoading;

  // Toggle single stock with 100-cap protection
  const handleToggleStock = (sym: string) => {
    setLimitWarning(null);
    if (selectedSymbols.includes(sym)) {
      setSelectedSymbols(selectedSymbols.filter((s) => s !== sym));
    } else {
      if (selectedSymbols.length >= 100) {
        setLimitWarning('Maximum 100 stocks can be selected for optimization. Deselect a stock to pick another.');
        return;
      }
      setSelectedSymbols([...selectedSymbols, sym]);
    }
  };

  // Quick Select buttons
  const handleQuickSelect = (action: 'nifty50' | 'next50' | 'midcap100' | 'under1000' | 'under5000' | 'random20' | 'clear') => {
    setLimitWarning(null);

    if (action === 'clear') {
      setSelectedSymbols([]);
      return;
    }

    if (action === 'nifty50') {
      const n50 = catalog.filter((s) => s.index_group === 'nifty50').map((s) => s.symbol);
      setSelectedSymbols(n50);
      return;
    }

    if (action === 'next50') {
      const next50 = catalog.filter((s) => s.index_group === 'next50').map((s) => s.symbol);
      setSelectedSymbols(next50);
      return;
    }

    if (action === 'midcap100') {
      const mid100 = catalog.filter((s) => s.index_group === 'midcap100').map((s) => s.symbol).slice(0, 100);
      setSelectedSymbols(mid100);
      return;
    }

    if (action === 'under1000') {
      const under = catalog.filter((s) => s.cost < 1000).map((s) => s.symbol).slice(0, 100);
      setSelectedSymbols(under);
      return;
    }

    if (action === 'under5000') {
      const under5k = catalog.filter((s) => s.cost < 5000).map((s) => s.symbol).slice(0, 100);
      setSelectedSymbols(under5k);
      return;
    }

    if (action === 'random20') {
      const shuffled = [...catalog].sort(() => 0.5 - Math.random());
      setSelectedSymbols(shuffled.slice(0, 20).map((s) => s.symbol));
      return;
    }
  };

  // Toggle all currently filtered stocks (capped at 100)
  const handleToggleAllFiltered = () => {
    setLimitWarning(null);
    const filteredSyms = filteredStocks.map((s) => s.symbol);
    const allSelected = filteredSyms.every((sym) => selectedSymbols.includes(sym));

    if (allSelected) {
      setSelectedSymbols(selectedSymbols.filter((sym) => !filteredSyms.includes(sym)));
    } else {
      const merged = Array.from(new Set([...selectedSymbols, ...filteredSyms]));
      if (merged.length > 100) {
        setSelectedSymbols(merged.slice(0, 100));
        setLimitWarning('Selection capped at the 100 stocks limit.');
      } else {
        setSelectedSymbols(merged);
      }
    }
  };

  // Execute Comparison (Server-first via FastAPI NumPy DP engine, with seamless local fallback)
  const executeComparison = async (symbolsToRun: string[], budgetToRun: number, riskToRun: number) => {
    setIsLoading(true);
    setHasError(false);

    // 1. Try server-side execution via FastAPI NumPy engine
    try {
      const res = await apiFetch('/api/optimizer/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: symbolsToRun,
          budget: budgetToRun,
          risk_aversion: riskToRun,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setComparison(data);
        setHasRun(true);
        setIsLoading(false);
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        return;
      }
    } catch (err) {
      console.warn('Server comparison request failed, activating client algorithm engine:', err);
    }

    // 2. Seamless Fallback: run exact same Greedy & 0/1 Knapsack DP engine locally
    try {
      const activeChosen = catalog.filter((s) => symbolsToRun.includes(s.symbol));
      const clientData = runClientComparison(activeChosen, budgetToRun, riskToRun);
      setComparison(clientData);
      setHasRun(true);
      setIsLoading(false);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (fallbackErr) {
      console.error('Comparison calculation failed:', fallbackErr);
      setHasError(true);
      setIsLoading(false);
    }
  };

  // Fetch saved runs history from API when logged in
  const fetchSavedRunsHistory = async () => {
    if (!user) return;
    try {
      const res = await apiFetch('/api/optimizer/history');
      if (res.ok) {
        const data = await res.json();
        if (data.history) {
          setSavedRuns(data.history);
          localStorage.setItem('dalal_optimizer_saved_runs', JSON.stringify(data.history));
        }
      }
    } catch {
      // Ignore
    }
  };

  // Save current run to database
  const handleSaveRun = async () => {
    if (!comparison) return;

    if (!user) {
      setSavedRunNotice('Sign in to save this run');
      onOpenAuth?.('signin');
      setTimeout(() => setSavedRunNotice(null), 4000);
      return;
    }

    if (user.isDemo) {
      setSavedRunNotice('Demo account is read-only. Create an account to save runs.');
      setTimeout(() => setSavedRunNotice(null), 4000);
      return;
    }

    try {
      const res = await apiFetch('/api/optimizer/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparison_data: comparison,
          selected_symbols: selectedSymbols,
        }),
      });

      if (res.ok) {
        setSavedRunNotice('Run saved to history');
        fetchSavedRunsHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        setSavedRunNotice(err.detail || 'Failed to save run');
      }
    } catch {
      setSavedRunNotice('Failed to connect to server');
    }
    setTimeout(() => setSavedRunNotice(null), 3000);
  };

  const handleToggleSavedRuns = () => {
    if (!user) {
      onOpenAuth?.('signin');
      return;
    }
    setHistoryOpen(!historyOpen);
    if (!historyOpen) {
      fetchSavedRunsHistory();
    }
  };

  // Reload past run
  const handleReloadRun = (item: HistoryItem) => {
    setBudget(item.budget);
    setRiskAversion(item.risk_aversion);
    if (item.selected_symbols && item.selected_symbols.length > 0) {
      setSelectedSymbols(item.selected_symbols);
      executeComparison(item.selected_symbols, item.budget, item.risk_aversion);
    } else {
      executeComparison(selectedSymbols, item.budget, item.risk_aversion);
    }
    setHistoryOpen(false);
  };

  // Helper format for index group tag
  const formatIndexGroup = (grp?: string) => {
    if (grp === 'nifty50') return 'Nifty 50';
    if (grp === 'next50') return 'Next 50';
    if (grp === 'midcap100') return 'Midcap 100';
    return 'NSE';
  };

  return (
    <div className="py-10 px-4 sm:px-8 max-w-6xl mx-auto space-y-10 animate-fade-in font-sans">
      
      {/* 1. TITLE BLOCK */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-5 gap-4">
        <div>
          <h1 className="font-serif text-4xl sm:text-5xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal tracking-tight">
            Greedy vs Knapsack
          </h1>
          <p className="mt-2 text-base text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 leading-relaxed max-w-2xl">
            Select from 200 NSE stocks and enter your budget. We run both optimization algorithms on our server and compare results side by side.
          </p>
        </div>

        {/* Saved runs link on the right */}
        <div className="flex items-center space-x-3 text-sm font-sans flex-shrink-0">
          <button
            type="button"
            onClick={handleToggleSavedRuns}
            className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline flex items-center space-x-1.5 font-medium"
          >
            <History className="w-4 h-4" />
            <span>{user ? `Saved runs ${savedRuns.length > 0 ? `(${savedRuns.length})` : ''}` : 'Sign in to view saved runs'}</span>
          </button>
        </div>
      </div>

      {/* Saved Runs Drawer */}
      {historyOpen && (
        <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-5 shadow-ledger text-xs font-sans animate-fade-in">
          <div className="flex items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-2.5 mb-3">
            <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text uppercase font-mono text-[11px]">
              Saved Comparison Runs
            </span>
            <button
              onClick={() => setHistoryOpen(false)}
              className="text-broadsheet-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text"
            >
              ✕ Close
            </button>
          </div>

          {savedRuns.length === 0 ? (
            <p className="text-broadsheet-muted py-3">No saved comparison runs yet. Run an optimization and click &apos;Save this run&apos;.</p>
          ) : (
            <div className="divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/40 max-h-64 overflow-y-auto">
              {savedRuns.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between hover:bg-broadsheet-cream/50 dark:hover:bg-broadsheet-dark-bg/50 px-2 transition-colors">
                  <div>
                    <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">
                      Budget: {formatINR(item.budget, false)}
                    </span>
                    <span className="text-broadsheet-muted ml-2 text-[11px]">
                      ({item.risk_label} • {item.created_at})
                    </span>
                    <p className="text-xs text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 mt-0.5 line-clamp-1">
                      {item.verdict}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReloadRun(item)}
                    className="px-2.5 py-1 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:border-broadsheet-ink text-xs font-sans flex items-center space-x-1 flex-shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reload</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Friendly Warning Banner if Selection Exceeds 100 */}
      {limitWarning && (
        <div className="p-3 border border-broadsheet-terracotta dark:border-broadsheet-dark-brass bg-broadsheet-cream/80 dark:bg-broadsheet-dark-paper text-xs text-broadsheet-ink dark:text-broadsheet-dark-text flex items-center space-x-2 animate-fade-in shadow-sm">
          <Info className="w-4 h-4 text-broadsheet-terracotta dark:text-broadsheet-dark-brass flex-shrink-0" />
          <span className="font-medium">{limitWarning}</span>
        </div>
      )}

      {/* 2. TWO MAIN SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: "1. Choose stocks (Searchable Table for 200 NSE Stocks)" */}
        <div className="lg:col-span-8 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-5 sm:p-6 shadow-ledger flex flex-col justify-between">
          <div>
            
            {/* Header & Count */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-3.5 mb-4 gap-2">
              <div>
                <h2 className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
                  1. Choose stocks
                </h2>
                <p className="text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted mt-0.5">
                  Pick up to 100 stocks from the 200 NSE universe.
                </p>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-sans">
                <button
                  type="button"
                  onClick={() => handleQuickSelect('nifty50')}
                  className={`px-2.5 py-1 border text-xs transition-colors ${
                    selectedSymbols.length === 50 && catalog.filter((s) => s.index_group === 'nifty50').every((s) => selectedSymbols.includes(s.symbol))
                      ? 'border-broadsheet-ink dark:border-broadsheet-dark-text bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black font-semibold'
                      : 'border-broadsheet-rule dark:border-broadsheet-dark-rule hover:bg-broadsheet-cream/60 text-broadsheet-ink dark:text-broadsheet-dark-text'
                  }`}
                  title="Select all 50 Nifty 50 constituents"
                >
                  Nifty 50
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect('next50')}
                  className="px-2.5 py-1 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg text-broadsheet-ink dark:text-broadsheet-dark-text transition-colors"
                >
                  Next 50
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect('midcap100')}
                  className="px-2.5 py-1 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg text-broadsheet-ink dark:text-broadsheet-dark-text transition-colors"
                >
                  Midcap 100
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect('under1000')}
                  className="px-2.5 py-1 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg text-broadsheet-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text transition-colors"
                >
                  Under ₹1,000
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect('under5000')}
                  className="px-2.5 py-1 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg text-broadsheet-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text transition-colors"
                >
                  Under ₹5,000
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect('random20')}
                  className="px-2.5 py-1 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg text-broadsheet-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text transition-colors flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3 text-broadsheet-terracotta dark:text-broadsheet-dark-brass" />
                  <span>Random 20</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect('clear')}
                  className="px-2.5 py-1 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg text-market-loss dark:text-market-loss-dark hover:underline transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3 text-xs font-sans">
              
              {/* Search input */}
              <div className="sm:col-span-5 relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-broadsheet-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or symbol..."
                  className="w-full pl-8 pr-3 py-2 bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg border border-broadsheet-rule dark:border-broadsheet-dark-rule text-xs focus:outline-none focus:border-broadsheet-terracotta dark:focus:border-broadsheet-dark-brass"
                />
              </div>

              {/* Sector Dropdown */}
              <div className="sm:col-span-3">
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="w-full px-2.5 py-2 bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg border border-broadsheet-rule dark:border-broadsheet-dark-rule text-xs focus:outline-none focus:border-broadsheet-terracotta dark:focus:border-broadsheet-dark-brass truncate"
                >
                  <option value="all">All Sectors ({availableSectors.length})</option>
                  {availableSectors.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Index Group Dropdown */}
              <div className="sm:col-span-2">
                <select
                  value={indexGroupFilter}
                  onChange={(e) => setIndexGroupFilter(e.target.value)}
                  className="w-full px-2 py-2 bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg border border-broadsheet-rule dark:border-broadsheet-dark-rule text-xs focus:outline-none focus:border-broadsheet-terracotta dark:focus:border-broadsheet-dark-brass"
                >
                  <option value="all">All Indices</option>
                  <option value="nifty50">Nifty 50</option>
                  <option value="next50">Next 50</option>
                  <option value="midcap100">Midcap 100</option>
                </select>
              </div>

              {/* Sort By Dropdown */}
              <div className="sm:col-span-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-2 py-2 bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg border border-broadsheet-rule dark:border-broadsheet-dark-rule text-xs focus:outline-none focus:border-broadsheet-terracotta dark:focus:border-broadsheet-dark-brass"
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="price_desc">Price: High → Low</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="return_desc">Return: High → Low</option>
                  <option value="return_asc">Return: Low → High</option>
                </select>
              </div>

            </div>

            {/* SEARCHABLE TABLE CONTAINER (Capped height with sticky header) */}
            <div ref={tableRef} className="border border-broadsheet-rule dark:border-broadsheet-dark-rule overflow-hidden">
              <div className="max-h-[380px] overflow-y-auto divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/40 font-mono text-xs">
                
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-broadsheet-cream dark:bg-broadsheet-dark-paper border-b border-broadsheet-rule dark:border-broadsheet-dark-rule text-[11px] uppercase text-broadsheet-muted font-mono select-none">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredStocks.length > 0 && filteredStocks.every((s) => selectedSymbols.includes(s.symbol))}
                          onChange={handleToggleAllFiltered}
                          aria-label="Select all visible stocks"
                          className="w-3.5 h-3.5 accent-broadsheet-ink dark:accent-broadsheet-dark-text cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Company & Symbol</th>
                      <th className="py-2.5 px-2 hidden sm:table-cell">Sector</th>
                      <th className="py-2.5 px-2 hidden md:table-cell">Index</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-right">1-Yr Return</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/30">
                    {filteredStocks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-broadsheet-muted font-sans text-xs">
                          No stocks found matching your filters. Try clearing search.
                        </td>
                      </tr>
                    ) : (
                      filteredStocks.map((stock) => {
                        const isSelected = selectedSymbols.includes(stock.symbol);
                        const ret = stock.one_year_return_pct ?? stock.expected_return_pct;

                        return (
                          <tr
                            key={stock.symbol}
                            onClick={() => handleToggleStock(stock.symbol)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-broadsheet-cream/70 dark:bg-broadsheet-dark-bg/60 font-medium'
                                : 'hover:bg-broadsheet-cream/30 dark:hover:bg-broadsheet-dark-bg/20'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStock(stock.symbol)}
                                className="w-3.5 h-3.5 accent-broadsheet-ink dark:accent-broadsheet-dark-text cursor-pointer"
                              />
                            </td>

                            {/* Company Name & Symbol */}
                            <td className="py-2 px-3">
                              <div className="flex items-baseline space-x-1.5 truncate max-w-[220px] sm:max-w-xs">
                                <span className="text-xs text-broadsheet-ink dark:text-broadsheet-dark-text font-sans font-medium truncate">
                                  {stock.name}
                                </span>
                                <span className="text-[10px] font-bold text-broadsheet-muted dark:text-broadsheet-dark-muted font-mono flex-shrink-0">
                                  {cleanSymbol(stock.symbol)}
                                </span>
                              </div>
                            </td>

                            {/* Sector */}
                            <td className="py-2 px-2 hidden sm:table-cell text-xs text-broadsheet-muted font-sans truncate max-w-[140px]">
                              {stock.sector}
                            </td>

                            {/* Index Group Badge */}
                            <td className="py-2 px-2 hidden md:table-cell">
                              <span className="inline-block px-1.5 py-0.5 text-[9px] uppercase font-sans border border-broadsheet-rule dark:border-broadsheet-dark-rule text-broadsheet-muted">
                                {formatIndexGroup(stock.index_group)}
                              </span>
                            </td>

                            {/* Price */}
                            <td className="py-2 px-3 text-right tabular-nums text-xs text-broadsheet-ink dark:text-broadsheet-dark-text">
                              {formatINR(stock.cost, false)}
                            </td>

                            {/* 1-Yr Return */}
                            <td className={`py-2 px-3 text-right tabular-nums text-xs font-semibold ${
                              ret >= 0 ? 'text-market-profit dark:text-market-profit-dark' : 'text-market-loss dark:text-market-loss-dark'
                            }`}>
                              {ret >= 0 ? `▲ +${ret.toFixed(1)}%` : `▼ ${ret.toFixed(1)}%`}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

              </div>
            </div>

            {/* LIVE STICKY BAR: "37 selected, total cost ₹4,18,300" */}
            <div className="mt-3 pt-3 border-t border-broadsheet-rule dark:border-broadsheet-dark-rule flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs font-sans gap-2 bg-broadsheet-paper dark:bg-broadsheet-dark-paper">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text font-mono text-sm">
                  {selectedSymbols.length} selected
                </span>
                <span className="text-broadsheet-muted">•</span>
                <span className="font-mono text-sm text-broadsheet-ink dark:text-broadsheet-dark-text tabular-nums">
                  total cost {formatINR(selectedTotalCost, false)}
                </span>
              </div>

              <div className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted font-sans">
                {selectedSymbols.length}/100 max cap
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: "2. Budget and risk" */}
        <div className="lg:col-span-4 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-5 sm:p-6 shadow-ledger flex flex-col justify-between h-full">
          <div>
            <div className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-3.5 mb-5 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
                2. Budget and risk
              </h2>
              <span className="font-mono text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted">
                NSE live data
              </span>
            </div>

            {/* Budget input with ₹ and Indian commas */}
            <div className="mb-6">
              <label htmlFor="budget-input" className="block text-xs uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted font-medium mb-1.5 font-mono">
                Investment Budget
              </label>

              <div className="relative">
                <span className="absolute left-3 top-2.5 font-mono text-base text-broadsheet-muted">
                  ₹
                </span>
                <input
                  id="budget-input"
                  type="text"
                  value={budget ? budget.toLocaleString('en-IN') : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setBudget(raw ? parseInt(raw, 10) : 0);
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg border border-broadsheet-rule dark:border-broadsheet-dark-rule font-mono text-lg font-bold text-broadsheet-ink dark:text-broadsheet-dark-text focus:outline-none focus:border-broadsheet-terracotta dark:focus:border-broadsheet-dark-brass tabular-nums"
                />
              </div>

              {/* Dynamic Budget Presets (20%, 40% default, 60%, 80%) */}
              <div className="mt-3">
                <div className="grid grid-cols-4 gap-1.5">
                  {budgetPresets.map((preset) => {
                    const isActive = Math.abs(budget - preset.value) < 100;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setBudget(preset.value)}
                        className={`py-1.5 px-1 border text-center font-mono text-xs transition-colors ${
                          isActive
                            ? 'border-broadsheet-ink dark:border-broadsheet-dark-text bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black font-semibold'
                            : 'border-broadsheet-rule dark:border-broadsheet-dark-rule hover:border-broadsheet-muted text-broadsheet-ink dark:text-broadsheet-dark-text'
                        }`}
                      >
                        <div className="font-sans text-[11px] font-medium">{preset.label}</div>
                        <div className="text-[10px] tabular-nums truncate">
                          {formatINR(preset.value, false)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Explanatory note required by prompt */}
                <p className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted mt-2 italic font-sans">
                  Tighter budgets show the biggest differences between Greedy and Knapsack.
                </p>
              </div>
            </div>

            {/* Risk-Aversion Slider */}
            <div className="mb-6 border-t border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/60 pt-5">
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-xs uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted font-medium font-mono">
                  Risk posture
                </label>
                <span className="font-mono text-xs font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">
                  {riskAversion >= 0.7 ? 'Play it safe' : riskAversion <= 0.3 ? 'Take the chance' : 'Balanced'}
                </span>
              </div>

              <input
                type="range"
                min="0.15"
                max="0.85"
                step="0.35"
                value={riskAversion}
                onChange={(e) => setRiskAversion(parseFloat(e.target.value))}
                aria-label="Risk-aversion slider"
                className="w-full accent-broadsheet-ink dark:accent-broadsheet-dark-text cursor-pointer my-2"
              />

              <div className="flex justify-between text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted pt-1">
                <button
                  type="button"
                  onClick={() => setRiskAversion(0.85)}
                  className={`hover:underline ${riskAversion >= 0.7 ? 'font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text' : ''}`}
                >
                  Play it safe
                </button>
                <button
                  type="button"
                  onClick={() => setRiskAversion(0.50)}
                  className={`hover:underline ${riskAversion > 0.3 && riskAversion < 0.7 ? 'font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text' : ''}`}
                >
                  Balanced
                </button>
                <button
                  type="button"
                  onClick={() => setRiskAversion(0.15)}
                  className={`hover:underline ${riskAversion <= 0.3 ? 'font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text' : ''}`}
                >
                  Take the chance
                </button>
              </div>
            </div>
          </div>

          {/* Validation & Primary Action */}
          <div className="pt-4 border-t border-broadsheet-rule dark:border-broadsheet-dark-rule space-y-3">
            {isSelectionTooSmall && (
              <p className="text-xs text-market-loss dark:text-market-loss-dark flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Pick at least 2 stocks to optimize</span>
              </p>
            )}

            {!isSelectionTooSmall && isBudgetTooLow && (
              <p className="text-xs text-market-loss dark:text-market-loss-dark flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Budget is lower than cheapest stock ({formatINR(cheapestLotPrice)})</span>
              </p>
            )}

            <button
              type="button"
              onClick={() => executeComparison(selectedSymbols, budget, riskAversion)}
              disabled={!canRun}
              className={`w-full py-3.5 text-sm font-sans font-medium transition-colors shadow-sm flex items-center justify-center space-x-2 ${
                canRun
                  ? 'bg-broadsheet-terracotta hover:bg-broadsheet-terracotta-hover dark:bg-broadsheet-dark-brass dark:hover:bg-broadsheet-dark-brass-hover text-white dark:text-black cursor-pointer'
                  : 'bg-broadsheet-rule/50 dark:bg-broadsheet-dark-rule/50 text-broadsheet-muted cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Optimizing on server...</span>
                </>
              ) : (
                <span>Run comparison ({selectedSymbols.length} stocks) →</span>
              )}
            </button>
          </div>

        </div>

      </div>

      {/* ERROR STATE */}
      {hasError && (
        <div className="border border-market-loss dark:border-market-loss-dark p-6 bg-broadsheet-paper dark:bg-broadsheet-dark-paper text-center space-y-3">
          <p className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text">
            Couldn&apos;t complete server comparison. Try again.
          </p>
          <button
            type="button"
            onClick={() => executeComparison(selectedSymbols, budget, riskAversion)}
            className="px-5 py-2 bg-broadsheet-terracotta text-white dark:bg-broadsheet-dark-brass dark:text-black text-xs font-medium inline-flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 3. RESULTS SECTION (Renders once executed) */}
      <div ref={resultsRef}>
        {isLoading && (
          <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule p-8 bg-broadsheet-paper dark:bg-broadsheet-dark-paper space-y-4 animate-pulse">
            <div className="flex items-center space-x-3 text-sm font-sans font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">
              <RefreshCw className="w-4 h-4 animate-spin text-broadsheet-terracotta dark:text-broadsheet-dark-brass" />
              <span>Running Greedy Heuristic and 0/1 Knapsack Dynamic Programming on server...</span>
            </div>
            <div className="h-8 w-2/3 bg-broadsheet-rule/40 dark:bg-broadsheet-dark-rule/40" />
            <div className="h-4 w-1/3 bg-broadsheet-rule/30 dark:bg-broadsheet-dark-rule/30" />
            <div className="h-40 bg-broadsheet-rule/20 dark:bg-broadsheet-dark-rule/20" />
          </div>
        )}

        {hasRun && comparison && !isLoading && (
          <div className="space-y-8 animate-fade-in">
            
            {/* a. VERDICT BLOCK */}
            <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 sm:p-8 shadow-ledger">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted font-mono font-medium">
                  Algorithmic Verdict
                </span>
                {comparison.scale_note && (
                  <span className="text-[11px] font-sans border border-broadsheet-rule dark:border-broadsheet-dark-rule px-2 py-0.5 text-broadsheet-muted">
                    {comparison.scale_note}
                  </span>
                )}
              </div>

              <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal leading-snug">
                {comparison.verdict}
              </h2>
            </div>

            {/* b. HEAD-TO-HEAD METRIC BENCHMARK TABLE */}
            <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 shadow-ledger">
              <div className="flex items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted font-mono font-medium">
                  Metric by metric benchmark
                </span>
                <span className="text-xs text-broadsheet-muted font-mono">
                  {selectedSymbols.length} candidate stocks evaluated
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg/40 text-[11px] uppercase text-broadsheet-muted dark:text-broadsheet-dark-muted">
                      <th className="py-2.5 px-4 font-medium">Metric</th>
                      <th className="py-2.5 px-4 text-right font-medium">Greedy</th>
                      <th className="py-2.5 px-4 text-right font-medium">0/1 Knapsack (DP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-broadsheet-rule dark:divide-broadsheet-dark-rule">
                    {/* 1. Expected profit */}
                    <tr>
                      <td className="py-3 px-4 font-sans font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">
                        Expected profit
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span>{formatINR(comparison.greedy.expected_return_rupees, false)}</span>
                        {comparison.greedy.expected_return_rupees > comparison.knapsack.expected_return_rupees + 1 ? (
                          <span className="ml-2 text-[10px] text-market-profit dark:text-market-profit-dark font-semibold">
                            Better
                          </span>
                        ) : Math.abs(comparison.greedy.expected_return_rupees - comparison.knapsack.expected_return_rupees) <= 1 ? (
                          <span className="ml-2 text-[10px] text-broadsheet-muted font-normal">Tie</span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span>{formatINR(comparison.knapsack.expected_return_rupees, false)}</span>
                        {comparison.knapsack.expected_return_rupees > comparison.greedy.expected_return_rupees + 1 ? (
                          <span className="ml-2 text-[10px] text-market-profit dark:text-market-profit-dark font-semibold">
                            Better
                          </span>
                        ) : Math.abs(comparison.greedy.expected_return_rupees - comparison.knapsack.expected_return_rupees) <= 1 ? (
                          <span className="ml-2 text-[10px] text-broadsheet-muted font-normal">Tie</span>
                        ) : null}
                      </td>
                    </tr>

                    {/* 2. Sharpe ratio */}
                    <tr>
                      <td className="py-3 px-4 font-sans font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">
                        Sharpe ratio
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span>{comparison.greedy.sharpe_ratio.toFixed(2)}</span>
                        {comparison.greedy.sharpe_ratio - comparison.knapsack.sharpe_ratio > 0.02 ? (
                          <span className="ml-2 text-[10px] text-market-profit dark:text-market-profit-dark font-semibold">
                            Better
                          </span>
                        ) : Math.abs(comparison.greedy.sharpe_ratio - comparison.knapsack.sharpe_ratio) <= 0.02 ? (
                          <span className="ml-2 text-[10px] text-broadsheet-muted font-normal">Tie</span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span>{comparison.knapsack.sharpe_ratio.toFixed(2)}</span>
                        {comparison.knapsack.sharpe_ratio - comparison.greedy.sharpe_ratio > 0.02 ? (
                          <span className="ml-2 text-[10px] text-market-profit dark:text-market-profit-dark font-semibold">
                            Better
                          </span>
                        ) : Math.abs(comparison.greedy.sharpe_ratio - comparison.knapsack.sharpe_ratio) <= 0.02 ? (
                          <span className="ml-2 text-[10px] text-broadsheet-muted font-normal">Tie</span>
                        ) : null}
                      </td>
                    </tr>

                    {/* 3. Volatility */}
                    <tr>
                      <td className="py-3 px-4 font-sans font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">
                        Volatility
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {comparison.greedy.volatility_pct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {comparison.knapsack.volatility_pct.toFixed(1)}%
                      </td>
                    </tr>

                    {/* 4. Budget used */}
                    <tr>
                      <td className="py-3 px-4 font-sans font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">
                        Budget used
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {formatINR(comparison.greedy.budget_used, false)} ({((comparison.greedy.budget_used / comparison.budget) * 100).toFixed(1)}%)
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {formatINR(comparison.knapsack.budget_used, false)} ({((comparison.knapsack.budget_used / comparison.budget) * 100).toFixed(1)}%)
                      </td>
                    </tr>

                    {/* 5. Stocks picked */}
                    <tr>
                      <td className="py-3 px-4 font-sans font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">
                        Stocks picked
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {comparison.greedy.stocks_count} / {selectedSymbols.length}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {comparison.knapsack.stocks_count} / {selectedSymbols.length}
                      </td>
                    </tr>

                    {/* 6. Execution time */}
                    <tr>
                      <td className="py-3 px-4 font-sans font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">
                        Server runtime
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span>{comparison.greedy.runtime_ms.toFixed(2)} ms</span>
                        {comparison.greedy.runtime_ms < comparison.knapsack.runtime_ms ? (
                          <span className="ml-2 text-[10px] text-market-profit dark:text-market-profit-dark font-semibold">
                            Faster
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span>{comparison.knapsack.runtime_ms.toFixed(2)} ms</span>
                        {comparison.knapsack.runtime_ms < comparison.greedy.runtime_ms ? (
                          <span className="ml-2 text-[10px] text-market-profit dark:text-market-profit-dark font-semibold">
                            Faster
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* c. TWO STOCK LISTS SIDE BY SIDE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              
              {/* Greedy Picks */}
              <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 shadow-ledger">
                <div className="flex items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-3 mb-4">
                  <h3 className="font-serif text-xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
                    Greedy picks
                  </h3>
                  <span className="text-xs font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted">
                    {comparison.greedy.stocks_count} picked
                  </span>
                </div>

                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule text-[11px] uppercase text-broadsheet-muted bg-broadsheet-cream/30 dark:bg-broadsheet-dark-bg/40 sticky top-0">
                        <th className="py-2 px-3">Stock</th>
                        <th className="py-2 px-2 text-right">Price</th>
                        <th className="py-2 px-2 text-right">Profit</th>
                        <th className="py-2 px-2 text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/40">
                      {chosenStocks.map((stock) => {
                        const picked = comparison.greedy.stocks.find((s) => s.symbol === stock.symbol);
                        const isPicked = !!picked;
                        const isExclusive = picked?.is_exclusive;

                        return (
                          <tr
                            key={stock.symbol}
                            className={`transition-colors ${
                              isPicked
                                ? isExclusive
                                  ? 'bg-broadsheet-cream/80 dark:bg-broadsheet-dark-bg/70'
                                  : 'bg-transparent'
                                : 'opacity-40'
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold">{cleanSymbol(stock.symbol)}</span>
                                {isExclusive && (
                                  <span className="border border-broadsheet-ink dark:border-broadsheet-dark-text px-1 py-0.2 text-[9px] uppercase font-sans">
                                    Only here
                                  </span>
                                )}
                                {!isPicked && (
                                  <span className="text-[10px] font-sans italic text-broadsheet-muted">
                                    Skipped
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted truncate max-w-[180px]">
                                {stock.name}
                              </div>
                            </td>

                            <td className="py-2.5 px-2 text-right tabular-nums">
                              {formatINR(stock.cost, false)}
                            </td>

                            <td className="py-2.5 px-2 text-right tabular-nums">
                              {isPicked && picked ? (
                                <span className="text-market-profit dark:text-market-profit-dark font-medium">
                                  +{formatINR(picked.expected_profit, false)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="py-2.5 px-2 text-right tabular-nums">
                              {isPicked && picked ? `${picked.weight_pct.toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 0/1 Knapsack Picks */}
              <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 shadow-ledger">
                <div className="flex items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-3 mb-4">
                  <h3 className="font-serif text-xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
                    0/1 Knapsack picks
                  </h3>
                  <span className="text-xs font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted">
                    {comparison.knapsack.stocks_count} picked
                  </span>
                </div>

                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule text-[11px] uppercase text-broadsheet-muted bg-broadsheet-cream/30 dark:bg-broadsheet-dark-bg/40 sticky top-0">
                        <th className="py-2 px-3">Stock</th>
                        <th className="py-2 px-2 text-right">Price</th>
                        <th className="py-2 px-2 text-right">Profit</th>
                        <th className="py-2 px-2 text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/40">
                      {chosenStocks.map((stock) => {
                        const picked = comparison.knapsack.stocks.find((s) => s.symbol === stock.symbol);
                        const isPicked = !!picked;
                        const isExclusive = picked?.is_exclusive;

                        return (
                          <tr
                            key={stock.symbol}
                            className={`transition-colors ${
                              isPicked
                                ? isExclusive
                                  ? 'bg-broadsheet-cream/80 dark:bg-broadsheet-dark-bg/70'
                                  : 'bg-transparent'
                                : 'opacity-40'
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold">{cleanSymbol(stock.symbol)}</span>
                                {isExclusive && (
                                  <span className="border border-broadsheet-ink dark:border-broadsheet-dark-text px-1 py-0.2 text-[9px] uppercase font-sans">
                                    Only here
                                  </span>
                                )}
                                {!isPicked && (
                                  <span className="text-[10px] font-sans italic text-broadsheet-muted">
                                    Skipped
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted truncate max-w-[180px]">
                                {stock.name}
                              </div>
                            </td>

                            <td className="py-2.5 px-2 text-right tabular-nums">
                              {formatINR(stock.cost, false)}
                            </td>

                            <td className="py-2.5 px-2 text-right tabular-nums">
                              {isPicked && picked ? (
                                <span className="text-market-profit dark:text-market-profit-dark font-medium">
                                  +{formatINR(picked.expected_profit, false)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="py-2.5 px-2 text-right tabular-nums">
                              {isPicked && picked ? `${picked.weight_pct.toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* d. COLLAPSIBLE EXPLAINER: "How the two methods work" */}
            <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 shadow-ledger">
              <button
                type="button"
                onClick={() => setHowItWorksOpen(!howItWorksOpen)}
                className="w-full flex items-center justify-between text-left"
              >
                <h3 className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
                  How the two methods work
                </h3>
                <span className="text-broadsheet-muted">
                  {howItWorksOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
              </button>

              {howItWorksOpen && (
                <div className="pt-4 mt-3 border-t border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/60 space-y-4 text-sm text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 leading-relaxed font-sans animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-serif text-lg font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text mb-1">
                        Greedy Heuristic
                      </h4>
                      <p>
                        Greedy ranks every stock by expected return per rupee and buys the best ones first until the budget runs out. It is blazing fast (sub-millisecond), but it can leave leftover cash if an expensive stock blocks two cheaper stocks that together would earn more.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-serif text-lg font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text mb-1">
                        0/1 Knapsack Dynamic Programming
                      </h4>
                      <p>
                        0/1 Knapsack evaluates combinations of stocks using dynamic programming to find the exact mathematical maximum value within your budget. It can skip a high-ranked stock if choosing other stocks together produces higher total profit.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* e. ACTION BUTTONS: "Save this run" and "Run again" */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleSaveRun}
                  className={`px-5 py-2.5 border text-xs font-sans font-medium flex items-center space-x-1.5 transition-colors ${
                    user
                      ? 'border-broadsheet-rule dark:border-broadsheet-dark-rule hover:border-broadsheet-ink text-broadsheet-ink dark:text-broadsheet-dark-text'
                      : 'border-broadsheet-terracotta/40 dark:border-broadsheet-dark-brass/40 text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{user ? 'Save this run' : 'Sign in to save this run'}</span>
                </button>

                {savedRunNotice && (
                  <span className="text-xs text-market-profit dark:text-market-profit-dark font-medium animate-fade-in">
                    ✓ {savedRunNotice}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-sm font-sans font-medium text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline flex items-center space-x-1"
              >
                <span>Run again / Change inputs</span>
                <span>↑</span>
              </button>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};
