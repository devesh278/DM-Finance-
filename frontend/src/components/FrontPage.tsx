import React from 'react';
import { Footer } from './Footer';

interface FrontPageProps {
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onNavigate: (page: 'landing' | 'dashboard' | 'optimizer' | 'stocks') => void;
}

export const FrontPage: React.FC<FrontPageProps> = ({ onOpenAuth, onNavigate }) => {
  return (
    <div className="animate-fade-in font-sans">
      
      {/* 2. HERO (Two Columns, generous whitespace) */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto border-b border-broadsheet-rule dark:border-broadsheet-dark-rule">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Eyebrow, Headline, Paragraph, Actions */}
          <div className="lg:col-span-7 space-y-6">
            <span className="text-xs uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted font-medium">
              Indian Portfolio Optimizer
            </span>

            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal leading-[1.1] text-broadsheet-ink dark:text-broadsheet-dark-text tracking-tight">
              Does your stock portfolio actually beat fixed deposits after inflation?
            </h1>

            <p className="text-base sm:text-lg text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 leading-relaxed max-w-xl">
              Instead of guessing which shares to buy, test mathematical capital allocation on real NSE stocks. Run a fast greedy heuristic against exact dynamic programming to see which strategy yields higher risk-adjusted return for your rupee budget.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="px-6 py-3 bg-broadsheet-terracotta hover:bg-broadsheet-terracotta-hover dark:bg-broadsheet-dark-brass dark:hover:bg-broadsheet-dark-brass-hover text-white dark:text-black font-sans font-medium text-sm transition-colors shadow-sm"
              >
                Sign up free
              </button>

              <a
                href="#how-it-works"
                className="text-sm font-sans font-medium text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline flex items-center space-x-1"
              >
                <span>See how it works</span>
                <span>→</span>
              </a>
            </div>
          </div>

          {/* Right Column: One Simple Card (Today's P&L Focal Point) */}
          <div className="lg:col-span-5">
            <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-7 shadow-ledger">
              
              <div className="flex items-center justify-between border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-3 mb-5">
                <span className="text-xs uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted font-medium">
                  Today&apos;s P&amp;L
                </span>
                <span className="text-[11px] font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted">
                  Sample data
                </span>
              </div>

              {/* Big Focal Number */}
              <div className="mb-4">
                <div className="flex items-baseline space-x-3">
                  <span className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-market-profit dark:text-market-profit-dark tabular-nums">
                    +₹19,182
                  </span>
                  <span className="font-mono text-sm font-semibold text-market-profit dark:text-market-profit-dark tabular-nums">
                    ▲ +0.95%
                  </span>
                </div>
                <p className="mt-2 text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted leading-relaxed">
                  Reliance and TCS drove most of today&apos;s gains; HDFC Bank was flat.
                </p>
              </div>

              {/* Thin Allocation Bar (Percentages derived from shared DEMO_STOCKS) */}
              <div className="pt-2">
                <div className="h-1.5 w-full flex overflow-hidden border border-broadsheet-rule dark:border-broadsheet-dark-rule">
                  <div style={{ width: '35.5%' }} className="bg-[#1A202C] dark:bg-[#718096]" title="Reliance (35.5%)" />
                  <div style={{ width: '22.6%' }} className="bg-[#3B4654] dark:bg-[#A0AEC0]" title="TCS (22.6%)" />
                  <div style={{ width: '18.8%' }} className="bg-[#5C6878] dark:bg-[#CBD5E0]" title="HDFC Bank (18.8%)" />
                  <div style={{ width: '12.1%' }} className="bg-[#7D8B9B] dark:bg-[#E2E8F0]" title="Infosys (12.1%)" />
                  <div style={{ width: '11.0%' }} className="bg-[#A0AEC0] dark:bg-[#F7FAFC]" title="ITC (11.0%)" />
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 3. ONE SHORT SECTION: "Two ways to pick your stocks" */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto border-b border-broadsheet-rule dark:border-broadsheet-dark-rule">
        <div className="max-w-3xl mb-10">
          <span className="text-xs uppercase tracking-wider text-broadsheet-muted dark:text-broadsheet-dark-muted font-medium block mb-2">
            Algorithm Comparison
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal">
            Two ways to pick your stocks
          </h2>
        </div>

        {/* Two side-by-side columns: Greedy and 0/1 Knapsack */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          
          {/* Column 1: Greedy */}
          <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 shadow-sm">
            <h3 className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal mb-2">
              Greedy
            </h3>
            <p className="text-sm text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 mb-4 leading-relaxed">
              Ranks every stock by expected return per rupee and picks the highest-value lots first.
            </p>
            <div className="text-xs font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted pt-3 border-t border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/60">
              <span>Sample data: Picked 3 stocks, ₹1,02,400 used</span>
            </div>
          </div>

          {/* Column 2: 0/1 Knapsack */}
          <div className="border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 shadow-sm">
            <h3 className="font-serif text-2xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal mb-2">
              0/1 Knapsack
            </h3>
            <p className="text-sm text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 mb-4 leading-relaxed">
              Evaluates every possible combination within your budget to find the global mathematical optimum.
            </p>
            <div className="text-xs font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted pt-3 border-t border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/60">
              <span>Sample data: Picked 4 stocks, ₹1,08,200 used</span>
            </div>
          </div>

        </div>

        {/* Closing Verdict Line & Link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <p className="text-base text-broadsheet-ink dark:text-broadsheet-dark-text">
            Both run on your budget. You see which one wins.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('optimizer')}
            className="text-sm font-sans font-medium text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline flex items-center space-x-1"
          >
            <span>Try the optimizer</span>
            <span>→</span>
          </button>
        </div>
      </section>

      {/* 4. SHARED FOOTER COMPONENT */}
      <Footer onNavigate={onNavigate} />

    </div>
  );
};
