import { useAuth } from '@/modules/auth';
import React, { useState, useRef, useEffect } from 'react';
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
  Globe,
  ShieldCheck,
  HelpCircle,
  Compass,
  Palette,
} from 'lucide-react';
import { useCoachMarkStore } from '@/shared/stores/useCoachMarkStore';
;
import { useSidebarStore } from '@/shared/stores/useSidebarStore';
import { useThemeMode } from '@/providers/ThemeProvider';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { KeyboardShortcutsModal } from '@/shared/components/KeyboardShortcutsModal';
import { useKeyboardNavigation } from '@/shared/hooks/useKeyboardNavigation';
import { evaluateRouteAccess } from '@/core/permissions/routePermissionsRegistry';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { ProjectSwitcher } from './ProjectSwitcher';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';
import { LayoutDensityControl } from '@/shared/layouts/LayoutDensityControl';
import { CommandPalette } from '@/shared/components/CommandPalette';

export const Header: React.FC = () => {
  const { user, can, logout } = useAuth();
  const { toggleMobile } = useSidebarStore();
  const { mode, resolvedMode, toggleTheme } = useThemeMode();
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const { startTour } = useCoachMarkStore();

  // Strict superuser-only (spec §1): a `Platform Admin` role label alone
  // grants nothing. Settings visibility requires superuser or an explicit
  // settings grant resolved by the permission engine.
  const canViewSettings = Boolean(
    user?.is_superuser ||
    can('settings.view') ||
    can('page.settings')
  );

  // Platform health telemetry is an admin surface (route
  // `/platform/health` requires `platform.admin.view`); the header HUD link
  // follows the same gate so it is never advertised to unauthorized users.
  const canViewPlatformHealth = Boolean(
    user?.is_superuser ||
    can('platform.admin.view')
  );

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Register Global Keyboard Navigation (⌘K, ?, G+key, ⌘ Shift P, G+H)
  // Go-to shortcuts respect the route permission registry so unauthorized
  // destinations are ignored instead of navigating into a 403.
  const { user: navUser } = useCurrentUser();
  useKeyboardNavigation({
    onOpenCommandPalette: () => {},
    onOpenShortcutsModal: () => setIsShortcutsOpen(true),
    onOpenTour: startTour,
    canNavigate: (path: string) =>
      evaluateRouteAccess(navUser, path).allowed,
  });

  return (
    <>
      <header className="h-14 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-2 sm:px-3 lg:px-4 flex items-center justify-between gap-1.5 sm:gap-2 lg:gap-3 sticky top-0 z-30 select-none min-w-0 transition-colors duration-200">
        {/* Left section: Mobile Toggle, Static Studio Badge & Project HUD */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink overflow-visible">
          <button
            id="mobile-menu-btn"
            onClick={toggleMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Static Studio Badge (single-tenant: the active studio is shown,
              never switched here — the org switching UI is gone). */}
          <div
            id="studio-badge"
            data-testid="studio-badge"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border select-none bg-slate-950/80 border-slate-800/80 text-slate-200"
            title="StudioHub"
          >
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shrink-0 overflow-hidden shadow-2xs ring-1 ring-white/10">
              <Building2 className="w-3 h-3" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-white truncate">StudioHub</span>
              <span className="hidden lg:flex text-[9px] text-slate-400 truncate items-center gap-1 font-mono">
                <Globe className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                <span className="truncate">VFX OS</span>
              </span>
            </div>
          </div>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden md:block shrink-0" />

          {/* Project Production Master Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
            <div className="min-w-0 shrink">
              <ProjectSwitcher />
            </div>
          </div>
        </div>

        {/* Right section: theme switcher, notifications, user profile */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
          <button
            id="header-getting-started-btn"
            onClick={startTour}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Getting Started & Navigation Walkthrough"
            aria-label="Getting Started Walkthrough"
          >
            <Compass className="w-4 h-4 text-cyan-600 dark:text-cyan-400/90" />
          </button>

          {/* Keyboard Shortcuts Trigger */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="hidden xl:flex p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Keyboard Shortcuts (?)"
            aria-label="Keyboard Shortcuts"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* API Health Quick HUD (admin surface: same grant as /platform/health) */}
          {canViewPlatformHealth && (
          <Link
            to="/platform/health"
            className="hidden xl:flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 text-[11px] text-slate-700 dark:text-slate-300 font-mono shrink-0 transition-colors group"
            title="StudioHub API Health & Core Services Telemetry (Click to inspect)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <span className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200">API:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">99.98%</span>
          </Link>
          )}

          {/* Render Farm Quick HUD */}
          <div className="hidden 2xl:flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-mono shrink-0">
            <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-slate-500 dark:text-slate-400">Farm:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">94/128</span>
          </div>

          {/* Global Page Layout Control */}
          <LayoutDensityControl buttonVariant="compact" className="shrink-0" />

          {/* Theme Toggle (Dark/Light) */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title={resolvedMode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle Theme"
          >
            {resolvedMode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* Notifications Dropdown */}
          <div ref={notificationsRef} className="relative shrink-0">
            <button
              id="notifications-btn"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
              }}
              className="relative p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-500 ring-2 ring-slate-900" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-1.5 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Production Alerts</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3 text-left transition-colors cursor-pointer hover:bg-slate-800/50 ${
                          !n.read ? 'bg-cyan-950/20' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                            {n.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                            {n.type === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            {n.type === 'info' && <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">{n.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Account Persona Menu */}
          <div ref={userMenuRef} className="relative shrink-0">
            <button
              id="user-menu-btn"
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors cursor-pointer shrink-0"
              aria-label="User account menu"
            >
              <img
                src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={user?.full_name || 'User'}
                className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-300 dark:ring-slate-700 shrink-0"
              />
              <div className="hidden 2xl:flex flex-col text-left leading-none justify-center">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[85px] lg:max-w-[110px] leading-tight">
                  {user?.first_name || user?.full_name?.split(' ')[0] || 'User'}
                </span>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono truncate max-w-[85px] lg:max-w-[110px] leading-tight mt-0.5">
                  {user?.role || 'Artist'}
                </span>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-95">
                <div className="p-3 border-b border-slate-800/80 mb-1">
                  <p className="text-xs font-bold text-white">{user?.full_name || 'User Profile'}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email || 'user@studiohub.vfx'}</p>
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono">
                    Role: {user?.role || 'Artist'}
                  </div>
                </div>

                <div className="p-1 space-y-1">
                  <button
                    onClick={() => {
                      setIsCommandOpen(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span>Command Palette</span>
                    <kbd className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1 py-0.2 rounded">⌘K</kbd>
                  </button>
                  {canViewSettings && (
                    <Link
                      to="/platform/admin/pipeline"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <span>Pipeline Settings</span>
                      <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                  )}
                  {canViewSettings && (
                  <Link
                    id="user-menu-theme-editor-btn"
                    to="/platform/admin/theme"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Palette className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Theme & Accent Editor</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                      Color
                    </span>
                  </Link>
                  )}
                  <button
                    id="user-menu-getting-started-btn"
                    onClick={() => {
                      startTour();
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Compass className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Getting Started Tour</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                      Guide
                    </span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-800/80">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 cursor-pointer"
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
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

      {/* Command palette discontinued per cleanup. */}

      {/* Phase 4: permissions simulator modal removed (self-grant risk, ADR-0033) */}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </>
  );
};
