import { User, DemoUser } from '@/types/identity';

/**
 * Derives badge styling and role presentation for demo users dynamically based on their role and permissions.
 */
export function getRoleBadgeColor(role: string, isSuperuser?: boolean): string {
  const rLower = (role || '').toLowerCase();
  if (isSuperuser || rLower.includes('platform admin') || rLower.includes('platform_admin')) {
    return 'bg-rose-950/60 text-rose-300 border-rose-800/60';
  }
  if (rLower.includes('owner')) {
    return 'bg-amber-950/60 text-amber-300 border-amber-800/60';
  }
  if (rLower.includes('org') && rLower.includes('admin')) {
    return 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60';
  }
  if (rLower.includes('client')) {
    return 'bg-teal-950/60 text-teal-300 border-teal-800/60';
  }
  if (rLower.includes('pipeline') || rLower.includes('td')) {
    return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
  }
  if (rLower.includes('coordinator')) {
    return 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60';
  }
  if (rLower.includes('supervisor')) {
    return 'bg-amber-950/60 text-amber-300 border-amber-800/60';
  }
  if (rLower.includes('lead')) {
    return 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800/60';
  }
  if (rLower.includes('artist')) {
    return 'bg-purple-950/60 text-purple-300 border-purple-800/60';
  }
  if (rLower.includes('vendor')) {
    return 'bg-blue-950/60 text-blue-300 border-blue-800/60';
  }
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

/**
 * Derives the role subtitle / organization affiliation dynamically from the user record.
 */
export function getDemoUserSubtitle(user: User): string {
  const rLower = (user.role || '').toLowerCase();
  if (user.is_superuser || rLower.includes('platform admin')) {
    return 'StudioHub Global Infrastructure • Super Admin';
  }
  if (rLower.includes('client')) {
    return `${user.organization_name || 'Warner Nexus Studios'} • Client Executive Approval Portal`;
  }
  if (rLower.includes('vendor')) {
    return `${user.organization_name || 'CineMatrix VFX'} • External Partner Vendor Workspace`;
  }
  if (rLower.includes('pipeline') || rLower.includes('td')) {
    return `${user.organization_name || 'Apex Digital Studios'} • CI/CD, DCC Plugins & Automation`;
  }
  if (rLower.includes('coordinator')) {
    return `${user.organization_name || 'Apex Digital Studios'} • Shot Scheduling, Turnover & Bids`;
  }
  if (rLower.includes('supervisor')) {
    return `${user.organization_name || 'Apex Digital Studios'} • Executive Supervision & Creative`;
  }
  if (rLower.includes('lead artist') || rLower.includes('lead')) {
    return `${user.organization_name || 'Apex Digital Studios'} • 3D Modeling Lead & Internal Review`;
  }
  if (rLower.includes('artist')) {
    return `${user.organization_name || 'Apex Digital Studios'} • Modeling & Asset DCC Workspace`;
  }
  if (rLower.includes('org') && rLower.includes('admin')) {
    return `${user.organization_name || 'Apex Digital Studios'} • Studio Operations & Quotas`;
  }
  return `${user.organization_name || 'StudioHub'} • ${user.department || user.role || 'Crew'}`;
}

/**
 * Transforms a raw database User record into a frontend DemoUser representation.
 */
export function formatDemoUser(user: User): DemoUser {
  const name =
    user.full_name ||
    (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.name) ||
    user.email.split('@')[0];

  const role = user.role || 'Crew Member';
  const roleBadgeColor = getRoleBadgeColor(role, user.is_superuser);
  const subtitle = getDemoUserSubtitle(user);

  return {
    id: user.id,
    email: user.email,
    roleType: role,
    name,
    roleBadge: role,
    roleBadgeColor,
    subtitle,
    avatarUrl:
      user.avatar_url ||
      user.avatar ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  };
}
