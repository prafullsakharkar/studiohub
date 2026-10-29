import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { sessionKeys, sessionsApi } from '@/api/identity/account';
import type { UserSession } from '@/api/identity/account';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Table, formatDate } from '../components/ui';
import { errorText } from '../errorText';

export const SessionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: sessionKeys.lists(), queryFn: ({ signal }) => sessionsApi.list(signal) });
  const [revoking, setRevoking] = useState<UserSession | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: sessionKeys.all });
  const others = (sessions.data ?? []).filter((s) => !s.is_current).length;

  const revoke = useMutation({
    mutationFn: (id: string) => sessionsApi.revoke(id),
    onSuccess: refresh,
    onError: (error) => notify.error(errorText(error)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">Everywhere you are signed in. Ending a session signs that device out.</p>
        <Button size="sm" variant="outline" disabled={others === 0} onClick={() => setRevokingOthers(true)}>
          Sign out everywhere else
        </Button>
      </div>

      <QueryBoundary
        isLoading={sessions.isLoading}
        error={sessions.error}
        onRetry={() => void sessions.refetch()}
        entityName="sessions"
        isEmpty={(sessions.data ?? []).length === 0}
        empty={{ title: 'No active sessions', description: 'There are no other sessions to show.' }}
      >
        <Table label="Sessions" columns={['Device', 'IP address', 'Started', 'Last active', 'Expires', '']}>
          {(sessions.data ?? []).map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2 text-slate-200">
                {s.user_agent || 'Unknown device'} {s.is_current && <Badge variant="success">This session</Badge>}
              </td>
              <td className="px-4 py-2 font-mono text-slate-400">{s.ip_address ?? '—'}</td>
              <td className="px-4 py-2 text-slate-400">{formatDate(s.created_at)}</td>
              <td className="px-4 py-2 text-slate-400">{formatDate(s.last_activity)}</td>
              <td className="px-4 py-2 text-slate-400">{formatDate(s.expires_at)}</td>
              <td className="px-4 py-2 text-right">
                {!s.is_current && (
                  <button type="button" className="text-rose-400 hover:underline" aria-label={`End session started ${formatDate(s.created_at)}`} onClick={() => setRevoking(s)}>
                    End
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </QueryBoundary>

      <ConfirmDialog
        isOpen={revoking !== null}
        title="End session"
        message="Sign this device out?"
        confirmLabel="End session"
        destructive
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (revoking) await revoke.mutateAsync(revoking.id);
        }}
      />
      <ConfirmDialog
        isOpen={revokingOthers}
        title="Sign out everywhere else"
        message="Every session except this one will be ended."
        confirmLabel="Sign out others"
        destructive
        onClose={() => setRevokingOthers(false)}
        onConfirm={async () => {
          const result = await sessionsApi.revokeAllOther();
          await refresh();
          notify.success(`${result.sessions} session(s) ended.`);
        }}
      />
    </div>
  );
};
