import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Share2,
  Users,
  Layers,
  Users2,
  MapPin,
  Film,
  Clapperboard,
  Box,
  CheckSquare,
  History,
  PlaySquare,
  Bell,
  BarChart3,
  FileText,
  CreditCard,
  Sliders,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useSidebarStore } from '@/shared/stores/useSidebarStore';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useOrganization } from '@/core/organization/useOrganization';
import { cn } from '@/shared/utils/cn';

interface NavItem {
  to: string;
  label: string;
  icon: any;
  allowed: boolean;
  hotkey?: string;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { isCollapsed, toggleCollapse, isMobileOpen, setMobileOpen } = useSidebarStore();
  const { user, can } = useAuth();
  const { currentOrganization } = useOrganization();

  const navSections: NavSection[] = [
    {
      title: 'HOME & WORKSPACE',
      items: [
        {
          to: '/dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          allowed: true,
          hotkey: '1',
        },
        {
          to: '/workspace',
          label: 'Workspace',
          icon: Sparkles,
          allowed: true,
          hotkey: 'W',
          badge: 'NON-LINEAR',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-bold',
        },
      ],
    },
    {
      title: 'ORGANIZATION',
      items: [
        {
          to: '/organizations',
          label: 'Organizations',
          icon: Building2,
          allowed: true,
          badge: currentOrganization.code,
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        },
        {
          to: '/clients',
          label: 'Clients',
          icon: Briefcase,
          allowed: true,
          badge: '4 Studio',
        },
        {
          to: '/vendors',
          label: 'Vendors',
          icon: Share2,
          allowed: true,
          badge: 'Partner',
        },
        {
          to: '/people',
          label: 'People',
          icon: Users,
          allowed: true,
        },
        {
          to: '/departments',
          label: 'Departments',
          icon: Layers,
          allowed: true,
        },
        {
          to: '/teams',
          label: 'Teams',
          icon: Users2,
          allowed: true,
        },
        {
          to: '/offices',
          label: 'Offices',
          icon: MapPin,
          allowed: true,
        },
      ],
    },
    {
      title: 'PRODUCTION',
      items: [
        {
          to: '/projects',
          label: 'Projects',
          icon: Film,
          allowed: can('projects:read'),
          hotkey: '2',
        },
        {
          to: '/shots',
          label: 'Shots',
          icon: Clapperboard,
          allowed: can('shots:read'),
          hotkey: '3',
          badge: '18 Cut',
        },
        {
          to: '/assets',
          label: 'Assets',
          icon: Box,
          allowed: can('assets:read'),
          hotkey: '4',
        },
        {
          to: '/tasks',
          label: 'Tasks',
          icon: CheckSquare,
          allowed: can('tasks:read'),
          hotkey: '5',
        },
        {
          to: '/versions',
          label: 'Versions',
          icon: History,
          allowed: true,
          badge: 'USD/EXR',
        },
        {
          to: '/reviews',
          label: 'Reviews',
          icon: PlaySquare,
          allowed: can('reviews:read'),
          badge: '3 Dailies',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          hotkey: '6',
        },
      ],
    },
    {
      title: 'PLATFORM',
      items: [
        {
          to: '/notifications',
          label: 'Notifications',
          icon: Bell,
          allowed: true,
          badge: '2 New',
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        },
        {
          to: '/analytics',
          label: 'Analytics',
          icon: BarChart3,
          allowed: true,
        },
        {
          to: '/reports',
          label: 'Reports',
          icon: FileText,
          allowed: true,
        },
        {
          to: '/billing',
          label: 'Billing',
          icon: CreditCard,
          allowed: true,
        },
        {
          to: '/settings',
          label: 'Pipeline & Settings',
          icon: Sliders,
          allowed: true,
          hotkey: '8',
        },
        {
          to: '/audit',
          label: 'Audit & Compliance',
          icon: ShieldCheck,
          allowed: can('audit:read'),
          hotkey: '7',
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="main-studio-sidebar"
        className={cn(
          'fixed lg:static top-0 bottom-0 left-0 z-40 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-200 select-none shrink-0',
          isCollapsed ? 'w-14' : 'w-60',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-md shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs text-white tracking-tight truncate flex items-center gap-1.5">
                  StudioHub{' '}
                  <span className="text-[9px] uppercase font-mono px-1 py-0.2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded font-semibold">
                    VFX OS
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 truncate">VFX & Animation Platform</span>
              </div>
            )}
          </div>

          <button
            id="sidebar-toggle-btn"
            onClick={toggleCollapse}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 py-2 px-2 space-y-3.5 overflow-y-auto custom-scrollbar">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => item.allowed);
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-0.5">
                {!isCollapsed && (
                  <div className="px-2 py-1 text-[9px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                    {section.title}
                  </div>
                )}

                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      id={`nav-${item.to.replace('/', '') || 'root'}`}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group relative',
                          isActive
                            ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                        )
                      }
                    >
                      <Icon className={cn('w-4 h-4 shrink-0', isCollapsed ? 'mx-auto' : 'mr-2.5')} />
                      {!isCollapsed && <span className="truncate text-xs">{item.label}</span>}
                      {!isCollapsed && item.badge && (
                        <span
                          className={cn(
                            'ml-auto px-1.5 py-0.2 text-[9px] font-mono font-bold rounded border',
                            item.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}

                      {/* Floating tooltip when collapsed */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                          {item.label}
                        </div>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Studio Tenancy Footprint in Sidebar */}
        <div className="p-2 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <img
              src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={user?.full_name || 'User'}
              className="w-6 h-6 rounded object-cover ring-1 ring-slate-700 shrink-0"
            />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white truncate leading-tight">
                  {user?.full_name || 'Crew Member'}
                </span>
                <span className="text-[9px] text-indigo-400 font-mono truncate">
                  {user?.role || 'Artist'} • {currentOrganization.code}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
