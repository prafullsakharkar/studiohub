import React, { useState, useEffect } from 'react';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
  Search,
  Command,
  Film,
  Sliders,
  Sparkles,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useSidebarStore } from '@/shared/stores/useSidebarStore';
import { useThemeMode } from '@/providers/ThemeProvider';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { CommandPalette } from '@/shared/components/CommandPalette';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { toggleMobile } = useSidebarStore();
  const { mode, toggleTheme } = useThemeMode();
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Global ⌘K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="h-14 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 lg:px-4 flex items-center justify-between sticky top-0 z-30 select-none">
        {/* Left section: Mobile Toggle, Studio Organization Switcher & Project HUD */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <button
            id="mobile-menu-btn"
            onClick={toggleMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Studio Organization Switcher */}
          <OrganizationSwitcher />

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Project Master Badge */}
          <div className="flex items-center space-x-2">
            <Link
              to="/projects"
              className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition-colors"
            >
              <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-bold text-white font-mono">[NK99]</span>
              <span className="hidden md:inline font-medium text-slate-300">Neon Knight</span>
              <span className="hidden xl:inline text-[10px] text-slate-400 font-mono px-1 bg-slate-900 rounded">
                ACEScg • 24fps
              </span>
            </Link>

            <span className="hidden 2xl:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              OpenUSD 24.08 Active
            </span>
          </div>
        </div>

        {/* Center: Linear-style Quick Command Trigger */}
        <div className="flex-1 max-w-sm lg:max-w-md mx-3 hidden md:block">
          <button
            onClick={() => setIsCommandOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition-all shadow-inner"
          >
            <div className="flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">Search shots, assets, clients, crew or commands...</span>
            </div>
            <div className="flex items-center space-x-1 font-mono text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Right section: Farm load, Theme Switcher, Notifications, User Profile */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Mobile search trigger */}
          <button
            onClick={() => setIsCommandOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Render Farm Quick HUD */}
          <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-950/50 border border-slate-800 text-[11px] text-slate-300 font-mono">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Farm:</span>
            <span className="text-emerald-400 font-semibold">94/128 Blades</span>
          </div>

          {/* Theme Toggle (Dark/Light) */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={mode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {mode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              id="notifications-btn"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
              }}
              className="relative p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-slate-900" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Production Alerts</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`p-3 text-left transition-colors cursor-pointer hover:bg-slate-800/50 ${
                        !n.read ? 'bg-indigo-950/15' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                          {n.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {n.type === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          {n.type === 'info' && <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                          {n.title}
                        </p>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">{n.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Account Persona Menu */}
          <div className="relative">
            <button
              id="user-menu-btn"
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="flex items-center space-x-2 p-1 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <img
                src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={user?.full_name || 'User'}
                className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-700"
              />
              <span className="hidden md:block text-xs font-semibold text-slate-200">
                {user?.first_name || 'User'}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="p-3 border-b border-slate-800/80 mb-1">
                  <p className="text-xs font-bold text-white">{user?.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono">
                    {user?.role}
                  </div>
                </div>

                <div className="p-1 space-y-1">
                  <button
                    onClick={() => {
                      setIsCommandOpen(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>Switch Role Persona</span>
                    <kbd className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1 py-0.2 rounded">⌘K</kbd>
                  </button>
                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>Pipeline Settings</span>
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                </div>

                <div className="pt-1 border-t border-slate-800/80">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                    onClick={logout}
                    leftIcon={<LogOut className="w-3.5 h-3.5" />}
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
    </>
  );
};
