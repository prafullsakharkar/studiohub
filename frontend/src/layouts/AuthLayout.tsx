import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sparkles, Sun, Moon, ShieldCheck, Cpu } from 'lucide-react';
import { useThemeMode } from '@/providers/ThemeProvider';

export const AuthLayout: React.FC = () => {
  const { resolvedMode, toggleTheme } = useThemeMode();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased transition-colors duration-200 relative selection:bg-indigo-500 selection:text-white p-4 sm:p-6">
      {/* Ambient background glow / subtle studio grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl dark:from-indigo-600/15 dark:via-purple-600/10 rounded-full" />
        <div className="absolute -bottom-40 right-10 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/10 blur-3xl rounded-full" />
      </div>

      {/* Top Floating Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-500 dark:to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                StudioHub VFX
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Production Operating System
            </p>
          </div>
        </div>

        {/* Theme Mode Switcher */}
        <button
          id="auth-theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme mode"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm transition-all flex items-center gap-1.5 text-xs font-medium"
        >
          {resolvedMode === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-500" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>
      </header>

      {/* Main Centered Content Container */}
      <main className="relative z-10 w-full max-w-lg mx-auto flex items-center justify-center my-auto">
        <Outlet />
      </main>

      {/* Bottom Floating Bar */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 w-full max-w-7xl mx-auto px-6 py-4 hidden sm:flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <span>Apex Digital Studios Platform</span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="font-mono">OpenUSD & ACES 1.3 Native</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> OpenID Connect & RBAC
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            <Cpu className="w-3.5 h-3.5" /> Pipeline API Active
          </span>
        </div>
      </footer>
    </div>
  );
};
