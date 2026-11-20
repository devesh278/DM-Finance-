import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { FrontPage } from './components/FrontPage';
import { Dashboard } from './components/Dashboard';
import { PortfolioOptimizer } from './components/PortfolioOptimizer';
import { StocksPage } from './components/StocksPage';
import { StockDetailPage } from './components/StockDetailPage';
import { AuthModal, UserProfile } from './components/AuthModal';
import { AddStockModal, SearchableStock } from './components/AddStockModal';
import { Footer } from './components/Footer';
import { DEMO_STOCKS, StockHolding } from './data/mockPortfolio';
import { StockItem } from './types/stocks';
import { apiFetch } from './utils/apiClient';

interface ToastAction {
  message: string;
  actionText?: string;
  onAction?: () => void;
}

function parseRouteFromUrl(): {
  page: 'landing' | 'dashboard' | 'optimizer' | 'stocks' | 'stock-detail';
  symbol?: string;
} {
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);
  const next = search.get('next');
  const pageParam = search.get('page');

  if (next === '/dashboard' || path === '/dashboard' || pageParam === 'dashboard') {
    return { page: 'dashboard' };
  }
  if (path === '/optimizer' || pageParam === 'optimizer') {
    return { page: 'optimizer' };
  }
  if (path.startsWith('/stocks/')) {
    const sym = path.slice('/stocks/'.length).trim();
    if (sym) {
      return { page: 'stock-detail', symbol: sym.toUpperCase().replace(/\.NS$/, '') };
    }
  }
  if (path === '/stocks' || pageParam === 'stocks') {
    return { page: 'stocks' };
  }
  return { page: 'landing' };
}

