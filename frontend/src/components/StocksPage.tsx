import React, { useState, useEffect, useMemo } from 'react';
import { Search, Star, ChevronLeft, ChevronRight, RotateCcw, AlertCircle, ArrowUpDown } from 'lucide-react';
import { StockItem } from '../types/stocks';
import { formatINR, formatPercent } from '../utils/formatters';
import { Sparkline } from './Sparkline';
import { apiFetch } from '../utils/apiClient';

interface StocksPageProps {
  onSelectStock: (symbol: string) => void;
  user?: { email: string; name: string; isDemo?: boolean } | null;
  onOpenAuth?: (mode?: 'signin' | 'signup', message?: string) => void;
  pendingStarSymbol?: string | null;
  onClearPendingStar?: () => void;
}

export const StocksPage: React.FC<StocksPageProps> = ({
  onSelectStock,
  user,
  onOpenAuth,
  pendingStarSymbol,
  onClearPendingStar,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'watchlist'>('all');
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  // Watchlist symbols set (clean symbols e.g. "RELIANCE")
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [indexGroupFilter, setIndexGroupFilter] = useState<'all' | 'nifty50' | 'next50' | 'midcap100'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'return_desc' | 'return_asc' | 'volatility_desc' | 'volatility_asc'>('name_asc');

  // Pagination (25 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 25;

  // Load stocks catalog
  const loadStocks = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await apiFetch('/api/stocks');
      if (res.ok) {
        const data = await res.json();
        if (data.stocks) {
          setStocks(data.stocks);
          setIsLoading(false);
          return;
        }
      }
      setHasError(true);
      setIsLoading(false);
    } catch {
      setHasError(true);
      setIsLoading(false);
    }
  };

  // Load user's watchlist from server
  const loadWatchlist = async () => {
    if (!user) {
      setWatchlist(new Set());
      return;
    }
    try {
      const res = await apiFetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.symbols)) {
          setWatchlist(new Set(data.symbols));
        }
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadStocks();
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [user]);

  // Handle pending star after user logs in
  useEffect(() => {
    if (user && pendingStarSymbol) {
      handleToggleWatchlist(pendingStarSymbol, true);
      onClearPendingStar?.();
    }
  }, [user, pendingStarSymbol]);

  // Extract unique sectors
  const sectors = useMemo(() => {
    const s = new Set<string>();
    stocks.forEach((stk) => {
      if (stk.sector) s.add(stk.sector);
    });
    return Array.from(s).sort();
  }, [stocks]);

  // Toggle watchlist
  const handleToggleWatchlist = async (cleanSym: string, forceAdd = false) => {
    if (!user) {
      onOpenAuth?.('signin', 'Sign in to save a watchlist');
      return;
    }

    const isStarred = watchlist.has(cleanSym);
    const newSet = new Set(watchlist);

    if (isStarred && !forceAdd) {
      newSet.delete(cleanSym);
      setWatchlist(newSet);
      try {
        await apiFetch(`/api/watchlist/${cleanSym}`, { method: 'DELETE' });
      } catch {
        // Rollback on fail
        loadWatchlist();
      }
    } else {
      newSet.add(cleanSym);
      setWatchlist(newSet);
      try {
        await apiFetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: cleanSym }),
        });
      } catch {
        // Rollback on fail
        loadWatchlist();
      }
    }
  };

  // Filter & Sort stocks
  const filteredStocks = useMemo(() => {
    let result = [...stocks];

    // 1. Tab filter
    if (activeTab === 'watchlist') {
      result = result.filter((s) => watchlist.has(s.clean_symbol));
    }

    // 2. Search query (matches company name or symbol)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) =>
        s.company_name.toLowerCase().includes(q) ||
        s.clean_symbol.toLowerCase().includes(q)
      );
    }

    // 3. Sector filter
    if (sectorFilter !== 'all') {
      result = result.filter((s) => s.sector === sectorFilter);
    }

    // 4. Index Group filter
    if (indexGroupFilter !== 'all') {
      result = result.filter((s) => s.index_group === indexGroupFilter);
    }

    // 5. Sort
    result.sort((a, b) => {
      if (sortBy === 'name_asc') return a.company_name.localeCompare(b.company_name);
      if (sortBy === 'name_desc') return b.company_name.localeCompare(a.company_name);
      if (sortBy === 'price_asc') return a.last_price - b.last_price;
      if (sortBy === 'price_desc') return b.last_price - a.last_price;
      if (sortBy === 'return_desc') return b.one_year_return_pct - a.one_year_return_pct;
      if (sortBy === 'return_asc') return a.one_year_return_pct - b.one_year_return_pct;
      if (sortBy === 'volatility_desc') return b.volatility_pct - a.volatility_pct;
      if (sortBy === 'volatility_asc') return a.volatility_pct - b.volatility_pct;
      return 0;
    });

    return result;
  }, [stocks, activeTab, watchlist, searchQuery, sectorFilter, indexGroupFilter, sortBy]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, sectorFilter, indexGroupFilter, sortBy]);

  // Pagination calculation
  const totalItems = filteredStocks.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageStocks = filteredStocks.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 transition-colors duration-200">
      
      {/* Title & One-line Subtitle */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-broadsheet-ink dark:text-broadsheet-dark-text mb-2">
          Stocks
        </h1>
        <p className="font-sans text-base text-broadsheet-muted dark:text-broadsheet-dark-muted">
          Search NSE stocks and check how they have moved.
        </p>
      </div>

      {/* Tabs: All stocks vs Watchlist */}
      <div className="flex border-b border-broadsheet-rule dark:border-broadsheet-dark-rule mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`py-3 px-5 font-sans text-sm font-medium transition-colors border-b-2 -mb-px flex items-center space-x-2 ${
            activeTab === 'all'
              ? 'border-broadsheet-terracotta dark:border-broadsheet-dark-brass text-broadsheet-terracotta dark:text-broadsheet-dark-brass'
              : 'border-transparent text-broadsheet-muted dark:text-broadsheet-dark-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text'
          }`}
        >
          <span>All stocks</span>
          <span className="font-mono text-xs opacity-75 tabular-nums">({stocks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!user) {
              onOpenAuth?.('signin', 'Sign in to save a watchlist');
              return;
            }
            setActiveTab('watchlist');
          }}
          className={`py-3 px-5 font-sans text-sm font-medium transition-colors border-b-2 -mb-px flex items-center space-x-2 ${
            activeTab === 'watchlist'
              ? 'border-broadsheet-terracotta dark:border-broadsheet-dark-brass text-broadsheet-terracotta dark:text-broadsheet-dark-brass'
              : 'border-transparent text-broadsheet-muted dark:text-broadsheet-dark-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${activeTab === 'watchlist' ? 'fill-current' : ''}`} />
          <span>Watchlist</span>
          {user && (
            <span className="font-mono text-xs opacity-75 tabular-nums">({watchlist.size})</span>
          )}
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-broadsheet-muted dark:text-broadsheet-dark-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or symbol"
            className="w-full pl-9 pr-3 py-2 text-sm bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule text-broadsheet-ink dark:text-broadsheet-dark-text placeholder:text-broadsheet-muted/70 focus:outline-none focus:ring-1 focus:ring-broadsheet-terracotta dark:focus:ring-broadsheet-dark-brass transition-colors min-h-[44px]"
          />
        </div>

        {/* Sector Filter */}
        <div>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule text-broadsheet-ink dark:text-broadsheet-dark-text focus:outline-none focus:ring-1 focus:ring-broadsheet-terracotta dark:focus:ring-broadsheet-dark-brass transition-colors min-h-[44px]"
          >
            <option value="all">All Sectors</option>
            {sectors.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Index Group Filter */}
        <div>
          <select
            value={indexGroupFilter}
            onChange={(e) => setIndexGroupFilter(e.target.value as any)}
            className="w-full px-3 py-2 text-sm bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule text-broadsheet-ink dark:text-broadsheet-dark-text focus:outline-none focus:ring-1 focus:ring-broadsheet-terracotta dark:focus:ring-broadsheet-dark-brass transition-colors min-h-[44px]"
          >
            <option value="all">All Index Groups</option>
            <option value="nifty50">Nifty 50</option>
            <option value="next50">Nifty Next 50</option>
            <option value="midcap100">Nifty Midcap 100</option>
          </select>
        </div>

        {/* Sort */}
        <div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 text-sm bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule text-broadsheet-ink dark:text-broadsheet-dark-text focus:outline-none focus:ring-1 focus:ring-broadsheet-terracotta dark:focus:ring-broadsheet-dark-brass transition-colors min-h-[44px]"
          >
            <option value="name_asc">Sort: Name (A to Z)</option>
            <option value="name_desc">Sort: Name (Z to A)</option>
            <option value="price_desc">Sort: Price (High to Low)</option>
            <option value="price_asc">Sort: Price (Low to High)</option>
            <option value="return_desc">Sort: 1-Year Return (Highest)</option>
            <option value="return_asc">Sort: 1-Year Return (Lowest)</option>
            <option value="volatility_desc">Sort: Volatility (Highest)</option>
            <option value="volatility_asc">Sort: Volatility (Lowest)</option>
          </select>
        </div>
      </div>

      {/* MAIN CONTENT STATES */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/60 animate-pulse">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between">
              <div className="space-y-2 w-1/3">
                <div className="h-4 bg-broadsheet-rule/30 dark:bg-broadsheet-dark-rule/40 rounded w-3/4" />
                <div className="h-3 bg-broadsheet-rule/20 dark:bg-broadsheet-dark-rule/30 rounded w-1/4" />
              </div>
              <div className="h-4 bg-broadsheet-rule/20 dark:bg-broadsheet-dark-rule/30 rounded w-1/6 hidden sm:block" />
              <div className="h-4 bg-broadsheet-rule/30 dark:bg-broadsheet-dark-rule/40 rounded w-20" />
              <div className="h-4 bg-broadsheet-rule/20 dark:bg-broadsheet-dark-rule/30 rounded w-16" />
              <div className="h-5 bg-broadsheet-rule/20 dark:bg-broadsheet-dark-rule/30 rounded w-24 hidden md:block" />
            </div>
          ))}
        </div>
      ) : hasError ? (
        /* Error State */
        <div className="border border-market-loss dark:border-market-loss-dark p-8 text-center space-y-4 bg-broadsheet-paper dark:bg-broadsheet-dark-paper">
          <p className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text">
            Couldn&apos;t load stocks. Try again.
          </p>
          <button
            type="button"
            onClick={loadStocks}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-broadsheet-terracotta dark:bg-broadsheet-dark-brass text-white dark:text-black font-sans text-sm font-medium hover:opacity-90 transition-opacity min-h-[44px]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      ) : filteredStocks.length === 0 ? (
        /* Empty States */
        activeTab === 'watchlist' && !searchQuery.trim() ? (
          <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule p-12 text-center space-y-3 bg-broadsheet-paper dark:bg-broadsheet-dark-paper">
            <Star className="w-8 h-8 mx-auto text-broadsheet-muted dark:text-broadsheet-dark-muted opacity-50" />
            <p className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text">
              No stocks in your watchlist yet.
            </p>
            <p className="font-sans text-sm text-broadsheet-muted dark:text-broadsheet-dark-muted">
              Star stocks from the list to track them here.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className="mt-2 inline-block text-broadsheet-terracotta dark:text-broadsheet-dark-brass font-medium hover:underline text-sm"
            >
              Browse all stocks →
            </button>
          </div>
        ) : (
          <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule p-12 text-center space-y-2 bg-broadsheet-paper dark:bg-broadsheet-dark-paper">
            <p className="font-sans text-base text-broadsheet-ink dark:text-broadsheet-dark-text">
              No stocks match &apos;{searchQuery}&apos;. Try a company name or symbol.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSectorFilter('all');
                setIndexGroupFilter('all');
              }}
              className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass font-medium hover:underline text-sm inline-block pt-2"
            >
              Clear filters
            </button>
          </div>
        )
      ) : (
        /* TABLE (DESKTOP) + STACKED CARDS (MOBILE) */
        <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper overflow-hidden">
          
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg/40 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted uppercase tracking-wider">
                  <th scope="col" className="w-12 px-4 py-3 text-center">
                    <span className="sr-only">Watchlist</span>
                  </th>
                  <th scope="col" className="px-4 py-3">Company</th>
                  <th scope="col" className="px-4 py-3">Sector</th>
                  <th scope="col" className="px-4 py-3 text-right">Price</th>
                  <th scope="col" className="px-4 py-3 text-right">1-Yr Return</th>
                  <th scope="col" className="px-4 py-3 text-right">1-Yr Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/60 text-sm">
                {pageStocks.map((stock) => {
                  const isStarred = watchlist.has(stock.clean_symbol);
                  const isPositive = stock.one_year_return_pct >= 0;

                  return (
                    <tr
                      key={stock.symbol}
                      onClick={() => onSelectStock(stock.clean_symbol)}
                      className="cursor-pointer hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg/60 transition-colors group"
                    >
                      {/* Star Button */}
                      <td
                        className="px-4 py-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleWatchlist(stock.clean_symbol);
                        }}
                      >
                        <button
                          type="button"
                          aria-label={isStarred ? `Remove ${stock.clean_symbol} from watchlist` : `Add ${stock.clean_symbol} to watchlist`}
                          className="p-1.5 text-broadsheet-muted dark:text-broadsheet-dark-muted hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center mx-auto"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              isStarred
                                ? 'fill-broadsheet-terracotta text-broadsheet-terracotta dark:fill-broadsheet-dark-brass dark:text-broadsheet-dark-brass'
                                : 'text-broadsheet-muted/50 dark:text-broadsheet-dark-muted/50'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Company Name + Symbol */}
                      <td className="px-4 py-3">
                        <div className="font-sans font-medium text-broadsheet-ink dark:text-broadsheet-dark-text group-hover:text-broadsheet-terracotta dark:group-hover:text-broadsheet-dark-brass transition-colors">
                          {stock.company_name}
                        </div>
                        <div className="font-mono text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted">
                          {stock.clean_symbol}
                        </div>
                      </td>

                      {/* Sector */}
                      <td className="px-4 py-3 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted">
                        {stock.sector}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text font-medium">
                        {formatINR(stock.last_price)}
                      </td>

                      {/* 1-Year Return */}
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums font-medium">
                        <span className={isPositive ? 'text-market-profit dark:text-market-profit-dark' : 'text-market-loss dark:text-market-loss-dark'}>
                          {isPositive ? '▲ ' : '▼ '}
                          {formatPercent(Math.abs(stock.one_year_return_pct))}
                        </span>
                      </td>

                      {/* Sparkline */}
                      <td className="px-4 py-3 text-right">
                        <Sparkline data={stock.sparkline} isPositive={isPositive} width={90} height={22} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards View (< sm screens) */}
          <div className="sm:hidden divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/60">
            {pageStocks.map((stock) => {
              const isStarred = watchlist.has(stock.clean_symbol);
              const isPositive = stock.one_year_return_pct >= 0;

              return (
                <div
                  key={stock.symbol}
                  onClick={() => onSelectStock(stock.clean_symbol)}
                  className="p-4 space-y-3 cursor-pointer hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-sans font-medium text-base text-broadsheet-ink dark:text-broadsheet-dark-text">
                        {stock.company_name}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted mt-0.5">
                        <span className="font-mono font-medium">{stock.clean_symbol}</span>
                        <span>•</span>
                        <span>{stock.sector}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleWatchlist(stock.clean_symbol);
                      }}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-broadsheet-muted dark:text-broadsheet-dark-muted hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass"
                      aria-label={isStarred ? `Remove ${stock.clean_symbol} from watchlist` : `Add ${stock.clean_symbol} to watchlist`}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          isStarred
                            ? 'fill-broadsheet-terracotta text-broadsheet-terracotta dark:fill-broadsheet-dark-brass dark:text-broadsheet-dark-brass'
                            : 'text-broadsheet-muted/50 dark:text-broadsheet-dark-muted/50'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted">Price</div>
                      <div className="font-mono text-base tabular-nums font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">
                        {formatINR(stock.last_price)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted">1-Yr Return</div>
                      <div className={`font-mono text-sm tabular-nums font-medium ${isPositive ? 'text-market-profit dark:text-market-profit-dark' : 'text-market-loss dark:text-market-loss-dark'}`}>
                        {isPositive ? '▲ ' : '▼ '}
                        {formatPercent(Math.abs(stock.one_year_return_pct))}
                      </div>
                    </div>

                    <div className="pl-2">
                      <Sparkline data={stock.sparkline} isPositive={isPositive} width={70} height={20} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-cream/20 dark:bg-broadsheet-dark-bg/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted">
              <div>
                Showing <span className="font-mono tabular-nums font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">{startIndex + 1}</span>–
                <span className="font-mono tabular-nums font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">{Math.min(startIndex + PAGE_SIZE, totalItems)}</span> of{' '}
                <span className="font-mono tabular-nums font-medium text-broadsheet-ink dark:text-broadsheet-dark-text">{totalItems}</span> stocks
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper text-broadsheet-ink dark:text-broadsheet-dark-text disabled:opacity-30 disabled:cursor-not-allowed hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg/60 transition-colors min-h-[44px] sm:min-h-[36px] flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="font-mono tabular-nums px-2">
                  {currentPage} / {totalPages}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper text-broadsheet-ink dark:text-broadsheet-dark-text disabled:opacity-30 disabled:cursor-not-allowed hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg/60 transition-colors min-h-[44px] sm:min-h-[36px] flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disclaimers under the table */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted font-sans gap-2">
        <p>Price may be delayed.</p>
        {user?.isDemo && (
          <p className="text-broadsheet-muted/80">Sample data</p>
        )}
      </div>
    </div>
  );
};
