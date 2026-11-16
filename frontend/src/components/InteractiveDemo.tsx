import React, { useState } from 'react';
import { RefreshCw, AlertCircle, PlusCircle, Sparkles, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import { DEMO_STOCKS, DEMO_PORTFOLIO_SUMMARY, StockHolding } from '../data/mockPortfolio';
import { formatINR, formatPercent } from '../utils/formatters';

type DemoState = 'live' | 'loading' | 'empty' | 'error';

export const InteractiveDemo: React.FC = () => {
  const [activeState, setActiveState] = useState<DemoState>('live');
  const [stocks, setStocks] = useState<StockHolding[]>(DEMO_STOCKS);
  const [frontierSlider, setFrontierSlider] = useState<number>(65); // 0 (min vol) to 100 (max return)

  // Quick action to add stock in empty state
  const handleAddSampleStock = (symbol: string, name: string, price: number, sector: string) => {
    const newStock: StockHolding = {
      symbol,
      name,
      sector,
      shares: 50,
      avgBuyPrice: price,
      currentPrice: price,
      dayChange: 12.5,
      dayChangePercent: 0.65,
      currentWeight: 100,
      optimizedWeight: 100,
    };
    setStocks([newStock]);
    setActiveState('live');
  };

  const handleResetToAll = () => {
    setStocks(DEMO_STOCKS);
    setActiveState('live');
  };

  // Efficient Frontier dynamic coordinate calculations
  // X: Volatility (10% to 28%), Y: Return (12% to 28%)
  const curvePoints = [
    { vol: 11.2, ret: 14.8, label: 'Min Volatility' },
    { vol: 12.5, ret: 17.5, label: 'Conservative' },
    { vol: 14.1, ret: 20.2, label: 'Max Sharpe (Optimal)' },
    { vol: 16.8, ret: 22.8, label: 'Growth Posture' },
    { vol: 20.5, ret: 25.4, label: 'Aggressive' },
    { vol: 24.8, ret: 27.2, label: 'Max Return' },
  ];

  // Active point mapped to slider
  const activeVol = (11.2 + (frontierSlider / 100) * (24.8 - 11.2)).toFixed(1);
  const activeRet = (14.8 + Math.pow(frontierSlider / 100, 0.75) * (27.2 - 14.8)).toFixed(1);
  const activeSharpe = ((parseFloat(activeRet) - 6.5) / parseFloat(activeVol)).toFixed(2); // 6.5% RBI repo rate risk-free

  return (
    <section id="interactive-demo" className="py-14 px-4 sm:px-8 max-w-7xl mx-auto border-b border-broadsheet-rule dark:border-broadsheet-dark-rule">
      
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-broadsheet-rule dark:border-broadsheet-dark-rule">
        <div>
          <span className="text-xs font-mono tracking-widest text-broadsheet-terracotta dark:text-broadsheet-dark-brass uppercase block mb-1">
            Section II • System States &amp; Frontier Simulation
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
            Inspect the Ledger in Every Scenario
          </h2>
          <p className="mt-1 text-sm font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted max-w-xl">
            Clean software handles real-world chaos gracefully. Toggle between live data, async network loading, an empty portfolio, and an NSE downtime error.
          </p>
        </div>

        {/* State Switcher Tabs */}
        <div className="mt-4 md:mt-0 flex items-center border border-broadsheet-rule dark:border-broadsheet-dark-rule font-mono text-xs">
          <button
            onClick={() => setActiveState('live')}
            className={`px-3 py-2 transition-colors ${
              activeState === 'live'
                ? 'bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black font-semibold'
                : 'hover:bg-broadsheet-rule-subtle/50 dark:hover:bg-broadsheet-dark-paper text-broadsheet-muted dark:text-broadsheet-dark-muted'
            }`}
          >
            Live Data
          </button>
          <button
            onClick={() => setActiveState('loading')}
            className={`px-3 py-2 border-l border-broadsheet-rule dark:border-broadsheet-dark-rule transition-colors ${
              activeState === 'loading'
                ? 'bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black font-semibold'
                : 'hover:bg-broadsheet-rule-subtle/50 dark:hover:bg-broadsheet-dark-paper text-broadsheet-muted dark:text-broadsheet-dark-muted'
            }`}
          >
            Loading Skeleton
          </button>
          <button
            onClick={() => setActiveState('empty')}
            className={`px-3 py-2 border-l border-broadsheet-rule dark:border-broadsheet-dark-rule transition-colors ${
              activeState === 'empty'
                ? 'bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black font-semibold'
                : 'hover:bg-broadsheet-rule-subtle/50 dark:hover:bg-broadsheet-dark-paper text-broadsheet-muted dark:text-broadsheet-dark-muted'
            }`}
          >
            Empty Portfolio
          </button>
          <button
            onClick={() => setActiveState('error')}
            className={`px-3 py-2 border-l border-broadsheet-rule dark:border-broadsheet-dark-rule transition-colors ${
              activeState === 'error'
                ? 'bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black font-semibold'
                : 'hover:bg-broadsheet-rule-subtle/50 dark:hover:bg-broadsheet-dark-paper text-broadsheet-muted dark:text-broadsheet-dark-muted'
            }`}
          >
            NSE Error State
          </button>
        </div>
      </div>

      {/* STATE 1: LIVE DATA */}
      {activeState === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Holdings & Weight Reallocation Table (7 Cols) */}
          <div className="lg:col-span-7 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-5 sm:p-6 shadow-ledger">
            <div className="flex items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-3 mb-4">
              <div>
                <h3 className="font-serif text-xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
                  Current vs. Mathematically Ideal Weights
                </h3>
                <span className="text-xs font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted">
                  Covariance calculated across 252 NSE trading sessions
                </span>
              </div>
              <button
                onClick={handleResetToAll}
                className="text-xs font-mono text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset 5 Stocks</span>
              </button>
            </div>

            {/* Holdings Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule text-[11px] uppercase text-broadsheet-muted dark:text-broadsheet-dark-muted">
                    <th className="pb-2.5 font-medium">Asset &amp; Sector</th>
                    <th className="pb-2.5 font-medium text-right">LTP (₹)</th>
                    <th className="pb-2.5 font-medium text-right">Day Chg</th>
                    <th className="pb-2.5 font-medium text-right">Current %</th>
                    <th className="pb-2.5 font-medium text-right text-broadsheet-ink dark:text-broadsheet-dark-text">
                      Optimal %
                    </th>
                    <th className="pb-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/40">
                  {stocks.map((stock) => {
                    const weightDiff = stock.optimizedWeight - stock.currentWeight;
                    return (
                      <tr key={stock.symbol} className="hover:bg-broadsheet-cream/40 dark:hover:bg-broadsheet-dark-bg/40 transition-colors">
                        <td className="py-3">
                          <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text block">
                            {stock.symbol}
                          </span>
                          <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted">
                            {stock.name}
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text">
                          {formatINR(stock.currentPrice)}
                        </td>
                        <td className="py-3 text-right tabular-nums">
                          <span className={`inline-flex items-center space-x-0.5 ${
                            stock.dayChange >= 0
                              ? 'text-market-profit dark:text-market-profit-dark font-medium'
                              : 'text-market-loss dark:text-market-loss-dark font-medium'
                          }`}>
                            <span>{stock.dayChange >= 0 ? '▲' : '▼'}</span>
                            <span>{formatPercent(stock.dayChangePercent, false)}</span>
                          </span>
                        </td>
                        <td className="py-3 text-right tabular-nums font-mono text-broadsheet-ink dark:text-broadsheet-dark-text">
                          {stock.currentWeight.toFixed(1)}%
                        </td>
                        <td className="py-3 text-right tabular-nums font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">
                          {stock.optimizedWeight.toFixed(1)}%
                          <span className="block text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted font-normal">
                            {weightDiff > 0 ? `▲ +${weightDiff.toFixed(1)}%` : `▼ ${weightDiff.toFixed(1)}%`}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className={`inline-block px-1.5 py-0.5 text-[10px] uppercase font-mono border ${
                            weightDiff > 2
                              ? 'border-market-profit/40 text-market-profit dark:text-market-profit-dark'
                              : weightDiff < -2
                              ? 'border-market-loss/40 text-market-loss dark:text-market-loss-dark'
                              : 'border-broadsheet-rule text-broadsheet-muted'
                          }`}>
                            {weightDiff > 2 ? 'Accumulate' : weightDiff < -2 ? 'Trim' : 'Hold'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Smart Friend Portfolio Note */}
            <div className="mt-4 p-3 border-l-2 border-broadsheet-terracotta dark:border-broadsheet-dark-brass bg-broadsheet-cream/60 dark:bg-broadsheet-dark-bg/60 text-xs font-sans text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80">
              <strong>Smart Observation:</strong> Your current portfolio is overweighted in Reliance (35%) and underweighted in TCS (22.3%). Because TCS has a low covariance (0.28) with Reliance&apos;s oil-to-chemicals cycle, shifting 8.5% capital to TCS lowers overall portfolio risk by 4.3% without reducing your return.
            </div>
          </div>

          {/* Right: The Hero Efficient Frontier Interactive Chart (5 Cols) */}
          <div id="frontier-preview" className="lg:col-span-5 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-5 sm:p-6 shadow-ledger">
            <div className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
                  Optimal Frontier &amp; Risk Curve
                </h3>
                <span className="text-[11px] font-mono px-1.5 py-0.5 bg-market-profit-bg dark:bg-market-profit/10 text-market-profit dark:text-market-profit-dark border border-market-profit/20 font-medium">
                  Optimal Curve
                </span>
              </div>
              <p className="text-xs font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted mt-1">
                Drag the posture slider to traverse the risk-return curve
              </p>
            </div>

            {/* SVG Efficient Frontier Curve with Draggable Point */}
            <div className="relative bg-broadsheet-cream/50 dark:bg-broadsheet-dark-bg/50 border border-broadsheet-rule dark:border-broadsheet-dark-rule p-3 mb-4">
              
              <svg viewBox="0 0 360 220" className="w-full h-48 overflow-visible">
                {/* Grid Lines */}
                <line x1="40" y1="20" x2="40" y2="180" stroke="#DDD8CE" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="120" y1="20" x2="120" y2="180" stroke="#DDD8CE" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="200" y1="20" x2="200" y2="180" stroke="#DDD8CE" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="280" y1="20" x2="280" y2="180" stroke="#DDD8CE" strokeWidth="1" strokeDasharray="3 3" />
                
                <line x1="40" y1="180" x2="340" y2="180" stroke="#14171A" strokeWidth="1.5" />
                <line x1="40" y1="20" x2="40" y2="180" stroke="#14171A" strokeWidth="1.5" />

                {/* Axis Labels */}
                <text x="330" y="195" fontSize="9" fontFamily="IBM Plex Mono" fill="#6B665E" textAnchor="end">Volatility (σ) →</text>
                <text x="35" y="16" fontSize="9" fontFamily="IBM Plex Mono" fill="#6B665E" textAnchor="start">Expected Return (E[R]) ↑</text>

                {/* Sub-optimal Scatter Points (Monte Carlo simulations) */}
                <circle cx="95" cy="145" r="2.5" fill="#DDD8CE" />
                <circle cx="110" cy="130" r="2.5" fill="#DDD8CE" />
                <circle cx="140" cy="150" r="2.5" fill="#DDD8CE" />
                <circle cx="160" cy="120" r="2.5" fill="#DDD8CE" />
                <circle cx="190" cy="110" r="2.5" fill="#DDD8CE" />
                <circle cx="230" cy="100" r="2.5" fill="#DDD8CE" />
                <circle cx="180" cy="135" r="2.5" fill="#DDD8CE" />
                <circle cx="210" cy="140" r="2.5" fill="#DDD8CE" />

                {/* Sub-optimal current portfolio point */}
                <circle cx="180" cy="115" r="4.5" fill="#B92525" />
                <text x="190" y="118" fontSize="9" fontFamily="IBM Plex Mono" fill="#B92525" fontWeight="bold">Current Portfolio</text>

                {/* The Efficient Frontier Curve Path */}
                {/* Parametric Bezier approximation of risk-return frontier */}
                <path
                  d="M 65 155 Q 90 95, 150 68 T 330 32"
                  fill="none"
                  stroke="#14171A"
                  strokeWidth="2.5"
                />

                {/* Optimal Point (Tangent portfolio / Max Sharpe) */}
                <circle cx="150" cy="68" r="6" fill="#14171A" />
                <circle cx="150" cy="68" r="10" fill="none" stroke="#14171A" strokeWidth="1" strokeDasharray="2 2" />

                {/* Dynamic Slider Selected Point */}
                {/* Map frontierSlider (0-100) along the curve */}
                {(() => {
                  const t = frontierSlider / 100;
                  // Approximate curve positions
                  const cx = 65 + t * 265;
                  const cy = 155 - Math.pow(t, 0.7) * 123;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r="5" fill="#18633F" />
                      <line x1={cx} y1={cy} x2={cx} y2="180" stroke="#18633F" strokeWidth="1" strokeDasharray="2 2" />
                    </g>
                  );
                })()}

                {/* Annotation for Max Sharpe */}
                <text x="156" y="55" fontSize="9" fontFamily="IBM Plex Mono" fill="#14171A" fontWeight="600">
                  Best Sharpe Ratio Here (1.64)
                </text>
              </svg>

              {/* Slider below chart */}
              <div className="mt-3">
                <div className="flex justify-between text-[11px] font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted mb-1">
                  <span>Minimum Variance (11.2% σ)</span>
                  <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">Target: {activeVol}% Volatility</span>
                  <span>Maximum Return (27.2% R)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={frontierSlider}
                  onChange={(e) => setFrontierSlider(Number(e.target.value))}
                  className="w-full accent-broadsheet-terracotta dark:accent-broadsheet-dark-brass cursor-pointer"
                />
              </div>
            </div>

            {/* Slider readout in IBM Plex Mono with tabular-nums */}
            <div className="grid grid-cols-3 gap-2 font-mono text-xs border border-broadsheet-rule dark:border-broadsheet-dark-rule p-3 bg-white dark:bg-broadsheet-dark-paper">
              <div>
                <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted block uppercase">Exp Return</span>
                <span className="text-sm font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text tabular-nums">
                  {activeRet}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted block uppercase">Risk / Vol</span>
                <span className="text-sm font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text tabular-nums">
                  {activeVol}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted block uppercase">Sharpe Ratio</span>
                <span className="text-sm font-semibold text-market-profit dark:text-market-profit-dark tabular-nums">
                  {activeSharpe}
                </span>
              </div>
            </div>

            <p className="mt-3 text-[11px] font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted">
              *Risk-free rate benchmarked to RBI 91-Day Treasury Bill yield (6.50%).
            </p>
          </div>

        </div>
      )}

      {/* STATE 2: LOADING SKELETON */}
      {activeState === 'loading' && (
        <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 sm:p-8 shadow-ledger animate-pulse">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-broadsheet-rule dark:border-broadsheet-dark-rule font-mono text-xs text-broadsheet-terracotta dark:text-broadsheet-dark-brass">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="font-semibold uppercase tracking-wider">
              CONNECTING TO NSE MARKET GATEWAY • FETCHING HISTORICAL OHLCV CANDLES...
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-4">
              <div className="h-6 bg-broadsheet-rule/50 dark:bg-broadsheet-dark-rule/60 w-3/4 rounded-none"></div>
              <div className="h-4 bg-broadsheet-rule/40 dark:bg-broadsheet-dark-rule/40 w-1/2 rounded-none"></div>
              
              <div className="space-y-3 pt-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-broadsheet-cream/70 dark:bg-broadsheet-dark-bg/60 border border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule flex items-center justify-between px-4">
                    <div className="h-4 bg-broadsheet-rule/50 dark:bg-broadsheet-dark-rule/60 w-24"></div>
                    <div className="h-4 bg-broadsheet-rule/50 dark:bg-broadsheet-dark-rule/60 w-16"></div>
                    <div className="h-4 bg-broadsheet-rule/50 dark:bg-broadsheet-dark-rule/60 w-12"></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="h-48 bg-broadsheet-cream/80 dark:bg-broadsheet-dark-bg/60 border border-broadsheet-rule dark:border-broadsheet-dark-rule flex flex-col items-center justify-center p-6 text-center font-mono text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted">
                <span className="block mb-2 font-semibold">CALCULATING COVARIANCE MATRIX</span>
                <span className="text-[11px]">Solving quadratic optimization constraints: sum(w_i) = 1, w_i &gt;= 0</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-16 bg-broadsheet-rule/30 dark:bg-broadsheet-dark-rule/40"></div>
                <div className="h-16 bg-broadsheet-rule/30 dark:bg-broadsheet-dark-rule/40"></div>
                <div className="h-16 bg-broadsheet-rule/30 dark:bg-broadsheet-dark-rule/40"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 3: EMPTY PORTFOLIO */}
      {activeState === 'empty' && (
        <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-ledger">
          <div className="w-12 h-12 mx-auto mb-4 border border-broadsheet-rule dark:border-broadsheet-dark-rule flex items-center justify-center text-broadsheet-terracotta dark:text-broadsheet-dark-brass">
            <PlusCircle className="w-6 h-6" />
          </div>

          <h3 className="font-serif text-2xl sm:text-3xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal mb-2">
            No stocks yet. Add your first one.
          </h3>

          <p className="text-sm font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted mb-6 leading-relaxed">
            Leaving your capital idle in a savings account earns 3% while retail inflation runs at 5.5%. Add at least 2 NSE stocks to begin running Greedy vs 0/1 Knapsack allocation optimization.
          </p>

          <div className="border-t border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/50 pt-5">
            <span className="text-xs font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted uppercase block mb-3">
              Quick-add a benchmark bluechip:
            </span>
            <div className="flex flex-wrap justify-center gap-2 font-mono text-xs">
              <button
                onClick={() => handleAddSampleStock('RELIANCE.NS', 'Reliance Industries Ltd.', 3012.40, 'Energy')}
                className="px-3 py-1.5 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:border-broadsheet-terracotta dark:hover:border-broadsheet-dark-brass text-broadsheet-ink dark:text-broadsheet-dark-text transition-colors flex items-center space-x-1"
              >
                <span>+ RELIANCE</span>
                <span className="text-broadsheet-muted">(₹3,012)</span>
              </button>
              <button
                onClick={() => handleAddSampleStock('TCS.NS', 'Tata Consultancy Services', 4185.30, 'IT')}
                className="px-3 py-1.5 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:border-broadsheet-terracotta dark:hover:border-broadsheet-dark-brass text-broadsheet-ink dark:text-broadsheet-dark-text transition-colors flex items-center space-x-1"
              >
                <span>+ TCS</span>
                <span className="text-broadsheet-muted">(₹4,185)</span>
              </button>
              <button
                onClick={() => handleAddSampleStock('HDFCBANK.NS', 'HDFC Bank Ltd.', 1742.60, 'Banking')}
                className="px-3 py-1.5 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:border-broadsheet-terracotta dark:hover:border-broadsheet-dark-brass text-broadsheet-ink dark:text-broadsheet-dark-text transition-colors flex items-center space-x-1"
              >
                <span>+ HDFC BANK</span>
                <span className="text-broadsheet-muted">(₹1,742)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: MARKET GATEWAY ERROR */}
      {activeState === 'error' && (
        <div className="border-2 border-market-loss dark:border-market-loss-dark bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-8 sm:p-10 max-w-2xl mx-auto shadow-ledger">
          <div className="flex items-start space-x-4">
            <div className="p-2 border border-market-loss dark:border-market-loss-dark text-market-loss dark:text-market-loss-dark mt-0.5">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-market-loss dark:text-market-loss-dark font-semibold block mb-1">
                ERROR CODE: NSE_FEED_TIMEOUT_503
              </span>
              <h3 className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal mb-2">
                Dalal Street Feed Interrupted
              </h3>
              <p className="text-sm font-sans text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 mb-4 leading-relaxed">
                National Stock Exchange market data streams are currently unreachable. This occurs when markets are closed (before 9:15 AM or after 3:30 PM IST, weekends, or trading holidays), or when the provider rate limit is encountered.
              </p>
              
              <div className="bg-broadsheet-cream/70 dark:bg-broadsheet-dark-bg/70 p-3 border border-broadsheet-rule dark:border-broadsheet-dark-rule font-mono text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted mb-5">
                <span className="block font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text mb-1">AUTOMATIC FALLBACK ENGAGED:</span>
                <span>The Ledger has safely switched to the last verified closing snapshot (Friday 15:30 IST). You can still optimize your weights against closing covariance.</span>
              </div>

              <div className="flex items-center space-x-3 font-mono text-xs">
                <button
                  onClick={() => setActiveState('live')}
                  className="px-4 py-2 bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black font-semibold hover:opacity-90 transition-opacity"
                >
                  Continue with Snapshot Data
                </button>
                <button
                  onClick={() => setActiveState('loading')}
                  className="px-4 py-2 border border-broadsheet-rule dark:border-broadsheet-dark-rule text-broadsheet-ink dark:text-broadsheet-dark-text hover:bg-broadsheet-rule-subtle/50 transition-colors"
                >
                  Retry Gateway Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
