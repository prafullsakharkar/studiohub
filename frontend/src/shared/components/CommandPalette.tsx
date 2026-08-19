import React, { useState, useEffect, useRef } from 'react';
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
  UserCheck,
  ArrowRight,
  Sparkles,
  Layers,
  Terminal,
  Activity,
  X,
  Building2,
  Briefcase,
  Share2,
  Users,
  Users2,
  MapPin,
  History,
  Bell,
  CreditCard,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useThemeMode } from '@/providers/ThemeProvider';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Organization' | 'Shots & Cuts' | 'OpenUSD Assets' | 'Dailies & Reviews' | 'Quick Actions' | 'User Role';
  icon: React.ElementType;
  badge?: string;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { mode, setMode, toggleTheme } = useThemeMode();
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      subtitle: 'Production KPIs, Farm Load & Recent Dailies',
      category: 'Navigation',
      icon: Layers,
      action: () => {
        navigate('/dashboard');
        onClose();
      },
    },
    {
      id: 'nav-organizations',
      title: 'Go to Studio Organizations',
      subtitle: 'Multi-tenant studio divisions & storage quotas',
      category: 'Organization',
      icon: Building2,
      shortcut: 'G O',
      action: () => {
        navigate('/organizations');
        onClose();
      },
    },
    {
      id: 'nav-clients',
      title: 'Go to Client Studios',
      subtitle: 'Major studios, producers, and client review access',
      category: 'Organization',
      icon: Briefcase,
      shortcut: 'G C',
      action: () => {
        navigate('/clients');
        onClose();
      },
    },
    {
      id: 'nav-vendors',
      title: 'Go to Vendors & Outsourcing Partners',
      subtitle: 'Roto, paint, and sim facilities with secure turnover',
      category: 'Organization',
      icon: Share2,
      shortcut: 'G V',
      action: () => {
        navigate('/vendors');
        onClose();
      },
    },
    {
      id: 'nav-people',
      title: 'Go to Studio Crew & People',
      subtitle: 'Supervisors, leads, technical directors & artists',
      category: 'Organization',
      icon: Users,
      shortcut: 'G P',
      action: () => {
        navigate('/people');
        onClose();
      },
    },
    {
      id: 'nav-departments',
      title: 'Go to Production Departments',
      subtitle: 'Discipline leads, member counts, and DCC software stacks',
      category: 'Organization',
      icon: Layers,
      action: () => {
        navigate('/departments');
        onClose();
      },
    },
    {
      id: 'nav-teams',
      title: 'Go to Production Teams & Squads',
      subtitle: 'Hero milestone squads and assigned show units',
      category: 'Organization',
      icon: Users2,
      action: () => {
        navigate('/teams');
        onClose();
      },
    },
    {
      id: 'nav-offices',
      title: 'Go to Global Offices & Facilities',
      subtitle: 'Montreal, London, Vancouver, Mumbai, Tokyo sites',
      category: 'Organization',
      icon: MapPin,
      action: () => {
        navigate('/offices');
        onClose();
      },
    },
    {
      id: 'nav-projects',
      title: 'Go to Productions & Projects',
      subtitle: 'Active shows, delivery dates, color formats',
      category: 'Navigation',
      icon: Film,
      action: () => {
        navigate('/projects');
        onClose();
      },
    },
    {
      id: 'nav-shots',
      title: 'Go to Shots & Sequences',
      subtitle: 'Cut list, frame boundaries & discipline matrix',
      category: 'Navigation',
      icon: Clapperboard,
      shortcut: 'G S',
      action: () => {
        navigate('/shots');
        onClose();
      },
    },
    {
      id: 'nav-assets',
      title: 'Go to OpenUSD Asset Hub',
      subtitle: 'LOD tiers, polygon telemetry, DCC exports',
      category: 'Navigation',
      icon: Box,
      shortcut: 'G A',
      action: () => {
        navigate('/assets');
        onClose();
      },
    },
    {
      id: 'nav-tasks',
      title: 'Go to Tasks & Kanban Board',
      subtitle: 'Discipline queue, assignments & turnaround',
      category: 'Navigation',
      icon: CheckSquare,
      shortcut: 'G T',
      action: () => {
        navigate('/tasks');
        onClose();
      },
    },
    {
      id: 'nav-versions',
      title: 'Go to Published Versions & Payloads',
      subtitle: 'OpenUSD stages and multi-channel EXR sequences',
      category: 'Navigation',
      icon: History,
      action: () => {
        navigate('/versions');
        onClose();
      },
    },
    {
      id: 'nav-reviews',
      title: 'Go to Screening Room Dailies',
      subtitle: 'Frame scrubber, A/B wipe & visual annotations',
      category: 'Navigation',
      icon: PlaySquare,
      badge: '3 Pending',
      shortcut: 'G R',
      action: () => {
        navigate('/reviews');
        onClose();
      },
    },
    {
      id: 'nav-notifications',
      title: 'Go to Notifications & Alerts',
      subtitle: 'Production dispatch alerts and farm warnings',
      category: 'Navigation',
      icon: Bell,
      action: () => {
        navigate('/notifications');
        onClose();
      },
    },
    {
      id: 'nav-reports',
      title: 'Go to Production Reports & Bids Audit',
      subtitle: 'Bids vs actuals, delivery readiness and farm metrics',
      category: 'Navigation',
      icon: FileText,
      action: () => {
        navigate('/reports');
        onClose();
      },
    },
    {
      id: 'nav-billing',
      title: 'Go to Studio Billing & Quotas',
      subtitle: 'Render farm credits, storage limits & seat licensing',
      category: 'Navigation',
      icon: CreditCard,
      action: () => {
        navigate('/billing');
        onClose();
      },
    },
    {
      id: 'nav-audit',
      title: 'Go to Security & Audit Trail',
      subtitle: 'SOC2 immutable pipeline log & supervisor signs',
      category: 'Navigation',
      icon: ShieldCheck,
      action: () => {
        navigate('/audit');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      title: 'Go to Pipeline & OCIO Settings',
      subtitle: 'ACES 1.3/2.0, OpenUSD resolver & Deadline farm',
      category: 'Navigation',
      icon: Sliders,
      action: () => {
        navigate('/settings');
        onClose();
      },
    },

    // Shots & Cuts
    {
      id: 'shot-nk-010-010',
      title: 'Shot: NK_010_010',
      subtitle: 'Neon Skyline establishing flyover (1001-1120 / ACEScg)',
      category: 'Shots & Cuts',
      icon: Clapperboard,
      badge: 'Approved',
      action: () => {
        navigate('/shots');
        onClose();
      },
    },
    {
      id: 'shot-nk-010-020',
      title: 'Shot: NK_010_020',
      subtitle: 'Titanium Mech Landing Shockwave FX (1001-1096)',
      category: 'Shots & Cuts',
      icon: Clapperboard,
      badge: 'Pending Review',
      action: () => {
        navigate('/shots');
        onClose();
      },
    },
    {
      id: 'shot-nk-020-050',
      title: 'Shot: NK_020_050',
      subtitle: 'Laser shield deflection sparks & fluid steam (1001-1145)',
      category: 'Shots & Cuts',
      icon: Clapperboard,
      badge: 'In Progress',
      action: () => {
        navigate('/shots');
        onClose();
      },
    },

    // OpenUSD Assets
    {
      id: 'asset-hero-mech',
      title: 'Asset: Hero_Titan_Mech_Arm',
      subtitle: 'Character Prop / 1.45M Polys / LOD0-LOD2 USD schema',
      category: 'OpenUSD Assets',
      icon: Box,
      badge: 'v004 Published',
      action: () => {
        navigate('/assets');
        onClose();
      },
    },
    {
      id: 'asset-cyber-city',
      title: 'Asset: Cyber_Metropolis_Block_B',
      subtitle: 'Environment Set / 8.2M Polys / Houdini Procedural',
      category: 'OpenUSD Assets',
      icon: Box,
      badge: 'v002 Approved',
      action: () => {
        navigate('/assets');
        onClose();
      },
    },

    // Quick Actions
    {
      id: 'action-theme-toggle',
      title: `Switch Theme to ${mode === 'dark' ? 'Light' : 'Dark'} Mode`,
      subtitle: 'Toggle Material UI & Tailwind theme palette',
      category: 'Quick Actions',
      icon: mode === 'dark' ? Sun : Moon,
      action: () => {
        toggleTheme();
        addNotification({
          type: 'info',
          title: 'Theme Updated',
          message: `Switched interface mode to ${mode === 'dark' ? 'Light' : 'Dark'}.`,
        });
        onClose();
      },
    },
    {
      id: 'action-farm-dispatch',
      title: 'Quick Dispatch: Re-queue Failed Render Farm Tasks',
      subtitle: 'AWS Thinkbox Deadline 10.3 / 12 Blade re-allocation',
      category: 'Quick Actions',
      icon: Activity,
      action: () => {
        addNotification({
          type: 'success',
          title: 'Render Farm Dispatched',
          message: 'Re-queued 4 failed EXR tile frames to idle farm blade group.',
        });
        onClose();
      },
    },

    // Role simulation
    {
      id: 'role-supervisor',
      title: 'Switch Role: VFX Supervisor (Marcus Vance)',
      subtitle: 'supervisor@studiohub.vfx • Full sign-off authority and OCIO lock',
      category: 'User Role',
      icon: UserCheck,
      action: () => {
        login({ email: 'supervisor@studiohub.vfx', password: 'password123', rememberMe: true });
        addNotification({
          type: 'success',
          title: 'Active Persona Switched',
          message: 'Logged in as Dr. Marcus Vance (VFX Supervisor)',
        });
        onClose();
      },
    },
    {
      id: 'role-admin',
      title: 'Switch Role: Platform Admin (System Root)',
      subtitle: 'admin@studiohub.vfx • Full workspace, farm, and security settings',
      category: 'User Role',
      icon: UserCheck,
      action: () => {
        login({ email: 'admin@studiohub.vfx', password: 'password123', rememberMe: true });
        addNotification({
          type: 'success',
          title: 'Active Persona Switched',
          message: 'Logged in as Platform Admin (System Root)',
        });
        onClose();
      },
    },
    {
      id: 'role-lead-artist',
      title: 'Switch Role: Lead Lighting & Comp Artist (Elena Rostova)',
      subtitle: 'lead@studiohub.vfx • Asset publishing, lookdev versions, and task submissions',
      category: 'User Role',
      icon: UserCheck,
      action: () => {
        login({ email: 'lead@studiohub.vfx', password: 'password123', rememberMe: true });
        addNotification({
          type: 'success',
          title: 'Active Persona Switched',
          message: 'Logged in as Elena Rostova (Lead Artist)',
        });
        onClose();
      },
    },
    {
      id: 'role-client',
      title: 'Switch Role: Client / Studio Executive (Rachel Hayes)',
      subtitle: 'client@studiohub.vfx • Screening room approval, notes & read-only matrix',
      category: 'User Role',
      icon: UserCheck,
      action: () => {
        login({ email: 'client@studiohub.vfx', password: 'password123', rememberMe: true });
        addNotification({
          type: 'success',
          title: 'Active Persona Switched',
          message: 'Logged in as Rachel Hayes (Client Executive)',
        });
        onClose();
      },
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase())) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  if (!isOpen) return null;

  // Group items by category
  const groupedCategories = Array.from(new Set(filteredItems.map((item) => item.category)));

  let globalIndexCounter = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150">
        {/* Search input header */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <Search className="w-4 h-4 text-indigo-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, shot code, asset, or role to switch..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300 p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div className="overflow-y-auto p-2 custom-scrollbar space-y-4">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No commands or pipeline items found matching "{query}"
            </div>
          ) : (
            groupedCategories.map((category) => {
              const categoryItems = filteredItems.filter((item) => item.category === category);
              return (
                <div key={category} className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold font-mono uppercase tracking-wider text-indigo-400">
                    {category}
                  </div>
                  {categoryItems.map((item) => {
                    globalIndexCounter += 1;
                    const isSelected = globalIndexCounter === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(globalIndexCounter)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-600/20 text-white border border-indigo-500/40 shadow-xs'
                            : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate text-white">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-[11px] text-slate-400 truncate">{item.subtitle}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {item.badge && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                              {item.badge}
                            </span>
                          )}
                          {item.shortcut && (
                            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 rounded border border-slate-700">
                              {item.shortcut}
                            </kbd>
                          )}
                          {isSelected && <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center space-x-3">
            <span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">↑</kbd>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 ml-1">↓</kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">↵</kbd>{' '}
              Select
            </span>
          </div>
          <span className="text-slate-500">Linear / ftrack Precision Dispatch</span>
        </div>
      </div>
    </div>
  );
};
