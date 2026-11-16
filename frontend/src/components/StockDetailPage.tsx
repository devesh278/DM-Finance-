import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Star,
  Plus,
  Sliders,
  HelpCircle,
  AlertTriangle,
  Search,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { StockItem, StockKeyNumbers, StockPricePoint } from '../types/stocks';
import { formatINR, formatPercent } from '../utils/formatters';
import { apiFetch } from '../utils/apiClient';

interface StockDetailPageProps {
  symbol: string;
  onBack: () => void;
  onNavigateToStocks: () => void;
  onNavigateToDashboard: () => void;
  onNavigateToOptimizer: () => void;
  onOpenAddStockModal: (stock: StockItem) => void;
  onAddToOptimizer: (symbol: string) => void;
  user?: { email: string; name: string; isDemo?: boolean } | null;
  onOpenAuth?: (mode?: 'signin' | 'signup', message?: string) => void;
}

export const StockDetailPage: React.FC<StockDetailPageProps> = ({
  symbol,
  onBack,
  onNavigateToStocks,
  onNavigateToDashboard,
  onNavigateToOptimizer,
  onOpenAddStockModal,
  onAddToOptimizer,
  user,
  onOpenAuth,
}) => {
  const [stock, setStock] = useState<StockItem | null>(null);
  const [keyNumbers, setKeyNumbers] = useState<StockKeyNumbers | null>(null);
  const [userShares, setUserShares] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  // Watchlist state
  const [isStarred, setIsStarred] = useState<boolean>(false);

  // Chart state
  const [chartRange, setChartRange] = useState<'1M' | '6M' | '1Y' | '2Y'>('1Y');
  const [chartData, setChartData] = useState<StockPricePoint[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState<boolean>(false);

  // Tooltip hover state
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<StockPricePoint | null>(null);

  // Clean symbol string
  const cleanSymbol = useMemo(() => symbol.toUpperCase().replace('.NS', ''), [symbol]);

  // Load stock details & key numbers
  const loadStockDetail = async () => {
    setIsLoading(true);
    setNotFound(false);
    setHasError(false);

    try {
      const res = await apiFetch(`/api/stocks/${cleanSymbol}`);
      if (res.status === 404) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      if (!res.ok) {
        setHasError(true);
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      if (data.stock) {
        setStock(data.stock);
        setKeyNumbers(data.key_numbers);
        setUserShares(data.user_shares || 0);
      } else {
        setNotFound(true);
      }
      setIsLoading(false);
    } catch {
      setHasError(true);
      setIsLoading(false);
    }
  };

  // Check if stock is in watchlist
  const checkWatchlist = async () => {
    if (!user) {
      setIsStarred(false);
      return;
    }
    try {
      const res = await apiFetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.symbols)) {
          setIsStarred(data.symbols.includes(cleanSymbol));
        }
      }
    } catch {
      // Ignore
    }
  };

  // Toggle watchlist
  const handleToggleWatchlist = async () => {
    if (!user) {
      onOpenAuth?.('signin', 'Sign in to save a watchlist');
      return;
    }

    const nextState = !isStarred;
    setIsStarred(nextState);

    try {
      if (nextState) {
        await apiFetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: cleanSymbol }),
        });
      } else {
        await apiFetch(`/api/watchlist/${cleanSymbol}`, {
          method: 'DELETE',
        });
      }
    } catch {
      // Revert on fail
      setIsStarred(!nextState);
    }
  };

  // Load chart history for range
  const loadChartHistory = async (rangeToLoad: '1M' | '6M' | '1Y' | '2Y') => {
    setIsLoadingChart(true);
    try {
      const res = await apiFetch(`/api/stocks/${cleanSymbol}/history?range=${rangeToLoad}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.history)) {
          setChartData(data.history);
        }
      }
    } catch {
      // Keep previous
    } finally {
      setIsLoadingChart(false);
    }
  };

  useEffect(() => {
    loadStockDetail();
    checkWatchlist();
  }, [cleanSymbol, user]);

  useEffect(() => {
    if (!notFound) {
      loadChartHistory(chartRange);
    }
  }, [cleanSymbol, chartRange, notFound]);

  // Chart geometry & calculations
  const chartWidth = 800;
  const chartHeight = 280;
  const padding = { top: 20, right: 20, bottom: 30, left: 65 };

  const { pathD, minPrice, maxPrice, yTicks, xTicks, points } = useMemo(() => {
    if (!chartData || chartData.length < 2) {
      return { pathD: '', minPrice: 0, maxPrice: 0, yTicks: [], xTicks: [], points: [] };
    }

    const prices = chartData.map((d) => d.adj_close);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const pRange = maxP - minP || 1;

    const innerW = chartWidth - padding.left - padding.right;
    const innerH = chartHeight - padding.top - padding.bottom;

    const pts = chartData.map((d, i) => {
      const x = padding.left + (i / (chartData.length - 1)) * innerW;
      const y = padding.top + innerH - ((d.adj_close - minP) / pRange) * innerH;
      return { x, y, data: d };
    });

    const dStr = pts.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '');

    // Y ticks (4 levels)
    const yTickList = [0, 0.33, 0.66, 1].map((ratio) => {
      const val = minP + ratio * pRange;
      const y = padding.top + innerH - ratio * innerH;
      return { val, y };
    });

    // X ticks (start, middle, end)
    const xTickList = [
      { label: chartData[0]?.date || '', x: padding.left },
      { label: chartData[Math.floor(chartData.length / 2)]?.date || '', x: padding.left + innerW / 2 },
      { label: chartData[chartData.length - 1]?.date || '', x: padding.left + innerW },
    ];

    return { pathD: dStr, minPrice: minP, maxPrice: maxP, yTicks: yTickList, xTicks: xTickList, points: pts };
  }, [chartData]);

  // Handle Chart Hover
  const svgRef = useRef<SVGSVGElement>(null);
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;

    // Find closest point by x
    let closest = points[0];
    let minDiff = Math.abs(points[0].x - mouseX);
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = points[i];
      }
    }
    setHoveredPoint(closest.data);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Search input for Unknown Stock state
  const [fallbackSearch, setFallbackSearch] = useState('');

  // 1. UNKNOWN STOCK STATE
  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-16 text-center space-y-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-broadsheet-ink dark:text-broadsheet-dark-text">
          We couldn&apos;t find that stock
        </h1>
        <p className="font-sans text-sm text-broadsheet-muted dark:text-broadsheet-dark-muted max-w-md mx-auto">
          No active or listed NSE security matches &apos;{cleanSymbol}&apos;. Search for another company name or symbol below.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (fallbackSearch.trim()) {
              window.history.pushState(null, '', `/stocks/${fallbackSearch.trim().toUpperCase()}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }}
          className="max-w-md mx-auto flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-broadsheet-muted dark:text-broadsheet-dark-muted" />
            <input
              type="text"
              value={fallbackSearch}
              onChange={(e) => setFallbackSearch(e.target.value)}
              placeholder="Search by name or symbol (e.g. TCS, INFY)"
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule text-broadsheet-ink dark:text-broadsheet-dark-text focus:outline-none focus:ring-1 focus:ring-broadsheet-terracotta dark:focus:ring-broadsheet-dark-brass min-h-[44px]"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-broadsheet-terracotta dark:bg-broadsheet-dark-brass text-white dark:text-black font-sans text-sm font-medium hover:opacity-90 min-h-[44px]"
          >
            Search
          </button>
        </form>

        <div className="pt-4">
          <button
            type="button"
            onClick={onNavigateToStocks}
            className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass font-medium hover:underline text-sm inline-flex items-center space-x-1 min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Browse all stocks</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. ERROR STATE
  if (hasError) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-16 text-center space-y-4">
        <p className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text">
          Couldn&apos;t load stock details. Try again.
        </p>
        <button
          type="button"
          onClick={loadStockDetail}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-broadsheet-terracotta dark:bg-broadsheet-dark-brass text-white dark:text-black font-sans text-sm font-medium hover:opacity-90 min-h-[44px]"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // 3. LOADING STATE
  if (isLoading || !stock) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8 animate-pulse">
        <div className="h-4 w-24 bg-broadsheet-rule/30 dark:bg-broadsheet-dark-rule/40 rounded" />
        <div className="space-y-3">
          <div className="h-10 w-2/3 bg-broadsheet-rule/30 dark:bg-broadsheet-dark-rule/40 rounded" />
          <div className="h-4 w-1/3 bg-broadsheet-rule/20 dark:bg-broadsheet-dark-rule/30 rounded" />
        </div>
        <div className="h-72 w-full border border-broadsheet-rule/40 dark:border-broadsheet-dark-rule/40 bg-broadsheet-paper/50 dark:bg-broadsheet-dark-paper/50 rounded" />
      </div>
    );
  }

  const isTodayPositive = (stock.today_change_amount || 0) >= 0;
  const isOneYearPositive = (stock.one_year_return_pct || 0) >= 0;
  const isStockListed = stock.is_active !== false;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 transition-colors duration-200">
      
      {/* Back button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to stocks</span>
        </button>
      </div>

      {/* DELISTED / INACTIVE BANNER */}
      {!isStockListed && (
        <div className="mb-6 border border-market-loss dark:border-market-loss-dark bg-market-loss/10 dark:bg-market-loss-dark/10 p-4 flex items-center space-x-3 text-sm text-market-loss dark:text-market-loss-dark">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="font-sans font-medium">This stock is no longer listed. Historical data is shown for educational reference.</span>
        </div>
      )}

      {/* HEADER BLOCK */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-broadsheet-rule dark:border-broadsheet-dark-rule mb-8">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-broadsheet-ink dark:text-broadsheet-dark-text tracking-tight mb-2">
            {stock.company_name}
          </h1>
          <div className="flex items-center space-x-3 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted">
            <span className="font-mono font-medium text-sm text-broadsheet-ink dark:text-broadsheet-dark-text">
              {stock.clean_symbol}
            </span>
            <span>•</span>
            <span>{stock.sector}</span>
            <span>•</span>
            <span>NSE Equity</span>
          </div>
        </div>

        <div className="text-left md:text-right">
          <div className="flex items-baseline md:justify-end space-x-3">
            <span className="font-mono text-3xl sm:text-4xl font-semibold tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text">
              {formatINR(stock.last_price)}
            </span>
            <span className={`font-mono text-sm font-medium tabular-nums ${isTodayPositive ? 'text-market-profit dark:text-market-profit-dark' : 'text-market-loss dark:text-market-loss-dark'}`}>
              {isTodayPositive ? '▲ ' : '▼ '}
              {formatINR(Math.abs(stock.today_change_amount || 0))} ({formatPercent(stock.today_change_pct || 0)})
            </span>
          </div>
          <div className="text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted mt-1">
            Price may be delayed
          </div>
        </div>
      </div>

      {/* USER HOLDINGS NOTE (IF OWNED) */}
      {userShares > 0 && (
        <div className="mb-6 p-3 bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule flex items-center justify-between text-xs font-sans">
          <span>
            You hold <strong className="font-mono tabular-nums text-sm font-semibold">{userShares}</strong> shares of {stock.clean_symbol} in your portfolio.
          </span>
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline font-medium ml-4 min-h-[44px] flex items-center"
          >
            View in Dashboard →
          </button>
        </div>
      )}

      {/* PRICE CHART */}
      <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-4 sm:p-6 mb-8">
        
        {/* Chart Header & Range Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="text-xs uppercase font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted tracking-wider">
              Historical Price
            </div>
            {hoveredPoint ? (
              <div className="font-mono text-lg tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text mt-0.5">
                {formatINR(hoveredPoint.adj_close)}{' '}
                <span className="text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted font-sans">
                  on {hoveredPoint.date}
                </span>
              </div>
            ) : (
              <div className="text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted mt-0.5 font-sans">
                Adjusted daily closes (splits & bonus accounted for)
              </div>
            )}
          </div>

          {/* Range Buttons (1M, 6M, 1Y, 2Y) */}
          <div className="flex items-center space-x-1 border border-broadsheet-rule dark:border-broadsheet-dark-rule p-0.5 bg-broadsheet-cream/30 dark:bg-broadsheet-dark-bg/30">
            {(['1M', '6M', '1Y', '2Y'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setChartRange(r)}
                className={`px-3 py-1.5 text-xs font-sans font-medium transition-colors min-h-[44px] sm:min-h-[32px] min-w-[44px] flex items-center justify-center ${
                  chartRange === r
                    ? 'bg-broadsheet-terracotta dark:bg-broadsheet-dark-brass text-white dark:text-black font-semibold'
                    : 'text-broadsheet-muted dark:text-broadsheet-dark-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Interactive Chart */}
        <div className="relative w-full overflow-hidden">
          {isLoadingChart ? (
            <div className="h-[280px] flex items-center justify-center text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted">
              Loading price history...
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-[240px] sm:h-[280px] overflow-visible cursor-crosshair select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {/* Hairline Grid Lines & Y-Axis Labels */}
              {yTicks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={tick.y}
                    x2={chartWidth - padding.right}
                    y2={tick.y}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="2,3"
                    className="text-broadsheet-rule/50 dark:text-broadsheet-dark-rule/50"
                  />
                  <text
                    x={padding.left - 8}
                    y={tick.y + 4}
                    textAnchor="end"
                    className="font-mono text-[10px] tabular-nums fill-broadsheet-muted dark:fill-broadsheet-dark-muted"
                  >
                    ₹{Math.round(tick.val)}
                  </text>
                </g>
              ))}

              {/* X-Axis Date Labels */}
              {xTicks.map((t, i) => (
                <text
                  key={i}
                  x={t.x}
                  y={chartHeight - 6}
                  textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
                  className="font-mono text-[10px] tabular-nums fill-broadsheet-muted dark:fill-broadsheet-dark-muted"
                >
                  {t.label}
                </text>
              ))}

              {/* Main Line */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={isOneYearPositive ? '#15803d' : '#b91c1c'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover Crosshair & Dot */}
              {hoveredPoint && (
                (() => {
                  const pt = points.find((p) => p.data.date === hoveredPoint.date);
                  if (!pt) return null;
                  return (
                    <g>
                      <line
                        x1={pt.x}
                        y1={padding.top}
                        x2={pt.x}
                        y2={chartHeight - padding.bottom}
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-broadsheet-ink/40 dark:text-broadsheet-dark-text/40"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        fill="currentColor"
                        className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass"
                      />
                    </g>
                  );
                })()
              )}
            </svg>
          )}
        </div>
      </div>

      {/* KEY NUMBERS BLOCK */}
      <div className="mb-8">
        <div className="text-xs uppercase font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted tracking-wider mb-3">
          Key Numbers
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* 1. 1-Year Return */}
          <div className="p-4 bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule relative">
            <div className="flex items-center justify-between text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted mb-1 font-sans">
              <span>1-Year Return</span>
              <button
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === 'return' ? null : 'return')}
                className="text-broadsheet-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text"
                aria-label="Explain 1-Year Return"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className={`font-mono text-2xl font-semibold tabular-nums ${isOneYearPositive ? 'text-market-profit dark:text-market-profit-dark' : 'text-market-loss dark:text-market-loss-dark'}`}>
              {isOneYearPositive ? '▲ ' : '▼ '}
              {formatPercent(stock.one_year_return_pct)}
            </div>
            {activeTooltip === 'return' && (
              <div className="mt-2 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted bg-broadsheet-cream/70 dark:bg-broadsheet-dark-bg/70 p-2 border border-broadsheet-rule dark:border-broadsheet-dark-rule">
                Total price return over the past 252 trading sessions.
              </div>
            )}
          </div>

          {/* 2. Volatility */}
          <div className="p-4 bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule relative">
            <div className="flex items-center justify-between text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted mb-1 font-sans">
              <span>Volatility</span>
              <button
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === 'vol' ? null : 'vol')}
                className="text-broadsheet-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text"
                aria-label="Explain Volatility"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text">
              {formatPercent(stock.volatility_pct)}
            </div>
            <div className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted font-sans mt-0.5">
              How bumpy the price has been
            </div>
            {activeTooltip === 'vol' && (
              <div className="mt-2 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted bg-broadsheet-cream/70 dark:bg-broadsheet-dark-bg/70 p-2 border border-broadsheet-rule dark:border-broadsheet-dark-rule">
                Annualised standard deviation of daily returns. Higher means wider day-to-day price swings.
              </div>
            )}
          </div>

          {/* 3. 52-Week Range */}
          <div className="p-4 bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule relative">
            <div className="flex items-center justify-between text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted mb-1 font-sans">
              <span>52-Week Range</span>
              <button
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === 'range' ? null : 'range')}
                className="text-broadsheet-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text"
                aria-label="Explain 52-Week Range"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="font-mono text-sm font-semibold tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text flex items-baseline justify-between pt-1">
              <span>L: {formatINR(stock.fifty_two_week_low)}</span>
              <span>H: {formatINR(stock.fifty_two_week_high)}</span>
            </div>
            {activeTooltip === 'range' && (
              <div className="mt-2 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted bg-broadsheet-cream/70 dark:bg-broadsheet-dark-bg/70 p-2 border border-broadsheet-rule dark:border-broadsheet-dark-rule">
                The lowest and highest adjusted closing prices recorded over the past year.
              </div>
            )}
          </div>

          {/* 4. Best & Worst Day in Last Year */}
          <div className="p-4 bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule relative">
            <div className="flex items-center justify-between text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted mb-1 font-sans">
              <span>Single-Day Extremes</span>
              <button
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === 'extremes' ? null : 'extremes')}
                className="text-broadsheet-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text"
                aria-label="Explain Single-Day Extremes"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-xs font-sans space-y-0.5 pt-0.5">
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-market-profit dark:text-market-profit-dark font-medium">
                  Best: {formatPercent(stock.best_day_pct)}
                </span>
                <span className="text-broadsheet-muted dark:text-broadsheet-dark-muted text-[11px]">
                  {stock.best_day_date}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-market-loss dark:text-market-loss-dark font-medium">
                  Worst: {formatPercent(stock.worst_day_pct)}
                </span>
                <span className="text-broadsheet-muted dark:text-broadsheet-dark-muted text-[11px]">
                  {stock.worst_day_date}
                </span>
              </div>
            </div>
            {activeTooltip === 'extremes' && (
              <div className="mt-2 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted bg-broadsheet-cream/70 dark:bg-broadsheet-dark-bg/70 p-2 border border-broadsheet-rule dark:border-broadsheet-dark-rule">
                The largest single-session gain and drop recorded in the last 252 trading sessions.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* THREE ACTIONS */}
      <div className="border-t border-broadsheet-rule dark:border-broadsheet-dark-rule pt-6 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Action 1: Add to portfolio */}
          <button
            type="button"
            disabled={!isStockListed}
            onClick={() => onOpenAddStockModal(stock)}
            className="px-5 py-2.5 bg-broadsheet-terracotta dark:bg-broadsheet-dark-brass text-white dark:text-black font-sans text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add to portfolio</span>
          </button>

          {/* Action 2: Add to optimizer */}
          <button
            type="button"
            disabled={!isStockListed}
            onClick={() => onAddToOptimizer(stock.clean_symbol)}
            className="px-5 py-2.5 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper text-broadsheet-ink dark:text-broadsheet-dark-text font-sans text-sm font-medium hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center space-x-2"
          >
            <Sliders className="w-4 h-4 text-broadsheet-terracotta dark:text-broadsheet-dark-brass" />
            <span>Add to optimizer</span>
          </button>

          {/* Action 3: Star (Watchlist) */}
          <button
            type="button"
            onClick={handleToggleWatchlist}
            className={`px-4 py-2.5 border border-broadsheet-rule dark:border-broadsheet-dark-rule font-sans text-sm font-medium transition-colors min-h-[44px] flex items-center space-x-2 ${
              isStarred
                ? 'bg-broadsheet-cream/70 dark:bg-broadsheet-dark-bg/70 text-broadsheet-terracotta dark:text-broadsheet-dark-brass'
                : 'bg-broadsheet-paper dark:bg-broadsheet-dark-paper text-broadsheet-ink dark:text-broadsheet-dark-text hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg/60'
            }`}
          >
            <Star className={`w-4 h-4 ${isStarred ? 'fill-current' : ''}`} />
            <span>{isStarred ? 'Starred' : 'Add to watchlist'}</span>
          </button>
        </div>

        {/* Small educational notice line */}
        <p className="mt-4 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted">
          Past returns do not predict future returns. Educational tool, not investment advice.
        </p>
      </div>

    </div>
  );
};