export function App() {
  const [currentPage, setCurrentPage] = useState<'landing' | 'dashboard' | 'optimizer' | 'stocks' | 'stock-detail'>('landing');
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('dalal_dark_mode');
    return saved ? JSON.parse(saved) : false;
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authCustomNotice, setAuthCustomNotice] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [pendingStarSymbol, setPendingStarSymbol] = useState<string | null>(null);

  const [addStockModalOpen, setAddStockModalOpen] = useState<boolean>(false);
  const [initialStockForModal, setInitialStockForModal] = useState<SearchableStock | null>(null);

  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const savedUser = localStorage.getItem('dalal_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [toast, setToast] = useState<ToastAction | null>(null);

  // Sync dark mode class with <html> element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dalal_dark_mode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Synchronize browser tab <title> dynamically with current page
  useEffect(() => {
    switch (currentPage) {
      case 'dashboard':
        document.title = 'Dashboard | D&M Finance';
        break;
      case 'optimizer':
        document.title = 'Optimizer | D&M Finance';
        break;
      case 'stocks':
        document.title = 'Stocks | D&M Finance';
        break;
      case 'stock-detail':
        document.title = selectedStockSymbol ? `${selectedStockSymbol} | D&M Finance` : 'Stocks | D&M Finance';
        break;
      default:
        document.title = 'D&M Finance — Quantitative Portfolio Optimization for NSE & BSE';
        break;
    }
  }, [currentPage, selectedStockSymbol]);

  // Initial Auth Check & URL Navigation Check on Mount
  useEffect(() => {
    const initialRoute = parseRouteFromUrl();

    if (initialRoute.page === 'dashboard') {
      setNextUrl('/dashboard');
    }

    // Verify session with backend cookie
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          localStorage.setItem('dalal_user', JSON.stringify(data.user));

          if (initialRoute.page === 'dashboard') {
            setCurrentPage('dashboard');
          } else if (initialRoute.page === 'optimizer') {
            setCurrentPage('optimizer');
          } else if (initialRoute.page === 'stock-detail' && initialRoute.symbol) {
            setSelectedStockSymbol(initialRoute.symbol);
            setCurrentPage('stock-detail');
          } else if (initialRoute.page === 'stocks') {
            setCurrentPage('stocks');
          } else {
            setCurrentPage('landing');
          }
        } else {
          // Logged out / unauthenticated
          setCurrentUser(null);
          localStorage.removeItem('dalal_user');

          if (initialRoute.page === 'dashboard') {
            setCurrentPage('landing');
            setAuthMode('signin');
            setAuthModalOpen(true);
            window.history.replaceState(null, '', '/?next=/dashboard');
          } else if (initialRoute.page === 'optimizer') {
            setCurrentPage('optimizer');
          } else if (initialRoute.page === 'stock-detail' && initialRoute.symbol) {
            setSelectedStockSymbol(initialRoute.symbol);
            setCurrentPage('stock-detail');
          } else if (initialRoute.page === 'stocks') {
            setCurrentPage('stocks');
          } else {
            setCurrentPage('landing');
          }
        }
      })
      .catch(() => {
        // Fallback if backend offline
        const saved = localStorage.getItem('dalal_user');
        if (saved) {
          try {
            setCurrentUser(JSON.parse(saved));
          } catch {}
        }
        if (initialRoute.page === 'dashboard') {
          if (saved) setCurrentPage('dashboard');
          else {
            setCurrentPage('landing');
            setAuthMode('signin');
            setAuthModalOpen(true);
            window.history.replaceState(null, '', '/?next=/dashboard');
          }
        } else if (initialRoute.page === 'optimizer') {
          setCurrentPage('optimizer');
        } else if (initialRoute.page === 'stock-detail' && initialRoute.symbol) {
          setSelectedStockSymbol(initialRoute.symbol);
          setCurrentPage('stock-detail');
        } else if (initialRoute.page === 'stocks') {
          setCurrentPage('stocks');
        } else {
          setCurrentPage('landing');
        }
      })
      .finally(() => {
        setIsLoadingAuth(false);
      });
  }, []);

  // Browser Back Button (popstate) & Protected Route Enforcement
  useEffect(() => {
    const handlePopState = () => {
      const route = parseRouteFromUrl();

      if (route.page === 'dashboard') {
        if (!currentUser) {
          // Protect dashboard
          setCurrentPage('landing');
          setNextUrl('/dashboard');
          setAuthMode('signin');
          setAuthModalOpen(true);
          window.history.replaceState(null, '', '/?next=/dashboard');
        } else {
          setCurrentPage('dashboard');
        }
      } else if (route.page === 'optimizer') {
        setCurrentPage('optimizer');
      } else if (route.page === 'stock-detail' && route.symbol) {
        setSelectedStockSymbol(route.symbol);
        setCurrentPage('stock-detail');
      } else if (route.page === 'stocks') {
        setSelectedStockSymbol(null);
        setCurrentPage('stocks');
      } else {
        setCurrentPage('landing');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  // Cross-Tab Logout Synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dalal_logout_event') {
        setCurrentUser(null);
        localStorage.removeItem('dalal_user');
        localStorage.removeItem('dalal_holdings_v2');
        setCurrentPage('landing');
        setAuthModalOpen(false);
        showToast('Signed out in another tab.');
        window.history.replaceState(null, '', '/');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Central Navigation Handler
  const handleNavigate = (page: 'landing' | 'dashboard' | 'optimizer' | 'stocks' | 'stock-detail', symbol?: string) => {
    if (page === 'dashboard') {
      if (!currentUser) {
        setNextUrl('/dashboard');
        setAuthMode('signin');
        setAuthModalOpen(true);
        return;
      }
      setCurrentPage('dashboard');
      window.history.pushState(null, '', '/dashboard');
    } else if (page === 'optimizer') {
      setCurrentPage('optimizer');
      window.history.pushState(null, '', '/optimizer');
    } else if (page === 'stocks') {
      setSelectedStockSymbol(null);
      setCurrentPage('stocks');
      window.history.pushState(null, '', '/stocks');
    } else if (page === 'stock-detail' && symbol) {
      const cleanSym = symbol.toUpperCase().replace(/\.NS$/, '');
      setSelectedStockSymbol(cleanSym);
      setCurrentPage('stock-detail');
      window.history.pushState(null, '', `/stocks/${cleanSym}`);
    } else {
      setCurrentPage('landing');
      window.history.pushState(null, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin', customNotice?: string) => {
    setAuthMode(mode);
    setAuthCustomNotice(customNotice || null);
    setAuthModalOpen(true);
  };

  const handleLoginSuccess = (user: UserProfile, isNewSignUp: boolean = false) => {
    setCurrentUser(user);
    localStorage.setItem('dalal_user', JSON.stringify(user));

    if (isNewSignUp) {
      localStorage.setItem('dalal_holdings_v2', JSON.stringify([]));
      window.dispatchEvent(new Event('reset-demo-portfolio'));
      showToast('Account created. Welcome to D&M Finance.');
    } else if (user.isDemo) {
      localStorage.setItem('dalal_holdings_v2', JSON.stringify(DEMO_STOCKS));
      window.dispatchEvent(new Event('reset-demo-portfolio'));
      showToast('Viewing demo portfolio in sandbox mode.');
    } else {
      showToast(`Welcome back, ${user.name}.`);
    }

    // If a watchlist star was pending, apply it
    if (pendingStarSymbol) {
      apiFetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: pendingStarSymbol }),
      }).catch(() => {});
      setPendingStarSymbol(null);
    }

    // Send them to the requested page
    if (nextUrl) {
      const target = nextUrl;
      setNextUrl(null);
      window.history.replaceState(null, '', target);
      if (target === '/dashboard') setCurrentPage('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Ignore
    }

    setCurrentUser(null);
    localStorage.removeItem('dalal_user');
    localStorage.removeItem('dalal_holdings_v2');
    localStorage.setItem('dalal_logout_event', Date.now().toString());
    window.history.replaceState(null, '', '/');
    showToast('Signed out of D&M Finance.');
    setCurrentPage('landing');
  };

  const handleResetDemoPortfolio = () => {
    localStorage.setItem('dalal_holdings_v2', JSON.stringify(DEMO_STOCKS));
    window.dispatchEvent(new Event('reset-demo-portfolio'));
    showToast('Demo portfolio reset to 5 NSE stocks.');
  };

  const showToast = (message: string, actionText?: string, onAction?: () => void) => {
    setToast({ message, actionText, onAction });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // Add to Optimizer action from StockDetailPage
  const handleAddToOptimizer = (cleanSymbol: string) => {
    try {
      let currentSelection: string[] = [];
      const saved = localStorage.getItem('dalal_optimizer_selected');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) currentSelection = parsed;
      }

      // Add symbol if not already present
      const symWithNs = cleanSymbol.endsWith('.NS') ? cleanSymbol : `${cleanSymbol}.NS`;
      if (!currentSelection.includes(symWithNs) && !currentSelection.includes(cleanSymbol)) {
        currentSelection.push(symWithNs);
        localStorage.setItem('dalal_optimizer_selected', JSON.stringify(currentSelection));
      }

      showToast(`Added ${cleanSymbol} to optimizer.`, 'Go to optimizer →', () => {
        handleNavigate('optimizer');
      });
    } catch {
      showToast(`Added ${cleanSymbol} to optimizer.`);
    }
  };

  // Open "Add to portfolio" modal with stock pre-selected and empty price/shares
  const handleOpenAddModalForStock = (stockItem: StockItem) => {
    const sStock: SearchableStock = {
      symbol: stockItem.symbol,
      name: stockItem.company_name,
      sector: stockItem.sector,
      currentPrice: stockItem.last_price,
      dayChange: stockItem.today_change_amount || 0,
      dayChangePercent: stockItem.today_change_pct || 0,
    };
    setInitialStockForModal(sStock);
    setAddStockModalOpen(true);
  };

  // Add stock holding confirmation
  const handleAddStockFromModal = (holding: StockHolding) => {
    try {
      const saved = localStorage.getItem('dalal_holdings_v2');
      let currentHoldings: StockHolding[] = saved ? JSON.parse(saved) : [];
      currentHoldings = [holding, ...currentHoldings];
      localStorage.setItem('dalal_holdings_v2', JSON.stringify(currentHoldings));
      window.dispatchEvent(new Event('holdings-updated'));
      showToast(`Added ${holding.symbol.replace(/\.NS$/, '')} to portfolio.`);
    } catch {
      showToast(`Added ${holding.symbol} to portfolio.`);
    }
  };

  // Skeleton Loader only when waiting on protected dashboard route
  if (isLoadingAuth && currentPage === 'dashboard') {
    return (
      <div className="min-h-screen bg-broadsheet-cream text-broadsheet-ink dark:bg-broadsheet-dark-bg dark:text-broadsheet-dark-text flex flex-col font-sans transition-colors duration-200">
        <div className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule py-4 px-4 sm:px-8 max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="h-7 w-56 bg-broadsheet-rule/40 dark:bg-broadsheet-dark-rule/50 rounded animate-pulse" />
          <div className="flex space-x-4">
            <div className="h-6 w-16 bg-broadsheet-rule/30 dark:bg-broadsheet-dark-rule/40 rounded animate-pulse" />
            <div className="h-6 w-16 bg-broadsheet-rule/30 dark:bg-broadsheet-dark-rule/40 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-grow max-w-6xl mx-auto w-full p-6 sm:p-8 space-y-6">
          <div className="h-10 w-2/3 bg-broadsheet-rule/20 dark:bg-broadsheet-dark-rule/30 rounded animate-pulse" />
          <div className="h-4 w-1/3 bg-broadsheet-rule/15 dark:bg-broadsheet-dark-rule/20 rounded animate-pulse" />
          <div className="h-64 w-full border border-broadsheet-rule/40 dark:border-broadsheet-dark-rule/40 bg-broadsheet-paper/50 dark:bg-broadsheet-dark-paper/50 rounded animate-pulse mt-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-broadsheet-cream text-broadsheet-ink dark:bg-broadsheet-dark-bg dark:text-broadsheet-dark-text transition-colors duration-200 flex flex-col font-sans">
      
      {/* Toast Notification with optional Action Link */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-broadsheet-ink text-white dark:bg-broadsheet-dark-text dark:text-black px-4 py-3 border border-broadsheet-rule dark:border-broadsheet-dark-rule font-sans text-xs shadow-2xl flex items-center space-x-3 animate-fade-in max-w-md">
          <span className="w-2 h-2 rounded-full bg-market-profit dark:bg-market-profit-dark flex-shrink-0" />
          <span className="flex-1">{toast.message}</span>
          {toast.actionText && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
              className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline font-semibold ml-2 flex-shrink-0 min-h-[44px] flex items-center"
            >
              {toast.actionText}
            </button>
          )}
        </div>
      )}

      {/* Shared Slim Masthead */}
      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenAuth={handleOpenAuth}
        user={currentUser}
        onLogout={handleLogout}
        onResetPortfolio={handleResetDemoPortfolio}
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />

      {/* Demo Sandbox Notification Ribbon */}
      {currentUser?.isDemo && (
        <aside aria-label="Demo notice" className="bg-broadsheet-cream/90 dark:bg-broadsheet-dark-paper border-b border-broadsheet-rule dark:border-broadsheet-dark-rule py-2 px-4 sm:px-8 text-xs font-sans text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 transition-colors">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>You&apos;re viewing sample data. Create an account to save your own.</span>
            <button
              type="button"
              onClick={() => handleOpenAuth('signup')}
              className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline font-medium text-left sm:text-right"
            >
              Create an account →
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-grow">
        {currentPage === 'stocks' ? (
          <StocksPage
            onSelectStock={(sym) => handleNavigate('stock-detail', sym)}
            user={currentUser}
            onOpenAuth={(mode, msg) => {
              if (msg?.includes('watchlist')) {
                setAuthCustomNotice(msg);
              }
              handleOpenAuth(mode || 'signin', msg);
            }}
            pendingStarSymbol={pendingStarSymbol}
            onClearPendingStar={() => setPendingStarSymbol(null)}
          />
        ) : currentPage === 'stock-detail' && selectedStockSymbol ? (
          <StockDetailPage
            symbol={selectedStockSymbol}
            onBack={() => handleNavigate('stocks')}
            onNavigateToStocks={() => handleNavigate('stocks')}
            onNavigateToDashboard={() => handleNavigate('dashboard')}
            onNavigateToOptimizer={() => handleNavigate('optimizer')}
            onOpenAddStockModal={handleOpenAddModalForStock}
            onAddToOptimizer={handleAddToOptimizer}
            user={currentUser}
            onOpenAuth={(mode, msg) => {
              if (msg?.includes('watchlist')) {
                setPendingStarSymbol(selectedStockSymbol);
                setAuthCustomNotice(msg);
              }
              handleOpenAuth(mode || 'signin', msg);
            }}
          />
        ) : currentPage === 'optimizer' ? (
          <PortfolioOptimizer
            onBackToDashboard={() => handleNavigate('dashboard')}
            user={currentUser}
            onOpenAuth={handleOpenAuth}
          />
        ) : currentPage === 'dashboard' ? (
          currentUser ? (
            <Dashboard
              onNavigateHome={() => handleNavigate('landing')}
              onNavigateToOptimizer={() => handleNavigate('optimizer')}
              isDemo={currentUser?.isDemo}
              onOpenAuth={handleOpenAuth}
              onShowToast={(msg) => showToast(msg)}
            />
          ) : (
            <div className="h-64" />
          )
        ) : (
          <FrontPage
            onOpenAuth={handleOpenAuth}
            onNavigate={handleNavigate}
            user={currentUser}
            isLoadingAuth={isLoadingAuth}
          />
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthCustomNotice(null);
        }}
        initialMode={authMode}
        onLoginSuccess={handleLoginSuccess}
        customNotice={authCustomNotice}
      />

      {/* Add Stock Modal (supports pre-selected stock with empty price/shares) */}
      <AddStockModal
        isOpen={addStockModalOpen}
        onClose={() => {
          setAddStockModalOpen(false);
          setInitialStockForModal(null);
        }}
        onAddStock={handleAddStockFromModal}
        initialStock={initialStockForModal}
        isDemo={currentUser?.isDemo}
        onOpenAuth={() => handleOpenAuth('signin')}
      />

      {/* Shared Footer */}
      {currentPage !== 'landing' && <Footer onNavigate={handleNavigate} />}
    </div>
  );
}

export default App;
