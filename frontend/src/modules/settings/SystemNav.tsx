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

/** Identity's directory (LDAP) settings sit beside them, for whoever holds identity.directory.manage (CR-40). */
const DIRECTORY_SECTION = { to: '/settings/system/directory', label: 'Directory (LDAP)' } as const;

/** The system-settings sections, above every system screen. Reading needs settings.view; changing needs settings.manage. */
export const SystemNav: React.FC = () => {
  const canView = useCan('settings.view');
  const canManage = useCan('settings.manage');
  const canDirectory = useCan('identity.directory.manage');
  if (!canView && !canDirectory) return null;
  const sections = [...(canView ? SYSTEM_SECTIONS : []), ...(canDirectory ? [DIRECTORY_SECTION] : [])];
  return (
    <nav aria-label="System settings sections" className="border-b border-slate-800 px-4 sm:px-6 pt-4">
      <div className="flex flex-wrap gap-1">
        {sections.map((section) => (
          <NavLink key={section.to} to={section.to} className={({ isActive }) => cn('px-3 py-2 text-xs font-semibold border-b-2', isActive ? 'text-cyan-300 border-cyan-400' : 'text-slate-400 border-transparent hover:text-slate-200')}>
            {section.label}
          </NavLink>
        ))}
      </div>
      {canView && !canManage && <p className="py-2 text-[11px] text-slate-500">You can read the system settings; changing them needs an administrator.</p>}
    </nav>
  );
};
