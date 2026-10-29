import type React from 'react';
import { PageShell } from '../components/ui';

export const ACCOUNT_TABS = [
  { to: '/settings/account/profile', label: 'Profile' },
  { to: '/settings/account/security', label: 'Security' },
  { to: '/settings/account/sessions', label: 'Sessions' },
  { to: '/settings/account/tokens', label: 'Access tokens' },
] as const;

/** Frame for "My account": every section below it is about the signed-in user only. */
export const AccountLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PageShell title="My account" subtitle="Your profile, sign-in security, active sessions and personal access credentials." tabs={ACCOUNT_TABS}>
    {children}
  </PageShell>
);
