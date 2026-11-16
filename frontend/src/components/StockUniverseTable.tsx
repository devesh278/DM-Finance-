import React from 'react';
import { formatINR, formatPercent } from '../utils/formatters';
import { ArrowUpRight } from 'lucide-react';

interface BluechipData {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  dayChange: number;
  dayChangePercent: number;
  peRatio: number;
  beta: number;
  yearReturn: number;
  fiftyTwoWeekRange: string;
}

const BLUECHIP_UNIVERSE: BluechipData[] = [
  {
    symbol: 'RELIANCE.NS',
    name: 'Reliance Industries Ltd.',
    sector: 'Energy & Digital',
    price: 3012.40,
    dayChange: 42.15,
    dayChangePercent: 1.42,
    peRatio: 28.4,
    beta: 0.98,
    yearReturn: 24.5,
    fiftyTwoWeekRange: '₹2,220.30 - ₹3,217.90',
  },
  {
    symbol: 'TCS.NS',
    name: 'Tata Consultancy Services Ltd.',
    sector: 'IT Services',
    price: 4185.30,
    dayChange: 58.70,
    dayChangePercent: 1.42,
    peRatio: 31.8,
    beta: 0.72,
    yearReturn: 21.8,
    fiftyTwoWeekRange: '₹3,313.00 - ₹4,592.25',
  },
  {
    symbol: 'HDFCBANK.NS',
    name: 'HDFC Bank Ltd.',
    sector: 'Private Banking',
    price: 1742.60,
    dayChange: -6.40,
    dayChangePercent: -0.37,
    peRatio: 18.6,
    beta: 1.08,
    yearReturn: 14.2,
    fiftyTwoWeekRange: '₹1,363.55 - ₹1,794.00',
  },
  {
    symbol: 'INFY.NS',
    name: 'Infosys Ltd.',
    sector: 'IT Services',
    price: 1895.80,
    dayChange: 14.20,
    dayChangePercent: 0.75,
    peRatio: 29.1,
    beta: 0.85,
    yearReturn: 28.4,
    fiftyTwoWeekRange: '₹1,351.65 - ₹1,991.45',
  },
  {
    symbol: 'ITC.NS',
    name: 'ITC Ltd.',
    sector: 'FMCG & Agri',
    price: 468.90,
    dayChange: 2.10,
    dayChangePercent: 0.45,
    peRatio: 26.2,
    beta: 0.58,
    yearReturn: 12.6,
    fiftyTwoWeekRange: '₹399.30 - ₹510.65',
  },
];

export const StockUniverseTable: React.FC = () => {
  return (
    <section id="universe-table" className="py-14 px-4 sm:px-8 max-w-7xl mx-auto border-b border-broadsheet-rule dark:border-broadsheet-dark-rule">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-broadsheet-rule dark:border-broadsheet-dark-rule">
        <div>
          <span className="text-xs font-mono tracking-widest text-broadsheet-terracotta dark:text-broadsheet-dark-brass uppercase block mb-1">
            Section IV • Dalal Street Bluechips
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
            Constituents Universe
          </h2>
          <p className="mt-1 text-sm font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted max-w-xl">
            Live prices and quantitative risk characteristics of the foundational Indian assets used in the demo.
          </p>
        </div>
        <div className="mt-4 md:mt-0 font-mono text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted">
          <span>SOURCE: NSE LIVE FEEDS (.NS SUFFIX)</span>
        </div>
      </div>

      <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper shadow-ledger overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule text-[11px] uppercase text-broadsheet-muted dark:text-broadsheet-dark-muted bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg/40">
              <th className="py-3 px-4 font-medium">Symbol &amp; Company</th>
              <th className="py-3 px-4 font-medium text-right">LTP (₹)</th>
              <th className="py-3 px-4 font-medium text-right">Day P&amp;L</th>
              <th className="py-3 px-4 font-medium text-right">1-Yr Return</th>
              <th className="py-3 px-4 font-medium text-right">Beta (β)</th>
              <th className="py-3 px-4 font-medium text-right">P/E Ratio</th>
              <th className="py-3 px-4 font-medium text-right hidden sm:table-cell">52W Range</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/40">
            {BLUECHIP_UNIVERSE.map((stock) => (
              <tr key={stock.symbol} className="hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg/50 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">
                      {stock.symbol}
                    </span>
                    <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted hidden md:inline">
                      ({stock.sector})
                    </span>
                  </div>
                  <span className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted block">
                    {stock.name}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right font-medium tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text">
                  {formatINR(stock.price)}
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums">
                  <span className={`inline-flex items-center space-x-0.5 ${
                    stock.dayChange >= 0
                      ? 'text-market-profit dark:text-market-profit-dark font-medium'
                      : 'text-market-loss dark:text-market-loss-dark font-medium'
                  }`}>
                    <span>{stock.dayChange >= 0 ? '▲' : '▼'}</span>
                    <span>{formatPercent(stock.dayChangePercent, false)}</span>
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-market-profit dark:text-market-profit-dark">
                  ▲ +{stock.yearReturn.toFixed(1)}%
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text">
                  {stock.beta.toFixed(2)}
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums text-broadsheet-ink dark:text-broadsheet-dark-text">
                  {stock.peRatio.toFixed(1)}x
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums text-broadsheet-muted dark:text-broadsheet-dark-muted hidden sm:table-cell text-[11px]">
                  {stock.fiftyTwoWeekRange}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
