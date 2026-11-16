import React, { useState } from 'react';
import { ArrowRight, Sliders, ShieldCheck, Zap } from 'lucide-react';
import { formatINR, formatPercent } from '../utils/formatters';
import { DEMO_PORTFOLIO_SUMMARY, DEMO_STOCKS } from '../data/mockPortfolio';

interface HeroSectionProps {
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onExploreDemo: () => void;
  onNavigateToDashboard?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenAuth, onExploreDemo, onNavigateToDashboard }) => {
  // Mini interactive state right in hero
  const [selectedRisk, setSelectedRisk] = useState<'low' | 'balanced' | 'aggressive'>('balanced');

  // Multipliers based on selected risk profile
  const riskMetrics = {
    low: { returnVal: 15.4, volVal: 11.2, sharpe: 1.38, label: 'Capital Preservation' },
    balanced: { returnVal: 20.2, volVal: 14.1, sharpe: 1.64, label: 'Max Sharpe (Optimal)' },
    aggressive: { returnVal: 24.8, volVal: 19.8, sharpe: 1.25, label: 'Maximum Capital Growth' },
  }[selectedRisk];

  return (
    <section className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pt-8 pb-14 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Editorial Category & Timestamp */}
      <div className="flex items-center space-x-2 text-xs font-mono tracking-widest text-broadsheet-terracotta dark:text-broadsheet-dark-brass uppercase mb-4">
        <span>Volume XLII • Portfolio Mathematics</span>
        <span>/</span>
        <span>Greedy &amp; 0/1 Knapsack Optimization Protocols</span>
      </div>

      {/* Main Asymmetric Grid (65% Left / 35% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* Left Column (Editorial Broadside Story) */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal leading-[1.08] tracking-tight text-broadsheet-ink dark:text-broadsheet-dark-text mb-6">
              Most Indian retail portfolios don&apos;t beat fixed deposits after inflation. <br />
              <span className="italic font-serif text-broadsheet-terracotta dark:text-broadsheet-dark-brass">The math explains why.</span>
            </h1>

            <p className="text-base sm:text-lg font-sans text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 leading-relaxed max-w-2xl mb-6">
              True diversification isn&apos;t buying 25 random small-caps on telegram tips. It&apos;s balancing non-correlated assets so one bad quarter at Infosys doesn&apos;t erase your hard-won gains from Reliance.
            </p>

            <p className="text-sm sm:text-base font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted leading-relaxed max-w-2xl mb-8">
              We apply algorithmic capital allocation—comparing a fast Greedy heuristic against exact 0/1 Knapsack dynamic programming—to your NSE &amp; BSE holdings. Instead of guessing how many shares to buy, you receive exact mathematically calculated selections designed to maximize risk-adjusted profit within your specific capital budget.
            </p>
          </div>

          {/* Direct CTA Group */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <button
              onClick={onNavigateToDashboard || (() => onOpenAuth('signup'))}
              className="px-6 py-3.5 bg-broadsheet-terracotta hover:bg-broadsheet-terracotta-hover dark:bg-broadsheet-dark-brass dark:hover:bg-broadsheet-dark-brass-hover text-white dark:text-black font-sans font-medium text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm"
            >
              <span>Open Portfolio Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onExploreDemo}
              className="px-5 py-3.5 border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:border-broadsheet-ink dark:hover:border-broadsheet-dark-text bg-transparent text-broadsheet-ink dark:text-broadsheet-dark-text font-sans font-medium text-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>Inspect Section Demo</span>
            </button>
          </div>

          {/* Mathematical Proof Badges */}
          <div className="grid grid-cols-3 gap-4 border-t border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/50 mt-10 pt-6 font-mono text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted">
            <div>
              <span className="block text-broadsheet-ink dark:text-broadsheet-dark-text font-bold text-sm">₹0 Brokered Fees</span>
              <span className="text-[11px]">Unbiased pure math</span>
            </div>
            <div>
              <span className="block text-broadsheet-ink dark:text-broadsheet-dark-text font-bold text-sm">2,200+ NSE Stocks</span>
              <span className="text-[11px]">Real-time lot pricing</span>
            </div>
            <div>
              <span className="block text-broadsheet-ink dark:text-broadsheet-dark-text font-bold text-sm">Dual Algo Engine</span>
              <span className="text-[11px]">Greedy vs 0/1 Knapsack</span>
            </div>
          </div>
        </div>

        {/* Right Column: The Ledger Balance Sheet Card (Focal Point Number) */}
        <div className="lg:col-span-5">
          <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 sm:p-7 shadow-ledger">
            
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-3.5 mb-5 font-mono text-xs">
              <div className="flex items-center space-x-2">
                <span className="inline-block w-2 h-2 rounded-full bg-market-profit dark:bg-market-profit-dark animate-pulse"></span>
                <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text uppercase">
                  DEMO PORTFOLIO LEDGER
                </span>
              </div>
              <span className="text-broadsheet-muted dark:text-broadsheet-dark-muted">
                5 NIFTY BLUECHIPS
              </span>
            </div>

            {/* FOCAL POINT NUMBER: Today's P&L */}
            <div className="mb-6">
              <span className="text-xs font-mono uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted block mb-1">
                Today&apos;s Net P&amp;L
              </span>
              <div className="flex items-baseline space-x-3">
                <span className="font-mono text-4xl sm:text-5xl font-semibold tracking-tight text-market-profit dark:text-market-profit-dark tabular-nums">
                  +{formatINR(DEMO_PORTFOLIO_SUMMARY.todayPnL, false)}
                </span>
                <span className="font-mono text-sm font-medium text-market-profit dark:text-market-profit-dark tabular-nums">
                  ▲ {formatPercent(DEMO_PORTFOLIO_SUMMARY.todayPnLPercent, false)}
                </span>
              </div>
              <p className="mt-2 text-xs font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted italic">
                Your portfolio is up ₹19,182 today. Reliance and TCS did most of the heavy lifting.
              </p>
            </div>

            {/* Total Value & Invested Stats */}
            <div className="grid grid-cols-2 gap-4 py-3 border-y border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/60 mb-5 font-mono">
              <div>
                <span className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted uppercase block">Total Portfolio Value</span>
                <span className="text-lg font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text tabular-nums">
                  {formatINR(DEMO_PORTFOLIO_SUMMARY.totalValue, false)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted uppercase block">Total Unrealized Gains</span>
                <span className="text-lg font-semibold text-market-profit dark:text-market-profit-dark tabular-nums">
                  +{formatINR(DEMO_PORTFOLIO_SUMMARY.totalPnL, false)}
                </span>
              </div>
            </div>

            {/* Algorithmic Rebalancing Suggestion (Live Preview) */}
            <div className="mb-5 bg-broadsheet-cream/60 dark:bg-broadsheet-dark-bg/60 p-3.5 border border-broadsheet-rule dark:border-broadsheet-dark-rule">
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text flex items-center space-x-1.5">
                  <Sliders className="w-3.5 h-3.5 text-broadsheet-muted dark:text-broadsheet-dark-muted" />
                  <span>Target Frontier Posture</span>
                </span>
                <span className="text-broadsheet-ink dark:text-broadsheet-dark-text font-medium">
                  {riskMetrics.label}
                </span>
              </div>

              {/* Risk buttons */}
              <div className="grid grid-cols-3 gap-1.5 mb-3 font-mono text-[11px]">
                {(['low', 'balanced', 'aggressive'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRisk(r)}
                    className={`py-1.5 border text-center transition-all ${
                      selectedRisk === r
                        ? 'border-broadsheet-terracotta bg-broadsheet-terracotta text-white dark:border-broadsheet-dark-brass dark:bg-broadsheet-dark-brass dark:text-black font-semibold'
                        : 'border-broadsheet-rule dark:border-broadsheet-dark-rule text-broadsheet-muted dark:text-broadsheet-dark-muted hover:border-broadsheet-ink dark:hover:border-broadsheet-dark-text'
                    }`}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Frontier Impact Preview */}
              <div className="grid grid-cols-3 gap-2 font-mono text-xs border-t border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/40 pt-2.5">
                <div>
                  <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted block">Exp. Return</span>
                  <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text tabular-nums">
                    {riskMetrics.returnVal}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted block">Volatility</span>
                  <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text tabular-nums">
                    {riskMetrics.volVal}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted block">Sharpe Ratio</span>
                  <span className="font-semibold text-market-profit dark:text-market-profit-dark tabular-nums">
                    {riskMetrics.sharpe}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick mini-allocation bar */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted mb-1.5">
                <span>Optimized Stock Distribution</span>
                <span>5 Assets Weighted</span>
              </div>
              <div className="h-2 w-full flex overflow-hidden border border-broadsheet-rule dark:border-broadsheet-dark-rule">
                <div style={{ width: '26.5%' }} className="bg-[#2D3748] dark:bg-[#718096]" title="Reliance (26.5%)" />
                <div style={{ width: '31.0%' }} className="bg-[#4A5568] dark:bg-[#A0AEC0]" title="TCS (31.0%)" />
                <div style={{ width: '14.5%' }} className="bg-[#718096] dark:bg-[#CBD5E0]" title="HDFC Bank (14.5%)" />
                <div style={{ width: '8.0%' }} className="bg-[#A0AEC0] dark:bg-[#E2E8F0]" title="Infosys (8.0%)" />
                <div style={{ width: '20.0%' }} className="bg-[#CBD5E0] dark:bg-[#F7FAFC]" title="ITC (20.0%)" />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted mt-1.5">
                <span>TCS: 31%</span>
                <span>RELIANCE: 26.5%</span>
                <span>ITC: 20%</span>
                <span>HDFC: 14.5%</span>
                <span>INFY: 8%</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
