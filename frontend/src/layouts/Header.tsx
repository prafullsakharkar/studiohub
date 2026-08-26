import React, { useState } from 'react';
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
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useSidebarStore } from '@/shared/stores/useSidebarStore';
import { useThemeMode } from '@/providers/ThemeProvider';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { CommandPalette } from '@/shared/components/CommandPalette';
import { PermissionsSimulatorModal } from '@/shared/components/PermissionsSimulatorModal';
import { KeyboardShortcutsModal } from '@/shared/components/KeyboardShortcutsModal';
import { usePermissions } from '@/core/permissions/usePermissions';
import { useKeyboardNavigation } from '@/shared/hooks/useKeyboardNavigation';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { ProjectSwitcher } from './ProjectSwitcher';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { toggleMobile } = useSidebarStore();
  const { mode, toggleTheme } = useThemeMode();
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const { currentRole } = usePermissions();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Register Global Keyboard Navigation (⌘K, ?, G+key, ⌘ Shift P)
  useKeyboardNavigation({
    onOpenCommandPalette: () => setIsCommandOpen(true),
    onOpenShortcutsModal: () => setIsShortcutsOpen(true),
    onOpenPermissionsModal: () => setIsPermissionsOpen(true),
  });

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

          {/* Project Production Master Switcher */}
          <div className="flex items-center space-x-2">
            <ProjectSwitcher />

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
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition-all shadow-inner group"
          >
            <div className="flex items-center space-x-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              <span className="text-slate-400 truncate">Search shots, assets, clients, crew or commands...</span>
            </div>
            <div className="flex items-center space-x-1 font-mono text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 shrink-0 ml-2">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Right section: Permissions Role Simulator, Farm load, Theme Switcher, Notifications, User Profile */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Mobile search trigger */}
          <button
            onClick={() => setIsCommandOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Quick RBAC Role Badge & Simulator Trigger */}
          <button
            onClick={() => setIsPermissionsOpen(true)}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] font-mono text-slate-300 transition-all"
            title="Inspect RBAC permissions matrix or switch active role"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="hidden xl:inline text-slate-500">Role:</span>
            <span className="text-indigo-300 font-semibold truncate max-w-[120px]">{currentRole.name}</span>
          </button>

          {/* Keyboard Shortcuts Trigger */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Render Farm Quick HUD */}
          <div className="hidden 2xl:flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-950/50 border border-slate-800 text-[11px] text-slate-300 font-mono">
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
                    Role: {currentRole.name}
                  </div>
                </div>

                <div className="p-1 space-y-1">
                  <button
                    onClick={() => {
                      setIsPermissionsOpen(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>Simulate Role & Permissions</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  </button>
                  <button
                    onClick={() => {
                      setIsCommandOpen(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>Command Palette</span>
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

      {/* Permissions Matrix & Simulator Modal */}
      <PermissionsSimulatorModal isOpen={isPermissionsOpen} onClose={() => setIsPermissionsOpen(false)} />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </>
  );
};
