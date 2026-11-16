import React from 'react';

interface FooterProps {
  onNavigate?: (page: 'landing' | 'dashboard' | 'optimizer' | 'stocks') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="py-12 px-4 sm:px-8 max-w-6xl mx-auto w-full transition-colors duration-200">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/60">
        <div>
          <button
            onClick={() => onNavigate?.('landing')}
            className="text-left font-serif text-2xl font-normal text-broadsheet-ink dark:text-broadsheet-dark-text hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass transition-colors block"
          >
            D{'&'}M Finance
          </button>
        </div>

        {/* 3 Links: Dashboard, Optimizer, Stocks */}
        <div className="flex items-center space-x-6 text-sm font-sans">
          <button
            type="button"
            onClick={() => onNavigate?.('dashboard')}
            className="text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass transition-colors"
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('optimizer')}
            className="text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass transition-colors"
          >
            Optimizer
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('stocks')}
            className="text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass transition-colors"
          >
            Stocks
          </button>
        </div>
      </div>

      {/* Footer Notices & Copyright */}
      <div className="pt-4 text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted space-y-0.5 font-sans">
        <p>© 2026 D{'&'}M Finance</p>
        <p>Educational tool, not investment advice. Not registered with SEBI.</p>
        <p>Market data may be delayed.</p>
      </div>
    </footer>
  );
};
