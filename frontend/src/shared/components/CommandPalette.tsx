import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Film,
  Clapperboard,
  Box,
  CheckSquare,
  PlaySquare,
  ShieldCheck,
  Sliders,
  Sun,
  Moon,
  ArrowRight,
  Sparkles,
  Layers,
  Activity,
  X,
  Briefcase,
  Users,
  MapPin,
  Clock,
  History,
  Lock,
  CheckCircle2,
  PlusCircle,
  FolderOpen,
  ArrowUpDown,
  KeyRound,
  FileText,
  Workflow,
  Command as CommandIcon,
  HelpCircle,
  Database,
} from 'lucide-react';
import { usePermissions } from '@/core/permissions/usePermissions';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { evaluateUserPermission, hasElevatedAccess } from '@/core/permissions/rbac';
import { useThemeMode } from '@/providers/ThemeProvider';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { type CommandItem, type EntityType } from '@/types/common';
import type { PermissionKey } from '@/types/identity';
import { ActionDispatcherModal, type ActionModalType } from './ActionDispatcherModals';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'all' | 'commands' | 'activity';
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  initialMode = 'all',
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const { mode: themeMode, toggleTheme } = useThemeMode();
  const { currentRole } = usePermissions();
  const { user } = useCurrentUser();
  // Centralized admin check (engine-backed elevated grants).
  // Never compare raw role strings here; hasElevatedAccess owns that logic.
  const isAdmin = hasElevatedAccess(user);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { activities } = useActivityStore();

  // Single canonical evaluation (ADR-0033): the engine owns the superuser /
  // platform / org-owner rules — no duplicated role-name branches here.
  const canRunCommand = React.useCallback(
    (permission?: string) => {
      if (!permission) return true;
      return evaluateUserPermission(user, permission);
    },
    [user],
  );

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'commands' | 'activity'>(initialMode);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Sub-dialog triggers
  const [actionModal, setActionModal] = useState<ActionModalType>(null);
  const [actionEntityType, setActionEntityType] = useState<EntityType>('shot');
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isDbInspectorOpen, setIsDbInspectorOpen] = useState(false);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setActiveTab(initialMode);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialMode]);

  // Global Escape key handler when Command Palette is open
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, onClose]);

  // Handle Action launch helper
  const openAction = (type: ActionModalType, targetEntityType: EntityType = 'shot') => {
    setActionEntityType(targetEntityType);
    setActionModal(type);
  };

  // Commands List (respects permissions)
  const commandsList = useMemo<CommandItem[]>(() => {
    return [
      // --- CREATE COMMANDS ---
      {
        id: 'cmd-create-client',
        title: 'Create Client',
        subtitle: 'Onboard film studio, distributor, or production company',
        category: 'Create',
        icon: Briefcase,
        permission: 'client.create',
        action: () => openAction('create_entity', 'client'),
        keywords: ['client', 'studio', 'partner', 'wb', 'netflix', 'disney'],
      },
      {
        id: 'cmd-create-vendor',
        title: 'Create Vendor',
        subtitle: 'Register external FX partner, boutique, or outsource house',
        category: 'Create',
        icon: Users,
        permission: 'vendor.create',
        action: () => openAction('create_entity', 'vendor'),
        keywords: ['vendor', 'outsource', 'contractor', 'partner', 'fx'],
      },
      {
        id: 'cmd-add-person',
        title: 'Add Person',
        subtitle: 'Add crew member, lead artist, or supervisor to studio',
        category: 'Create',
        icon: Users,
        permission: 'people.create',
        action: () => openAction('create_entity', 'person'),
        keywords: ['person', 'user', 'artist', 'crew', 'invite', 'member', 'roster'],
      },
      {
        id: 'cmd-create-dept',
        title: 'Create Department',
        subtitle: 'Setup functional studio department (Lighting, Comp, FX, Pipeline)',
        category: 'Create',
        icon: Workflow,
        permission: 'department.create',
        action: () => openAction('create_entity', 'department'),
        keywords: ['department', 'division', 'lighting', 'comp', 'fx', 'art'],
      },
      {
        id: 'cmd-create-team',
        title: 'Create Team',
        subtitle: 'Assemble specialized artist squad for sequence delivery',
        category: 'Create',
        icon: Users,
        permission: 'team.create',
        action: () => openAction('create_entity', 'team'),
        keywords: ['team', 'squad', 'group', 'crew', 'create'],
      },
      {
        id: 'cmd-create-office',
        title: 'Create Office',
        subtitle: 'Register geographic studio facility or remote hub',
        category: 'Create',
        icon: MapPin,
        permission: 'office.create',
        action: () => openAction('create_entity', 'office'),
        keywords: ['office', 'location', 'site', 'branch', 'facility', 'london', 'vancouver'],
      },
      {
        id: 'cmd-create-project',
        title: 'Create Project',
        subtitle: 'Initialize show repository with OpenUSD & ACES pipeline',
        category: 'Create',
        icon: Film,
        permission: 'project.create',
        action: () => openAction('create_entity', 'project'),
        keywords: ['project', 'show', 'film', 'series', 'commercial', 'init'],
      },
      {
        id: 'cmd-create-shot',
        title: 'Create Shot',
        subtitle: 'Add new sequence shot with frame range and cut orders',
        category: 'Create',
        icon: Clapperboard,
        permission: 'shot.create',
        action: () => openAction('create_entity', 'shot'),
        keywords: ['shot', 'sequence', 'cut', 'plate', 'create'],
      },
      {
        id: 'cmd-create-asset',
        title: 'Create Asset',
        subtitle: 'Register USD asset layer (Character, Prop, Environment)',
        category: 'Create',
        icon: Box,
        permission: 'asset.create',
        action: () => openAction('create_entity', 'asset'),
        keywords: ['asset', 'model', 'usd', 'prop', 'environment', 'character'],
      },
      {
        id: 'cmd-create-sequence',
        title: 'Create Sequence',
        subtitle: 'Group related shots under a narrative sequence header',
        category: 'Create',
        icon: Layers,
        permission: 'sequence.create',
        action: () => openAction('create_entity', 'shot'),
        keywords: ['sequence', 'seq', 'scene', 'act', 'create'],
      },
      {
        id: 'cmd-create-task',
        title: 'Create Task',
        subtitle: 'Assign task milestone with department budget hours',
        category: 'Create',
        icon: CheckSquare,
        permission: 'task.create',
        action: () => openAction('create_entity', 'task'),
        keywords: ['task', 'assignment', 'todo', 'milestone', 'hours'],
      },
      {
        id: 'cmd-submit-version',
        title: 'Submit Version',
        subtitle: 'Publish OpenUSD stage or EXR render sequence for review',
        category: 'Create',
        icon: History,
        permission: 'version.create',
        action: () => openAction('create_entity', 'asset'),
        keywords: ['submit', 'version', 'publish', 'render', 'exr', 'usd'],
      },
      {
        id: 'cmd-approve-review',
        title: 'Approve Review Item',
        subtitle: 'Grant supervisor or client sign-off on active screening item',
        category: 'Actions',
        icon: CheckCircle2,
        permission: 'review.approve',
        action: () => openAction('change_status', 'shot'),
        keywords: ['approve', 'signoff', 'review', 'supervisor', 'client'],
      },
      {
        id: 'cmd-create-delivery',
        title: 'Create Delivery Package',
        subtitle: 'Bundle approved media and initiate Aspera/Fasp dispatch',
        category: 'Create',
        icon: Sparkles,
        permission: 'delivery.create',
        action: () => {
          navigate('/deliveries');
          onClose();
        },
        keywords: ['delivery', 'package', 'aspera', 'client', 'turnover', 'dispatch'],
      },

      // --- NAVIGATE COMMANDS ---
      {
        id: 'cmd-nav-client',
        title: 'Open Clients',
        subtitle: 'View client studios, contacts, and contracted shows',
        category: 'Navigation',
        icon: Briefcase,
        shortcut: 'G C',
        permission: 'client.view',
        action: () => {
          navigate('/clients');
          onClose();
        },
        keywords: ['clients', 'studios', 'wb', 'netflix', 'producers'],
      },
      {
        id: 'cmd-nav-vendor',
        title: 'Open Vendors',
        subtitle: 'Manage outsource FX vendor roster and capacity',
        category: 'Navigation',
        icon: Users,
        shortcut: 'G V',
        permission: 'vendor.view',
        action: () => {
          navigate('/vendors');
          onClose();
        },
        keywords: ['vendors', 'outsource', 'partners', 'bidding'],
      },
      {
        id: 'cmd-nav-project',
        title: 'Open Projects',
        subtitle: 'Browse all production shows, schedules, and budgets',
        category: 'Navigation',
        icon: Film,
        shortcut: 'G P',
        permission: 'project.view',
        action: () => {
          navigate('/projects');
          onClose();
        },
        keywords: ['projects', 'shows', 'films', 'portfolio'],
      },
      {
        id: 'cmd-nav-shot',
        title: 'Open Shots',
        subtitle: 'Explore shot grids, cuts, plate turnovers, and dailies',
        category: 'Navigation',
        icon: Clapperboard,
        shortcut: 'G S',
        permission: 'shot.view',
        action: () => {
          navigate('/shots');
          onClose();
        },
        keywords: ['shots', 'sequences', 'cuts', 'plates'],
      },
      {
        id: 'cmd-nav-asset',
        title: 'Open Assets',
        subtitle: 'Inspect OpenUSD stage assets, materials, and schemas',
        category: 'Navigation',
        icon: Box,
        shortcut: 'G A',
        permission: 'asset.view',
        action: () => {
          navigate('/assets');
          onClose();
        },
        keywords: ['assets', 'usd', 'openusd', 'models', 'props'],
      },
      {
        id: 'cmd-nav-task',
        title: 'Open Tasks',
        subtitle: 'Production workboard, time logging, and crew burndown',
        category: 'Navigation',
        icon: CheckSquare,
        shortcut: 'G T',
        permission: 'task.view',
        action: () => {
          navigate('/tasks');
          onClose();
        },
        keywords: ['tasks', 'board', 'kanban', 'workload', 'burndown'],
      },
      {
        id: 'cmd-nav-version',
        title: 'Open Versions',
        subtitle: 'Review published OpenUSD and EXR render versions',
        category: 'Navigation',
        icon: PlaySquare,
        permission: 'version.view',
        action: () => {
          navigate('/assets');
          onClose();
        },
        keywords: ['versions', 'publishes', 'exr', 'renders', 'usd'],
      },
      {
        id: 'cmd-nav-review',
        title: 'Open Reviews',
        subtitle: 'Synchronized screening room, annotations, and client signoff',
        category: 'Navigation',
        icon: PlaySquare,
        shortcut: 'G R',
        permission: 'review.view',
        action: () => {
          navigate('/reviews');
          onClose();
        },
        keywords: ['reviews', 'dailies', 'screening', 'notes', 'annotations'],
      },
      {
        id: 'cmd-nav-activity',
        title: 'Open Activity & Audit Hub',
        subtitle: 'Full enterprise activity timeline, before/after diffs & compliance',
        category: 'Audit',
        icon: Activity,
        shortcut: 'G L',
        permission: 'audit.view',
        action: () => {
          navigate('/audit?tab=activity');
          onClose();
        },
        keywords: ['activity', 'audit', 'logs', 'compliance', 'diff', 'history'],
      },
      ...(isAdmin
        ? [
            {
              id: 'cmd-nav-perm-matrix',
              title: 'Access & RBAC Workspace',
              subtitle: 'Roles, groups and permission grants (Admin Only)',
              category: 'System' as const,
              icon: ShieldCheck,
              shortcut: '⌘ Shift P',
              action: () => {
                navigate('/access');
              },
              keywords: ['permissions', 'rbac', 'roles', 'matrix', 'access', 'security'],
            },
          ]
        : []),
      {
        id: 'cmd-sys-db-inspector',
        title: 'Database Inspector & Storage',
        subtitle: 'View IndexedDB storage, stats, export JSON snapshot, or reset seed data',
        category: 'System' as const,
        icon: Database,
        permission: 'platform.admin.view',
        action: () => {
          setIsDbInspectorOpen(true);
        },
        keywords: ['database', 'db', 'storage', 'reset', 'backup', 'export', 'import', 'persistence'],
      },
      // --- ACTIONS COMMANDS ---
      {
        id: 'cmd-action-assign-project',
        title: 'Assign Project',
        subtitle: 'Allocate project show to lead supervisor or client rep',
        category: 'Actions',
        icon: Briefcase,
        permission: 'project.update',
        action: () => openAction('assign_project', 'project'),
        keywords: ['assign', 'project', 'lead', 'supervisor'],
      },
      {
        id: 'cmd-action-assign-team',
        title: 'Assign Team',
        subtitle: 'Deploy specialized artist squad to active project',
        category: 'Actions',
        icon: Users,
        permission: 'team.update',
        action: () => openAction('assign_team', 'team'),
        keywords: ['assign', 'team', 'squad', 'deploy'],
      },
      {
        id: 'cmd-action-archive',
        title: 'Archive Entity',
        subtitle: 'Move active record or shot to cold storage archive',
        category: 'Actions',
        icon: Box,
        permission: 'shot.archive',
        action: () => openAction('archive_entity', 'shot'),
        keywords: ['archive', 'freeze', 'cold', 'store', 'remove'],
      },
      {
        id: 'cmd-action-restore',
        title: 'Restore Entity',
        subtitle: 'Reactivate archived shot, asset, or team record',
        category: 'Actions',
        icon: ArrowUpDown,
        permission: 'shot.update',
        action: () => openAction('restore_entity', 'shot'),
        keywords: ['restore', 'unarchive', 'reactivate', 'bring back'],
      },
      {
        id: 'cmd-action-change-status',
        title: 'Change Status',
        subtitle: 'Update production status (e.g. In Progress ➔ Approved)',
        category: 'Actions',
        icon: CheckCircle2,
        permission: 'shot.update',
        action: () => openAction('change_status', 'shot'),
        keywords: ['status', 'state', 'approve', 'progress', 'review'],
      },
      {
        id: 'cmd-action-toggle-theme',
        title: `Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: 'Toggle UI color theme',
        category: 'System',
        icon: themeMode === 'dark' ? Sun : Moon,
        action: () => {
          toggleTheme();
          addNotification({
            title: 'Theme Updated',
            message: `Switched theme to ${themeMode === 'dark' ? 'Light' : 'Dark'} Mode`,
            type: 'info',
          });
          onClose();
        },
        keywords: ['theme', 'dark', 'light', 'mode', 'color'],
      },
      {
        id: 'cmd-action-shortcuts',
        title: 'View Keyboard Shortcuts Cheat Sheet',
        subtitle: 'Display complete list of StudioHub shortcut keys',
        category: 'System',
        icon: HelpCircle,
        shortcut: '?',
        action: () => {
          setIsShortcutsOpen(true);
        },
        keywords: ['shortcuts', 'hotkeys', 'cheat sheet', 'help', 'keyboard'],
      },
    ];
  }, [themeMode, toggleTheme, addNotification, navigate, onClose, isAdmin]);

  // Filter commands by query and permissions
  const filteredCommands = useMemo(() => {
    const q = query.toLowerCase().trim();
    return commandsList.filter((cmd) => {
      // Permission check
      if (cmd.permission && !canRunCommand(cmd.permission)) {
        return false;
      }
      if (!q) return true;
      const matchTitle = cmd.title.toLowerCase().includes(q);
      const matchSubtitle = cmd.subtitle?.toLowerCase().includes(q);
      const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(q));
      return matchTitle || matchSubtitle || matchKeywords;
    });
  }, [query, commandsList, canRunCommand]);

  // Combined selectable items based on activeTab
  // Recent Activity surfaces the full platform activity store.
  const orgActivities = useMemo(() => activities, [activities]);
  const visibleItems = useMemo(() => {
    if (activeTab === 'commands') {
      return filteredCommands.map((c) => ({
        type: 'command' as const,
        item: c,
      }));
    }

    if (activeTab === 'activity') {
      return orgActivities.slice(0, 15).map((a) => ({
        type: 'activity' as const,
        item: a,
      }));
    }

    // Tab: 'all'
    return filteredCommands.slice(0, 8).map((c) => ({
      type: 'command' as const,
      item: c,
    }));
  }, [activeTab, filteredCommands, orgActivities]);

  // Reset selected index when visible items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeTab]);

  // Execute selected item
  const executeItem = (item: (typeof visibleItems)[0]) => {
    if (!item) return;

    if (item.type === 'command') {
      const cmd = item.item as CommandItem;
      // Check permission (defense-in-depth; display is already filtered)
      if (cmd.permission && !canRunCommand(cmd.permission)) {
        addNotification({
          title: 'Permission Denied',
          message: `Requires ${cmd.permission} permission. Switched role simulation in permissions matrix to test.`,
          type: 'warning',
        });
        return;
      }
      cmd.action();
      if (cmd.category !== 'System') {
        onClose();
      }
    } else if (item.type === 'activity') {
      onClose();
      navigate('/audit?tab=activity');
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < visibleItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : visibleItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (visibleItems[selectedIndex]) {
        executeItem(visibleItems[selectedIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const tabs: ('all' | 'commands' | 'activity')[] = ['all', 'commands', 'activity'];
      const nextTab = tabs[(tabs.indexOf(activeTab) + 1) % tabs.length];
      setActiveTab(nextTab);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 ring-1 ring-slate-700/50"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Search Input Bar */}
          <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/90 flex items-center gap-3">
            <Search className="w-5 h-5 text-cyan-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search commands, pages, and system actions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-hidden font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-800">
              <button
                type="button"
                onClick={onClose}
                title="Close search (Esc)"
                className="cursor-pointer"
              >
                <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200 transition-colors">
                  ESC
                </kbd>
              </button>
            </div>
          </div>

          {/* Mode Tabs & Category Pills */}
          <div className="px-3 sm:px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
            {/* Primary Mode Tabs */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'all'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('commands')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
                  activeTab === 'commands'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <CommandIcon className="w-3 h-3" />
                <span>Commands ({filteredCommands.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
                  activeTab === 'activity'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Activity className="w-3 h-3" />
                <span>Recent Activity</span>
              </button>
            </div>

            {/* Quick RBAC Role Pill Indicator (Admin Only) */}
            {isAdmin && (
              <span
                className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300"
                title="Active role"
              >
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span>Role: {currentRole?.name || 'Administrator'}</span>
                <span className="text-[9px] text-cyan-300 font-semibold px-1 rounded bg-cyan-500/10 border border-cyan-500/20">Admin</span>
              </span>
            )}
          </div>

          {/* Results List */}
          <div
            ref={listContainerRef}
            className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 max-h-[460px]"
          >
            {visibleItems.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">No matching commands</p>
                <p className="text-xs text-slate-500 mt-1">
                  Try checking your spelling or search for an action, page, or system command.
                </p>
              </div>
            ) : (
              visibleItems.map((entry, index) => {
                const isSelected = index === selectedIndex;

                // Render Command Result
                if (entry.type === 'command') {
                  const cmd = entry.item as CommandItem;
                  const Icon = cmd.icon;
                  // Single evaluation engine for display and execution:
                  // canRunCommand owns the superuser / platform / org-owner
                  // rules (ADR-0033), so the lock badge can never disagree
                  // with the permission filter above.
                  const isAllowed = cmd.permission ? canRunCommand(cmd.permission) : true;

                  return (
                    <div
                      key={`cmd-${cmd.id}-${index}`}
                      onClick={() => executeItem(entry)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        !isAllowed
                          ? 'opacity-60 bg-slate-950/40 hover:bg-slate-900/60'
                          : isSelected
                          ? 'bg-cyan-600/20 border border-cyan-500/40 text-slate-100 shadow-2xs'
                          : 'hover:bg-slate-800/40 text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                            isAllowed
                              ? 'bg-slate-800 border-slate-700 text-cyan-300'
                              : 'bg-rose-950/20 border-rose-900/30 text-rose-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-100">
                              {cmd.title}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {cmd.category}
                            </span>

                            {/* Permission lock indicator if denied */}
                            {!isAllowed && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950/40 text-rose-300 border border-rose-800/40"
                                title={`Gated by permission: ${cmd.permission}`}
                              >
                                <Lock className="w-2.5 h-2.5" />
                                <span>{cmd.permission}</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-400 mt-0.5 truncate">
                            {cmd.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {cmd.shortcut && (
                          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {cmd.shortcut}
                          </kbd>
                        )}
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  );
                }

                // 3. Render Activity Result
                if (entry.type === 'activity') {
                  const act = entry.item as (typeof activities)[0];

                  return (
                    <div
                      key={`act-${act.id}-${index}`}
                      onClick={() => executeItem(entry)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-indigo-600/20 border border-indigo-500/40 text-slate-100 shadow-sm'
                          : 'hover:bg-slate-800/40 text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-100">
                              {act.actionLabel}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                              {act.entity.code || act.entity.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              by {act.actor.name}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {act.description}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                }

                return null;
              })
            )}
          </div>

          {/* Footer Guide & Controls */}
          <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">↓</kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">↵</kbd>
                <span>Execute</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">TAB</kbd>
                <span>Switch Tab</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsShortcutsOpen(true)}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Shortcuts</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Dialogs */}
      <ActionDispatcherModal
        type={actionModal}
        entityType={actionEntityType}
        isOpen={!!actionModal}
        onClose={() => setActionModal(null)}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </>
  );
};
