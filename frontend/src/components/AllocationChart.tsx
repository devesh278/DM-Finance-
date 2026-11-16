import React, { useState } from 'react';
import { StockHolding } from '../data/mockPortfolio';
import { formatINR } from '../utils/formatters';

interface AllocationChartProps {
  holdings: StockHolding[];
  totalValue: number;
  onNavigateToOptimizer?: () => void;
}

export const AllocationChart: React.FC<AllocationChartProps> = ({
  holdings,
  totalValue,
  onNavigateToOptimizer,
}) => {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  if (holdings.length === 0) {
    return (
      <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 text-center font-sans text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted">
        No holdings to map. Add stocks to view asset allocation.
      </div>
    );
  }

  // Broadsheet slate/graphite palette for donut slices (neutral, no accent, no green/red)
  const sliceColors = [
    '#1A202C', // Deep Slate
    '#3B4654', // Dark Charcoal
    '#5C6878', // Medium Slate
    '#7D8B9B', // Neutral Stone
    '#A0AEC0', // Light Slate
    '#CBD5E0', // Pale Zinc
  ];

  // SVG Donut chart calculation
  let cumulativeAngle = 0;
  const radius = 54;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;

  const slices = holdings.map((h, i) => {
    const val = h.shares * h.currentPrice;
    const pct = totalValue > 0 ? val / totalValue : 0;
    const strokeDasharray = `${pct * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeAngle * circumference;
    cumulativeAngle += pct;

    // Display short name (e.g. "Reliance", "TCS", "HDFC Bank")
    const shortName = h.name.split(' ')[0] === 'Tata'
      ? 'TCS'
      : h.name.split(' ')[0] === 'HDFC'
      ? 'HDFC Bank'
      : h.name.split(' ')[0];

    return {
      stock: h,
      shortName,
      percent: pct * 100,
      value: val,
      color: sliceColors[i % sliceColors.length],
      strokeDasharray,
      strokeDashoffset,
    };
  });

  // Largest holding calculation for the neutral sentence
  const sortedByWeight = [...slices].sort((a, b) => b.percent - a.percent);
  const largest = sortedByWeight[0];

  const activeHolding = hoveredSymbol
    ? slices.find((s) => s.stock.symbol === hoveredSymbol)
    : largest;

  return (
    <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 shadow-ledger flex flex-col justify-between h-full">
      <div>
        {/* Card Header: One small label */}
        <div className="flex items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-2.5 mb-5">
          <span className="text-xs uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted font-medium">
            Allocation
          </span>
          <span className="text-[11px] font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted">
            Sample data
          </span>
        </div>

        {/* Donut Chart & Simple Legend (Name + %) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-4">
          
          {/* SVG Donut */}
          <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 140 140">
              {/* Background ring track */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke="#E2DDD5"
                strokeWidth={strokeWidth}
                className="dark:stroke-broadsheet-dark-rule/60"
              />
              {/* Slices */}
              {slices.map((slice) => (
                <circle
                  key={slice.stock.symbol}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={hoveredSymbol === slice.stock.symbol ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={slice.strokeDasharray}
                  strokeDashoffset={slice.strokeDashoffset}
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHoveredSymbol(slice.stock.symbol)}
                  onMouseLeave={() => setHoveredSymbol(null)}
                />
              ))}
            </svg>

            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center font-mono pointer-events-none px-2">
              <span className="text-[10px] uppercase text-broadsheet-muted dark:text-broadsheet-dark-muted tracking-tight truncate max-w-[80px]">
                {activeHolding ? activeHolding.shortName : 'Total'}
              </span>
              <span className="text-xs font-bold text-broadsheet-ink dark:text-broadsheet-dark-text tabular-nums">
                {activeHolding ? `${activeHolding.percent.toFixed(1)}%` : formatINR(totalValue, false)}
              </span>
            </div>
          </div>

          {/* Simple Legend: Name + % */}
          <div className="w-full max-w-[180px] space-y-2 text-xs">
            {slices.map((slice) => (
              <div
                key={slice.stock.symbol}
                onMouseEnter={() => setHoveredSymbol(slice.stock.symbol)}
                onMouseLeave={() => setHoveredSymbol(null)}
                className={`flex items-center justify-between py-0.5 px-1 rounded transition-colors cursor-pointer ${
                  hoveredSymbol === slice.stock.symbol
                    ? 'bg-broadsheet-cream/80 dark:bg-broadsheet-dark-bg font-semibold'
                    : 'text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate">{slice.shortName}</span>
                </div>
                <span className="font-mono tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text ml-2">
                  {slice.percent.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ONE Neutral Sentence & Try the optimizer link */}
      <div className="pt-4 mt-4 border-t border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <p className="text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80">
          {largest ? `${largest.shortName} is your largest position at ${largest.percent.toFixed(1)}%.` : ''}
        </p>

        {onNavigateToOptimizer && (
          <button
            type="button"
            onClick={onNavigateToOptimizer}
            className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline flex items-center space-x-1 font-medium flex-shrink-0"
          >
            <span>Try the optimizer</span>
            <span>→</span>
          </button>
        )}
      </div>

    </div>
  );
};
