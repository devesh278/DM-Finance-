import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, User, RotateCcw, LogOut } from 'lucide-react';

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  user: { email: string; name: string; isDemo?: boolean } | null;
  onLogout: () => void;
  onResetPortfolio?: () => void;
  currentPage: 'landing' | 'dashboard' | 'optimizer' | 'stocks' | 'stock-detail';
  onNavigate: (page: 'landing' | 'dashboard' | 'optimizer' | 'stocks') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  setDarkMode,
  onOpenAuth,
  user,
  onLogout,
  onResetPortfolio,
  currentPage,
  onNavigate,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute initials from user (or "D" for Demo)
  const getInitials = (u: { email: string; name: string; isDemo?: boolean }) => {
    if (u.isDemo) return 'D';
    if (!u.name) return 'U';
    const parts = u.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-cream/95 dark:bg-broadsheet-dark-bg/95 backdrop-blur-sm sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between">
        
        {/* Logo on the left (links home, no 'Optimizer Pro' badge) */}
        <button
          onClick={() => onNavigate('landing')}
          className="text-left group"
        >
          <span className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-broadsheet-ink dark:text-broadsheet-dark-text group-hover:text-broadsheet-terracotta dark:group-hover:text-broadsheet-dark-brass transition-colors">
            D{'&'}M Finance
          </span>
        </button>

        {/* Center/Right Nav: Dashboard, Optimizer, Stocks + Auth & Theme */}
        <div className="flex items-center space-x-4 sm:space-x-6 text-sm font-sans font-medium">
          
          {/* Nav links: Dashboard (only when logged in), Optimizer, Stocks */}
          {user && (
            <button
              onClick={() => onNavigate('dashboard')}
              className={`transition-colors ${
                currentPage === 'dashboard'
                  ? 'text-broadsheet-terracotta dark:text-broadsheet-dark-brass font-semibold'
                  : 'text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass'
              }`}
            >
              Dashboard
            </button>
          )}

          <button
            onClick={() => onNavigate('optimizer')}
            className={`transition-colors ${
              currentPage === 'optimizer'
                ? 'text-broadsheet-terracotta dark:text-broadsheet-dark-brass font-semibold'
                : 'text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass'
            }`}
          >
            Optimizer
          </button>

          <button
            onClick={() => onNavigate('stocks')}
            className={`transition-colors ${
              currentPage === 'stocks' || currentPage === 'stock-detail'
                ? 'text-broadsheet-terracotta dark:text-broadsheet-dark-brass font-semibold'
                : 'text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass'
            }`}
          >
            Stocks
          </button>

          {/* User Auth or Initials Menu */}
          {user ? (
            <div className="relative" ref={menuRef}>
              {/* Initials Circle Button */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-8 h-8 rounded-full border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper hover:border-broadsheet-terracotta dark:hover:border-broadsheet-dark-brass flex items-center justify-center font-mono text-xs font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text transition-colors shadow-sm focus:outline-none"
                title={user.isDemo ? 'Demo Account' : user.name}
                aria-label="User account menu"
              >
                {getInitials(user)}
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 border border-broadsheet-rule dark:border-broadsheet-dark-rule bg-broadsheet-paper dark:bg-broadsheet-dark-paper shadow-ledger py-2 z-50 animate-fade-in font-sans">
                  
                  {/* Account Summary */}
                  <div className="px-4 py-2 border-b border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/60">
                    <p className="text-xs font-semibold text-broadsheet-ink dark:text-broadsheet-dark-text truncate">
                      {user.isDemo ? 'Demo Account' : user.name}
                    </p>
                    <p className="text-[11px] font-mono text-broadsheet-muted dark:text-broadsheet-dark-muted truncate">
                      {user.isDemo ? 'Read-only sample sandbox' : user.email}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate('dashboard');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg text-broadsheet-ink dark:text-broadsheet-dark-text flex items-center space-x-2"
                    >
                      <User className="w-3.5 h-3.5 text-broadsheet-muted" />
                      <span>Account</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onResetPortfolio?.();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg text-broadsheet-ink dark:text-broadsheet-dark-text flex items-center space-x-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-broadsheet-muted" />
                      <span>Reset demo portfolio</span>
                    </button>

                    <div className="my-1 border-t border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/60" />

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-broadsheet-cream/60 dark:hover:bg-broadsheet-dark-bg text-market-loss dark:text-market-loss-dark flex items-center space-x-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>

                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-3 sm:space-x-5">
              <button
                onClick={() => onOpenAuth('signin')}
                className="text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 hover:text-broadsheet-terracotta dark:hover:text-broadsheet-dark-brass transition-colors"
              >
                Log in
              </button>

              <button
                onClick={() => onOpenAuth('signup')}
                className="px-4 py-2 bg-broadsheet-terracotta hover:bg-broadsheet-terracotta-hover dark:bg-broadsheet-dark-brass dark:hover:bg-broadsheet-dark-brass-hover text-white dark:text-black font-medium transition-colors shadow-sm"
              >
                Sign up
              </button>
            </div>
          )}

          {/* Theme Toggle Icon */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Toggle dark mode"
            className="p-1.5 text-broadsheet-ink dark:text-broadsheet-dark-text hover:opacity-75 transition-opacity"
            title={darkMode ? 'Switch to Light' : 'Switch to Dark'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-broadsheet-dark-brass" /> : <Moon className="w-4 h-4 text-broadsheet-ink" />}
          </button>

        </div>

      </div>
    </header>
  );
};
