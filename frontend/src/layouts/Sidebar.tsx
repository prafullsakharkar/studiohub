import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Film,
  Clapperboard,
  Box,
  CheckSquare,
  Clock,
  History,
  PlaySquare,
  UploadCloud,
  Send,
  Bell,
  FileText,
  Sliders,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Terminal,
  GitFork,
  Calendar,
  Activity,
  Network,
  Cpu,
  Users,
  MapPin,
  Workflow,
  Building2,
  Briefcase,
} from 'lucide-react';
import { useSidebarStore } from '@/shared/stores/useSidebarStore';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { useProductionStore } from '@/core/production/useProductionStore';
import { evaluateUserPermission, hasElevatedAccess } from '@/core/permissions/rbac';
import { cn } from '@/shared/utils/cn';

export interface NavItemConfig {
  id: string;
  to: string;
  label: string;
  icon: any;
  pagePermission?: string;
  permissions?: string[];
  requireAny?: boolean;
  hotkey?: string;
  badge?: string;
  badgeColor?: string;
}

export interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
}

export const Sidebar: React.FC = () => {
  const { isCollapsed, toggleCollapse, isMobileOpen, setMobileOpen } = useSidebarStore();
  const { user } = useCurrentUser();
  const { activeProjectId } = useProductionStore();

  const evalContext = {
    projectId: activeProjectId || undefined,
  };

  const navSections: NavSectionConfig[] = [
    {
      title: 'HOME & WORKSPACE',
      items: [
        {
          id: 'dashboard',
          to: '/dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          pagePermission: 'page.dashboard',
          hotkey: '1',
        },
      ],
    },
    {
      title: 'STUDIO',
      items: [
        {
          id: 'clients',
          to: '/clients',
          label: 'Clients',
          icon: Building2,
          pagePermission: 'page.clients',
          permissions: ['client.view'],
        },
        {
          id: 'vendors',
          to: '/vendors',
          label: 'Vendors',
          icon: Briefcase,
          pagePermission: 'page.vendors',
          permissions: ['vendor.view'],
        },
        {
          id: 'people',
          to: '/people',
          label: 'People',
          icon: Users,
          pagePermission: 'page.people',
          permissions: ['people.view'],
        },
        {
          id: 'access',
          to: '/access',
          label: 'Access & RBAC',
          icon: ShieldCheck,
          pagePermission: 'page.permissions',
          permissions: ['roles.view', 'security.view'],
          requireAny: true,
          badge: 'RBAC',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-mono',
        },
        {
          id: 'departments',
          to: '/departments',
          label: 'Departments',
          icon: Workflow,
          pagePermission: 'page.departments',
          permissions: ['department.view'],
        },
        {
          id: 'teams',
          to: '/teams',
          label: 'Teams',
          icon: Users,
          pagePermission: 'page.teams',
          permissions: ['team.view'],
        },
        {
          id: 'offices',
          to: '/offices',
          label: 'Offices',
          icon: MapPin,
          pagePermission: 'page.offices',
          permissions: ['office.view'],
        },
      ],
    },
    {
      title: 'PRODUCTION',
      items: [
        {
          id: 'projects',
          to: '/projects',
          label: 'Projects',
          icon: Film,
          pagePermission: 'page.projects',
          permissions: ['project.view'],
          hotkey: '2',
        },
        {
          id: 'shots',
          to: '/shots',
          label: 'Shots',
          icon: Clapperboard,
          pagePermission: 'page.project.shots',
          permissions: ['shot.view'],
          hotkey: '3',
          badge: '18 Cut',
        },
        {
          id: 'assets',
          to: '/assets',
          label: 'Assets',
          icon: Box,
          pagePermission: 'page.project.assets',
          permissions: ['asset.view'],
          hotkey: '4',
        },
        {
          id: 'tasks',
          to: '/tasks',
          label: 'Tasks',
          icon: CheckSquare,
          pagePermission: 'page.project.tasks',
          permissions: ['task.view'],
          hotkey: '5',
        },
        {
          id: 'timelogs',
          to: '/timelogs',
          label: 'Timelogs',
          icon: Clock,
          pagePermission: 'page.project.timelogs',
          permissions: ['timelog.view', 'task.view'],
          badge: 'Live',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        },
        {
          id: 'versions',
          to: '/versions',
          label: 'Versions',
          icon: History,
          pagePermission: 'page.project.versions',
          permissions: ['version.view'],
          badge: 'USD/EXR',
        },
        {
          id: 'publishing',
          to: '/publishing',
          label: 'Publishing',
          icon: UploadCloud,
          pagePermission: 'page.project.publishing',
          permissions: ['version.create', 'version.view'],
          badge: 'DCC/USD',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        },
        {
          id: 'deliveries',
          to: '/deliveries',
          label: 'Deliveries',
          icon: Send,
          pagePermission: 'page.project.deliveries',
          permissions: ['delivery.view'],
          badge: 'Aspera',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        },
        {
          id: 'reviews',
          to: '/reviews',
          label: 'Reviews',
          icon: PlaySquare,
          pagePermission: 'page.project.reviews',
          permissions: ['review.view'],
          badge: '3 Dailies',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          hotkey: '6',
        },
        {
          id: 'workflows',
          to: '/workflows',
          label: 'Workflows',
          icon: GitFork,
          pagePermission: 'page.project.workflow',
          permissions: ['workflow.view'],
          badge: 'Canvas/Rules',
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          hotkey: '7',
        },
        {
          id: 'scheduling',
          to: '/scheduling',
          label: 'Scheduling',
          icon: Calendar,
          pagePermission: 'page.project.schedule',
          permissions: ['schedule.view'],
          badge: 'Gantt/Cap',
          badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30 font-bold',
          hotkey: '8',
        },
      ],
    },
    {
      title: 'PLATFORM',
      items: [
        {
          id: 'platform-admin',
          to: '/platform/admin',
          label: 'Platform Admin',
          icon: ShieldCheck,
          pagePermission: 'page.platform_admin',
          permissions: ['platform.admin.view'],
          badge: 'MASTER',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-bold',
        },
        {
          id: 'api-health',
          to: '/platform/health',
          label: 'API Health — Live Services',
          icon: Activity,
          pagePermission: 'page.platform_admin',
          badge: '99.98%',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold',
        },
        {
          id: 'data-platform',
          to: '/data-platform',
          label: 'Data Platform',
          icon: Sliders,
          pagePermission: 'page.data_platform',
          badge: 'CRUD/7-VIEWS',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-bold',
        },
        {
          id: 'notifications',
          to: '/notifications',
          label: 'Notifications',
          icon: Bell,
          pagePermission: 'page.notifications',
          badge: '2 New',
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        },
        {
          id: 'reports',
          to: '/reports',
          label: 'Reports',
          icon: FileText,
          pagePermission: 'page.reports',
          permissions: ['reports.view'],
        },
        {
          id: 'testing',
          to: '/testing',
          label: 'QA Runner — Test Suites',
          icon: Terminal,
          pagePermission: 'page.testing',
          badge: 'MSW/DRF',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-mono',
          hotkey: 'T',
        },
      ],
    },
    {
      title: 'AUDIT & OBSERVABILITY',
      items: [
        {
          id: 'audit',
          to: '/audit',
          label: 'Audit & Activity',
          icon: ShieldCheck,
          pagePermission: 'page.audit_logs',
          permissions: ['audit.view', 'activity.view'],
          requireAny: true,
          badge: 'Ledger',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          hotkey: '7',
        },
        {
          id: 'system-logs',
          to: '/system-logs',
          label: 'System Logs',
          icon: Network,
          pagePermission: 'page.api_requests',
          permissions: ['api_requests.view', 'error_logs.view', 'change_logs.view', 'login_history.view'],
          requireAny: true,
          badge: 'Telemetry',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        },
        {
          id: 'jobs',
          to: '/jobs',
          label: 'Jobs & Tracks',
          icon: Cpu,
          pagePermission: 'page.background_jobs',
          permissions: ['background_jobs.view', 'tracks.view'],
          requireAny: true,
          badge: 'Worker',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        },
      ],
    },
  ];

  // Helper to check item permission
  const isItemAllowed = (item: NavItemConfig): boolean => {
    if (!user) return false;

    // Only admin can have access for API & Test Suite in platform
    if (item.id === 'testing') {
      return hasElevatedAccess(user);
    }

    // Strict superuser rule (spec 2026-10-05 §1): superusers see everything;
    // role labels (Platform Admin, Organization Owner, …) grant nothing on
    // their own — membership/permissions are the source of truth.
    if (item.pagePermission) {
      const allowed = evaluateUserPermission(user, item.pagePermission, evalContext);
      if (!allowed) return false;
    }

    if (item.permissions && item.permissions.length > 0) {
      const allowed = item.requireAny
        ? item.permissions.some((p) => evaluateUserPermission(user, p, evalContext))
        : item.permissions.every((p) => evaluateUserPermission(user, p, evalContext));
      if (!allowed) return false;
    }

    return true;
  };

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
          'fixed lg:static top-0 bottom-0 left-0 z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-200 select-none shrink-0',
          isCollapsed ? 'w-14' : 'w-60',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className={cn("h-14 flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/40 relative", isCollapsed ? "justify-center px-0" : "justify-between px-3")}>
          <div className={cn("flex items-center overflow-hidden", !isCollapsed && "space-x-2.5")}>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-md shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs text-slate-900 dark:text-white tracking-tight truncate flex items-center gap-1.5">
                  StudioHub{' '}
                  <span className="text-[9px] uppercase font-mono px-1 py-0.2 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded font-semibold">
                    VFX OS
                  </span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">VFX & Animation Platform</span>
              </div>
            )}
          </div>

          <button
            id="sidebar-toggle-btn"
            onClick={toggleCollapse}
            className={cn(
              "hidden lg:flex items-center justify-center rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
              isCollapsed ? "w-6 h-6 absolute -right-3 top-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-md rounded-full z-50" : "w-6 h-6"
            )}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation Sections */}
        <div id="sidebar-nav-container" className="flex-1 py-2 px-2 space-y-3.5 overflow-y-auto custom-scrollbar">
          {navSections.map((section) => {
            const visibleItems = section.items.filter(isItemAllowed);
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
                      id={`nav-${item.id || item.to.replace('/', '') || 'root'}`}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center rounded-lg text-xs font-medium transition-all group relative',
                          isCollapsed ? 'justify-center w-10 h-10 mx-auto px-0' : 'gap-2.5 px-2.5 py-1.5 w-full',
                          isActive
                            ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 font-semibold shadow-2xs shadow-cyan-500/10'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                        )
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!isCollapsed && <span className="truncate text-xs leading-none">{item.label}</span>}
                      {!isCollapsed && item.badge && (
                        <span
                          className={cn(
                            'ml-auto px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border leading-none shrink-0',
                            item.badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
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
        <div className={cn("p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/40", isCollapsed && "flex justify-center")}>
          <div className={cn("flex items-center rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-2xs", isCollapsed ? "p-1.5 justify-center" : "space-x-2 p-1.5")}>
            <img
              src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={user?.full_name || 'User'}
              className="w-6 h-6 rounded object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
            />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate leading-tight">
                  {user?.full_name || 'Crew Member'}
                </span>
                <span className="text-[9px] text-cyan-600 dark:text-cyan-400 font-mono truncate">
                  {user?.role || 'Artist'}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
