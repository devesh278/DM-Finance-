import React from 'react';
import { Cpu, GitCommit, Scale, Zap } from 'lucide-react';

export const AlgorithmExplainer: React.FC = () => {
  return (
    <section id="math-foundation" className="py-14 px-4 sm:px-8 max-w-7xl mx-auto border-b border-broadsheet-rule dark:border-broadsheet-dark-rule">
      <div className="flex items-center space-x-2 text-xs font-mono tracking-widest text-broadsheet-muted dark:text-broadsheet-dark-muted uppercase mb-3">
        <span>Section III • Algorithmic Foundations</span>
        <span>/</span>
        <span>Greedy Heuristic vs. 0/1 Knapsack Dynamic Programming</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 5 Cols: Editorial Essay */}
        <div className="lg:col-span-5">
          <h2 className="font-serif text-3xl sm:text-4xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal leading-tight mb-4">
            Stock picking is guesswork. <br />
            <span className="italic font-serif text-broadsheet-ink dark:text-broadsheet-dark-text">
              Discrete optimization is pure mathematics.
            </span>
          </h2>

          <p className="text-sm font-sans text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 leading-relaxed mb-4">
            In modern financial engineering, capital allocation across indivisible lots of stocks maps directly to the classic <strong>0/1 Knapsack Problem</strong>: given a finite capital budget $W$, which subset of stocks yields the maximum risk-adjusted rupee profit without exceeding your budget?
          </p>

          <p className="text-sm font-sans text-broadsheet-muted dark:text-broadsheet-dark-muted leading-relaxed mb-6">
            We evaluate both the ultra-fast <strong>Greedy Heuristic</strong> ($O(n \log n)$) and the exact <strong>Dynamic Programming algorithm</strong> ($O(n \cdot W)$). While Greedy picks stocks with the highest value-per-rupee ratio, 0/1 Knapsack checks every allowable combinatorial state to guarantee the global optimum.
          </p>

          <div className="border-t border-broadsheet-rule dark:border-broadsheet-dark-rule pt-4 font-mono text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted space-y-2">
            <div className="flex items-start space-x-2">
              <span className="text-broadsheet-ink dark:text-broadsheet-dark-text font-bold">1.</span>
              <span><strong>Item Weight (w_i):</strong> Market cost of 1 whole lot of the NSE stock.</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-broadsheet-ink dark:text-broadsheet-dark-text font-bold">2.</span>
              <span><strong>Item Value (v_i):</strong> Risk-adjusted expected profit based on historical return, volatility, and your risk slider.</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-broadsheet-ink dark:text-broadsheet-dark-text font-bold">3.</span>
              <span><strong>Capacity (W):</strong> Your exact investment budget in Indian Rupees (₹).</span>
            </div>
          </div>
        </div>

        {/* Right 7 Cols: The Algorithmic Formulation & Correlation Matrix */}
        <div className="lg:col-span-7 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper p-6 shadow-ledger">
          
          <div className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-3 mb-5 flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text uppercase">
              NSE BLUECHIP CO-MOVEMENT &amp; CORRELATION MATRIX (r_ij)
            </span>
            <span className="text-broadsheet-muted dark:text-broadsheet-dark-muted">
              RANGE: -1.00 (INVERSE) TO +1.00 (IDENTICAL)
            </span>
          </div>

          {/* Real NSE Correlation Matrix Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-center font-mono text-xs">
              <thead>
                <tr className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted">
                  <th className="text-left pb-2 font-medium">ASSET</th>
                  <th className="pb-2 font-medium">RELIANCE</th>
                  <th className="pb-2 font-medium">TCS</th>
                  <th className="pb-2 font-medium">HDFCBANK</th>
                  <th className="pb-2 font-medium">INFY</th>
                  <th className="pb-2 font-medium">ITC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-broadsheet-rule-subtle dark:divide-broadsheet-dark-rule/30">
                <tr>
                  <td className="text-left py-2 font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">RELIANCE</td>
                  <td className="py-2 bg-broadsheet-rule-subtle/50 dark:bg-broadsheet-dark-bg font-bold">1.00</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.24</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.42</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.21</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.18</td>
                </tr>
                <tr>
                  <td className="text-left py-2 font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">TCS</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.24</td>
                  <td className="py-2 bg-broadsheet-rule-subtle/50 dark:bg-broadsheet-dark-bg font-bold">1.00</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.19</td>
                  <td className="py-2 text-market-loss dark:text-market-loss-dark font-medium" title="High co-movement">0.78</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.12</td>
                </tr>
                <tr>
                  <td className="text-left py-2 font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">HDFCBANK</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.42</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.19</td>
                  <td className="py-2 bg-broadsheet-rule-subtle/50 dark:bg-broadsheet-dark-bg font-bold">1.00</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.26</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.28</td>
                </tr>
                <tr>
                  <td className="text-left py-2 font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">INFY</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.21</td>
                  <td className="py-2 text-market-loss dark:text-market-loss-dark font-medium">0.78</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.26</td>
                  <td className="py-2 bg-broadsheet-rule-subtle/50 dark:bg-broadsheet-dark-bg font-bold">1.00</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.15</td>
                </tr>
                <tr>
                  <td className="text-left py-2 font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text">ITC</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.18</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.12</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.28</td>
                  <td className="py-2 text-broadsheet-ink dark:text-broadsheet-dark-text">0.15</td>
                  <td className="py-2 bg-broadsheet-rule-subtle/50 dark:bg-broadsheet-dark-bg font-bold">1.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mathematical Takeaway */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg/40">
              <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted block uppercase">Greedy Heuristic</span>
              <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text block mt-1">O(n log n) Speed</span>
              <span className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted mt-1 block font-sans">
                Fast sorting by return/rupee. Can get trapped leaving unused cash.
              </span>
            </div>

            <div className="p-3 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg/40">
              <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted block uppercase">0/1 Knapsack DP</span>
              <span className="font-semibold text-market-profit dark:text-market-profit-dark block mt-1">O(n · W) Optimum</span>
              <span className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted mt-1 block font-sans">
                Dynamic programming table. Evaluates all combinations for maximum profit.
              </span>
            </div>

            <div className="p-3 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg/40">
              <span className="text-[10px] text-broadsheet-muted dark:text-broadsheet-dark-muted block uppercase">The Solution</span>
              <span className="font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text block mt-1">Dual Comparison Duel</span>
              <span className="text-[11px] text-broadsheet-muted dark:text-broadsheet-dark-muted mt-1 block font-sans">
                We run both algorithms on the exact same budget and show the winner side-by-side.
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
