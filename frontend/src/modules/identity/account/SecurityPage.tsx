import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mfaApi } from '@/api/identity/mfa';
import type { MfaReauth } from '@/api/identity/mfa';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { MfaEnrollmentPanel } from '@/modules/auth/components/MfaEnrollmentPanel';
import { useAuth } from '@/modules/auth';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Table, formatDate } from '../components/ui';
import { ReauthDialog } from './ReauthDialog';

const mfaKeys = { config: ['identity-mfa', 'config'] as const, recovery: ['identity-mfa', 'recovery'] as const, devices: ['identity-mfa', 'devices'] as const };

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section aria-label={title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 max-w-2xl">
    <h3 className="text-sm font-bold text-white">{title}</h3>
    {children}
  </section>
);

const TrustedDevices: React.FC = () => {
  const queryClient = useQueryClient();
  const canRevoke = useCan('identity.trusted_device.delete'); // listing works for everyone; revoking needs this (docs/sync Q-09)
  const devices = useQuery({ queryKey: mfaKeys.devices, queryFn: () => mfaApi.trustedDevices() });
  const [revoking, setRevoking] = useState<string | null>(null);

  return (
    <Card title="Trusted devices">
      <QueryBoundary
        isLoading={devices.isLoading}
        error={devices.error}
        onRetry={() => void devices.refetch()}
        entityName="trusted devices"
        isEmpty={(devices.data ?? []).length === 0}
        empty={{ title: 'No trusted devices', description: 'Devices you choose to remember at sign-in appear here.' }}
      >
        <Table label="Trusted devices" columns={['Browser', 'Platform', 'IP address', 'Last sign-in', '']}>
          {(devices.data ?? []).map((d) => (
            <tr key={d.id}>
              <td className="px-4 py-2 text-slate-200">{d.browser || 'Unknown'}</td>
              <td className="px-4 py-2 text-slate-300">{d.platform || '—'}</td>
              <td className="px-4 py-2 font-mono text-slate-400">{d.ip_address ?? '—'}</td>
              <td className="px-4 py-2 text-slate-400">{formatDate(d.last_login_at)}</td>
              <td className="px-4 py-2 text-right">
                {canRevoke && (
                  <button type="button" className="text-rose-400 hover:underline" aria-label={`Revoke ${d.browser || 'device'}`} onClick={() => setRevoking(d.id)}>
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </QueryBoundary>
      <ConfirmDialog
        isOpen={revoking !== null}
        title="Revoke trusted device"
        message="This device will ask for a code again at its next sign-in."
        confirmLabel="Revoke"
        destructive
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          await mfaApi.revokeTrustedDevice(revoking);
          await queryClient.invalidateQueries({ queryKey: mfaKeys.devices });
        }}
      />
    </Card>
  );
};

const RecoveryCodes: React.FC = () => {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: mfaKeys.recovery, queryFn: () => mfaApi.recoveryStatus() });
  const [regenerating, setRegenerating] = useState(false);
  const [issued, setIssued] = useState<string[] | null>(null);

  return (
    <Card title="Recovery codes">
      <QueryBoundary isLoading={status.isLoading} error={status.error} onRetry={() => void status.refetch()} entityName="recovery codes">
        <p className="text-xs text-slate-300">
          {status.data?.remaining ?? 0} unused recovery code{status.data?.remaining === 1 ? '' : 's'} left. Each signs you in once if you lose your authenticator.
        </p>
      </QueryBoundary>
      <Button size="sm" variant="outline" onClick={() => setRegenerating(true)}>
        Generate new codes
      </Button>

      <ReauthDialog
        isOpen={regenerating}
        title="Generate new recovery codes"
        description="This replaces all your current recovery codes. Confirm with your password and a code."
        submitLabel="Generate"
        onClose={() => setRegenerating(false)}
        onSubmit={async (reauth: MfaReauth) => {
          const result = await mfaApi.regenerateRecoveryCodes(reauth);
          setIssued(result.codes);
          await queryClient.invalidateQueries({ queryKey: mfaKeys.recovery });
        }}
      />
      <ConfirmDialog
        isOpen={issued !== null}
        title="Your new recovery codes"
        message={
          <div className="space-y-2">
            <p className="text-xs">Save these now; they are not shown again.</p>
            <ul aria-label="New recovery codes" className="grid grid-cols-2 gap-2 font-mono text-xs">
              {(issued ?? []).map((code, index) => (
                <li key={`${index}-${code}`} className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-center">
                  {code}
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" leftIcon={<Copy className="w-3.5 h-3.5" />} onClick={() => void navigator.clipboard?.writeText((issued ?? []).join('\n')).catch(() => undefined)}>
              Copy codes
            </Button>
          </div>
        }
        confirmLabel="I saved them"
        cancelLabel="Close"
        onClose={() => setIssued(null)}
        onConfirm={() => undefined}
      />
    </Card>
  );
};

export const SecurityPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const config = useQuery({ queryKey: mfaKeys.config, queryFn: () => mfaApi.config() });
  const [enrolling, setEnrolling] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const afterMfaChange = async () => {
    setEnrolling(false);
    await queryClient.invalidateQueries({ queryKey: ['identity-mfa'] });
    await refreshUser().catch(() => undefined);
  };

  return (
    <div className="space-y-5">
      <Card title="Password">
        <p className="text-xs text-slate-400">Changing your password signs you out of every device.</p>
        <Link to="/auth/change-password" className="inline-block text-xs font-semibold text-cyan-300 hover:underline">
          Change password
        </Link>
      </Card>

      <Card title="Two-factor authentication">
        <QueryBoundary isLoading={config.isLoading} error={config.error} onRetry={() => void config.refetch()} entityName="two-factor settings">
          {config.data?.enabled ? (
            <div className="space-y-3">
              <Badge variant="success">On</Badge>
              <p className="text-xs text-slate-400">Methods: {config.data.methods.join(', ') || 'authenticator app'}</p>
              <Button size="sm" variant="outline" onClick={() => setDisabling(true)}>
                Turn off
              </Button>
            </div>
          ) : enrolling ? (
            <MfaEnrollmentPanel onFinished={afterMfaChange} finishLabel="Done" />
          ) : (
            <div className="space-y-3">
              <Badge variant="neutral">Off</Badge>
              <p className="text-xs text-slate-400">Add a second step to sign-in with an authenticator app.</p>
              <Button size="sm" variant="primary" onClick={() => setEnrolling(true)}>
                Turn on
              </Button>
            </div>
          )}
        </QueryBoundary>
      </Card>

      {config.data?.enabled && <RecoveryCodes />}
      {config.data?.enabled && <TrustedDevices />}

      <ReauthDialog
        isOpen={disabling}
        title="Turn off two-factor authentication"
        description="Confirm with your password and a code. Your account will be less protected."
        submitLabel="Turn off"
        destructive
        onClose={() => setDisabling(false)}
        onSubmit={async (reauth) => {
          await mfaApi.disable(reauth);
          notify.success('Two-factor authentication is off.');
          await afterMfaChange();
        }}
      />
    </div>
  );
};
