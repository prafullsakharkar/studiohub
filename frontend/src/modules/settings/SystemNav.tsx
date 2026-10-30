import type React from 'react';
import { NavLink } from 'react-router-dom';
import { useCan } from '@/core/permissions/useCan';
import { cn } from '@/shared/utils/cn';

export const SYSTEM_SECTIONS = [
  { to: '/settings/system/values', label: 'System settings' },
  { to: '/settings/system/flags', label: 'Feature flags' },
  { to: '/settings/system/themes', label: 'Themes' },
  { to: '/settings/system/localizations', label: 'Localizations' },
  { to: '/settings/system/categories', label: 'Categories' },
  { to: '/settings/system/definitions', label: 'Definitions' },
  { to: '/settings/system/tags', label: 'Tags' },
] as const;

/** The system-settings sections, above every system screen. Reading needs settings.view; changing needs settings.manage. */
export const SystemNav: React.FC = () => {
  const canView = useCan('settings.view');
  const canManage = useCan('settings.manage');
  if (!canView) return null;
  return (
    <nav aria-label="System settings sections" className="border-b border-slate-800 px-4 sm:px-6 pt-4">
      <div className="flex flex-wrap gap-1">
        {SYSTEM_SECTIONS.map((section) => (
          <NavLink key={section.to} to={section.to} className={({ isActive }) => cn('px-3 py-2 text-xs font-semibold border-b-2', isActive ? 'text-cyan-300 border-cyan-400' : 'text-slate-400 border-transparent hover:text-slate-200')}>
            {section.label}
          </NavLink>
        ))}
      </div>
      {!canManage && <p className="py-2 text-[11px] text-slate-500">You can read the system settings; changing them needs an administrator.</p>}
    </nav>
  );
};
