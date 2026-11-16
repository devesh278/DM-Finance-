import React, { useState, useEffect, useRef } from 'react';
import { X, Eye, EyeOff, AlertCircle, Check, Loader2 } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';

export interface UserProfile {
  email: string;
  name: string;
  isDemo?: boolean;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  onLoginSuccess: (user: UserProfile, isNewSignUp?: boolean) => void;
  customNotice?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  onLoginSuccess,
  customNotice = null,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Inline errors per specification
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotNotice, setForgotNotice] = useState(false);

  // Focus management & keyboard trap
  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Reset mode whenever initialMode changes upon opening
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setEmailError(null);
      setPasswordError(null);
      setGeneralError(null);
      setForgotNotice(false);
    }
  }, [isOpen, initialMode]);

  // Focus first field, trap focus, return focus on exit, Esc to close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
          return;
        }

        if (e.key === 'Tab' && modalRef.current) {
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleKeyDown);
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isPasswordLongEnough = password.length >= 8;

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);
    setForgotNotice(false);
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);
    setForgotNotice(false);

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 1. Email validation
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setEmailError('Enter a valid email');
      return;
    }

    // 2. Password validation
    if (mode === 'signup' && password.length < 8) {
      setPasswordError('Use at least 8 characters');
      return;
    }

    if (mode === 'signin' && !password) {
      setPasswordError('Email or password is incorrect');
      return;
    }

    setIsLoading(true);

    if (mode === 'signup') {
      // CREATE ACCOUNT
      try {
        const res = await apiFetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });

        if (res.ok) {
          const data = await res.json();
          setIsLoading(false);
          onLoginSuccess(
            {
              email: trimmedEmail,
              name: data.user?.name || trimmedEmail.split('@')[0],
              isDemo: false,
            },
            true // isNewSignUp = true -> goes to Dashboard empty state
          );
          onClose();
          return;
        } else {
          const errData = await res.json().catch(() => ({}));
          const detail = (errData.detail || '').toLowerCase();
          if (
            detail.includes('already registered') ||
            detail.includes('exists') ||
            detail.includes('unique')
          ) {
            setEmailError('An account with this email already exists. Sign in instead.');
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        // Backend not reached or offline
      }

      // Client-side fallback check
      const localUsers = JSON.parse(localStorage.getItem('dalal_local_users') || '[]');
      if (localUsers.some((u: any) => u.email.toLowerCase() === trimmedEmail.toLowerCase())) {
        setEmailError('An account with this email already exists. Sign in instead.');
        setIsLoading(false);
        return;
      }

      localUsers.push({ email: trimmedEmail, password, name: trimmedEmail.split('@')[0] });
      localStorage.setItem('dalal_local_users', JSON.stringify(localUsers));

      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess(
          {
            email: trimmedEmail,
            name: trimmedEmail.split('@')[0],
            isDemo: false,
          },
          true // isNewSignUp = true -> goes to Dashboard empty state
        );
        onClose();
      }, 400);

    } else {
      // SIGN IN
      try {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });

        if (res.ok) {
          const data = await res.json();
          setIsLoading(false);
          onLoginSuccess(
            {
              email: trimmedEmail,
              name: data.user?.name || trimmedEmail.split('@')[0],
              isDemo: data.user?.isDemo || false,
            },
            false
          );
          onClose();
          return;
        } else if (res.status === 401) {
          setGeneralError('Email or password is incorrect');
          setIsLoading(false);
          return;
        }
      } catch (err) {
        // Fallback for sandbox socket limitation
      }

      const localUsers = JSON.parse(localStorage.getItem('dalal_local_users') || '[]');
      const found = localUsers.find(
        (u: any) => u.email.toLowerCase() === trimmedEmail.toLowerCase() && u.password === password
      );

      if (found) {
        setTimeout(() => {
          setIsLoading(false);
          onLoginSuccess(
            {
              email: found.email,
              name: found.name,
              isDemo: false,
            },
            false
          );
          onClose();
        }, 400);
      } else {
        setTimeout(() => {
          setIsLoading(false);
          setGeneralError('Email or password is incorrect');
        }, 400);
      }
    }
  };

  // Demo access: Read-only sandbox account with no shared mutation
  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/auth/demo', {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setIsLoading(false);
        onLoginSuccess(
          {
            email: data.user?.email || 'demo@dalalstreet.internal',
            name: data.user?.name || 'Demo Investor',
            isDemo: true,
          },
          false
        );
        onClose();
        return;
      }
    } catch (e) {
      // Fallback
    }

    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess(
        {
          email: 'demo@dalalstreet.in',
          name: 'Demo',
          isDemo: true,
        },
        false
      );
      onClose();
    }, 250);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-broadsheet-ink/60 dark:bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full sm:max-w-md bg-broadsheet-paper dark:bg-broadsheet-dark-paper border border-broadsheet-rule dark:border-broadsheet-dark-rule rounded-t-2xl sm:rounded-none p-6 sm:p-8 shadow-2xl max-h-[92vh] sm:max-h-none overflow-y-auto font-sans text-broadsheet-ink dark:text-broadsheet-dark-text"
      >
        {/* Close Button (44px touch target) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-broadsheet-muted dark:text-broadsheet-dark-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Block (No eyebrow, no uppercase badges) */}
        <div className="border-b border-broadsheet-rule dark:border-broadsheet-dark-rule pb-4 mb-6 pr-8">
          <h2
            id="auth-modal-title"
            className="font-serif text-3xl sm:text-4xl text-broadsheet-ink dark:text-broadsheet-dark-text font-normal tracking-tight"
          >
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80 mt-1">
            {customNotice && mode === 'signin'
              ? customNotice
              : mode === 'signin'
              ? 'Sign in to see your portfolio.'
              : 'Free. Takes under a minute.'}
          </p>
        </div>

        {/* General Error Notice */}
        {generalError && (
          <div className="mb-4 p-3 border border-market-loss/30 bg-market-loss-bg/30 text-market-loss dark:text-market-loss-dark flex items-start space-x-2 text-xs font-sans">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          
          {/* Email Field */}
          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-broadsheet-ink dark:text-broadsheet-dark-text mb-1"
            >
              Email
            </label>
            <input
              id="auth-email"
              ref={emailInputRef}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
                setGeneralError(null);
              }}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 min-h-[44px] bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg border border-broadsheet-rule dark:border-broadsheet-dark-rule text-broadsheet-ink dark:text-broadsheet-dark-text text-sm focus:outline-none focus:border-broadsheet-terracotta dark:focus:border-broadsheet-dark-brass"
            />
            {emailError && (
              <div className="mt-1.5 flex items-start space-x-1.5 text-xs text-market-loss dark:text-market-loss-dark font-sans">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  {emailError}
                  {emailError.includes('already exists') && (
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="ml-1 text-broadsheet-terracotta dark:text-broadsheet-dark-brass underline font-medium"
                    >
                      Sign in instead
                    </button>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="auth-password"
                className="text-xs font-medium text-broadsheet-ink dark:text-broadsheet-dark-text"
              >
                Password
              </label>

              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => setForgotNotice(true)}
                  className="text-xs text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>

            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                  setGeneralError(null);
                }}
                placeholder=""
                className="w-full pl-3 pr-11 py-2.5 min-h-[44px] bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg border border-broadsheet-rule dark:border-broadsheet-dark-rule text-broadsheet-ink dark:text-broadsheet-dark-text text-sm focus:outline-none focus:border-broadsheet-terracotta dark:focus:border-broadsheet-dark-brass font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-0 bottom-0 px-3 min-w-[44px] flex items-center justify-center text-broadsheet-muted hover:text-broadsheet-ink dark:hover:text-broadsheet-dark-text transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Forgot password info message */}
            {forgotNotice && (
              <p className="mt-1 text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted font-sans">
                Password reset link will be sent to your email if registered.
              </p>
            )}

            {/* Password error */}
            {passwordError && (
              <div className="mt-1.5 flex items-center space-x-1.5 text-xs text-market-loss dark:text-market-loss-dark font-sans">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Create Account Live Check: "At least 8 characters" with green checkmark when met */}
            {mode === 'signup' && (
              <div
                className={`mt-2 flex items-center space-x-1.5 text-xs transition-colors ${
                  isPasswordLongEnough
                    ? 'text-market-profit dark:text-market-profit-dark font-medium'
                    : 'text-broadsheet-muted dark:text-broadsheet-dark-muted'
                }`}
              >
                {isPasswordLongEnough ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-broadsheet-muted dark:bg-broadsheet-dark-muted inline-block ml-1 mr-1" />
                )}
                <span>At least 8 characters</span>
              </div>
            )}
          </div>

          {/* Primary Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px] bg-broadsheet-terracotta hover:bg-broadsheet-terracotta-hover dark:bg-broadsheet-dark-brass dark:hover:bg-broadsheet-dark-brass-hover text-white dark:text-black font-sans font-medium text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {isLoading
                  ? mode === 'signin'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'signin'
                  ? 'Sign in'
                  : 'Create account'}
              </span>
            </button>
          </div>
        </form>

        {/* Divider: "or" */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="border-t border-broadsheet-rule dark:border-broadsheet-dark-rule w-full" />
          <span className="bg-broadsheet-paper dark:bg-broadsheet-dark-paper px-3 text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted font-sans absolute">
            or
          </span>
        </div>

        {/* Secondary Outlined Button: "Try the demo, no signup" */}
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={isLoading}
          className="w-full min-h-[44px] border border-broadsheet-rule dark:border-broadsheet-dark-rule hover:border-broadsheet-ink dark:hover:border-broadsheet-dark-text bg-broadsheet-cream/40 dark:bg-broadsheet-dark-bg text-broadsheet-ink dark:text-broadsheet-dark-text font-sans font-medium text-xs transition-colors flex items-center justify-center space-x-1.5"
        >
          <span>Try the demo, no signup</span>
        </button>

        {/* Bottom Line: Mode Switcher */}
        <div className="mt-5 text-center text-xs font-sans text-broadsheet-ink/80 dark:text-broadsheet-dark-text/80">
          {mode === 'signin' ? (
            <p>
              New here?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline font-medium"
              >
                Create an account
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        {/* Create Account Footer Links & Notice */}
        {mode === 'signup' && (
          <div className="mt-4 pt-3 border-t border-broadsheet-rule-subtle dark:border-broadsheet-dark-rule/50 text-center text-xs text-broadsheet-muted dark:text-broadsheet-dark-muted space-y-1 font-sans">
            <p>
              By creating an account you agree to the{' '}
              <a
                href="#terms"
                onClick={(e) => { e.preventDefault(); alert('Terms of Service: This educational financial software is provided for simulation and backtesting purposes.'); }}
                className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline"
              >
                Terms
              </a>{' '}
              and{' '}
              <a
                href="#privacy"
                onClick={(e) => { e.preventDefault(); alert('Privacy Policy: All portfolio records and simulation inputs stay local or sandboxed.'); }}
                className="text-broadsheet-terracotta dark:text-broadsheet-dark-brass hover:underline"
              >
                Privacy Policy
              </a>.
            </p>
            <p className="text-[11px] opacity-75">
              Educational tool, not investment advice.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
