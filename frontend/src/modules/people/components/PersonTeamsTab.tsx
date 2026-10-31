import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { auditKeys } from '@/api/audit/audit';
import { peopleApi, teamMembershipsApi, teamsApi } from '@/api/masterdata/directory';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { fetchAllRows } from '@/shared/data/listing';

export interface PersonTeamsTabProps {
  personId: string;
  personName: string;
  /** `person.team`: the primary team (it is also one of the memberships). */
  primaryTeamId: string | null | undefined;
  /** Sets or clears the primary team (`person.team`); clearing keeps the memberships. */
  onSetPrimary: (teamId: string | null) => Promise<unknown>;
}

/**
 * Every team, with the person's own marked. A person can be in several teams: Join adds a membership,
 * Leave removes one, and "Make primary" chooses which of them is `person.team`.
 */
export const PersonTeamsTab: React.FC<PersonTeamsTabProps> = ({ personId, personName, primaryTeamId, onSetPrimary }) => {
  const canManage = useCan('masterdata.directory.manage');
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: [...teamsApi.keys.all, 'all'], queryFn: ({ signal }) => fetchAllRows(teamsApi.list, { ordering: 'name' }, { signal }) });
  const memberships = useQuery({ queryKey: [...teamMembershipsApi.keys.all, 'of-person', personId], queryFn: ({ signal }) => fetchAllRows(teamMembershipsApi.list, { person: personId }, { signal }) });
  const [leaving, setLeaving] = useState<{ membershipId: string; teamName: string; primary: boolean } | null>(null);

  const membershipOf = new Map((memberships.data ?? []).map((m) => [m.team, m.id]));
  const refresh = () => Promise.all([teamMembershipsApi.keys.all, peopleApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refresh();
    } catch (error) {
      notify.fromError(error);
    }
  };
  const rows = teams.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Teams{memberships.data ? ` (${memberships.data.length})` : ''}</h3>
        {canManage && primaryTeamId && (
          <Button size="sm" variant="outline" onClick={() => void run(() => onSetPrimary(null))}>
            Clear primary team
          </Button>
        )}
      </div>
      {!canManage && <p className="text-xs text-slate-400">You can see the teams but not change them.</p>}
      <QueryBoundary isLoading={teams.isLoading || memberships.isLoading} error={teams.error ?? memberships.error} onRetry={() => { void teams.refetch(); void memberships.refetch(); }} entityName="teams" isEmpty={rows.length === 0} empty={{ title: 'No teams', description: 'No team has been created yet.' }}>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-label="Teams">
          {rows.map((team) => {
            const membershipId = membershipOf.get(team.id);
            const isPrimary = team.id === primaryTeamId;
            return (
              <li key={team.id} className={`rounded-xl border p-4 space-y-3 ${membershipId ? 'border-indigo-500 bg-indigo-950/30' : 'border-slate-800 bg-slate-900/60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{team.name}</span>
                      <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{team.code}</span>
                    </div>
                    <span className="block text-xs text-slate-400 mt-1">{[team.focus_discipline, `${team.member_count} ${team.member_count === 1 ? 'member' : 'members'}`].filter(Boolean).join(' · ')}</span>
                  </div>
                  <div className="flex gap-1">
                    {membershipId && <Badge variant="info">Member</Badge>}
                    {isPrimary && <Badge variant="success">Primary</Badge>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    {membershipId ? (
                      <>
                        {!isPrimary && (
                          <Button size="xs" variant="outline" aria-label={`Make ${team.name} primary`} onClick={() => void run(() => onSetPrimary(team.id))}>
                            Make primary
                          </Button>
                        )}
                        <Button size="xs" variant="outline" aria-label={`Leave ${team.name}`} onClick={() => setLeaving({ membershipId, teamName: team.name, primary: isPrimary })}>
                          Leave
                        </Button>
                      </>
                    ) : (
                      <Button size="xs" variant="primary" aria-label={`Join ${team.name}`} onClick={() => void run(() => teamMembershipsApi.create({ team: team.id, person: personId }))}>
                        Join
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </QueryBoundary>

      <ConfirmDialog
        isOpen={leaving !== null}
        title="Leave team"
        message={`Remove ${personName} from ${leaving?.teamName ?? ''}? They stay in their other teams.${leaving?.primary ? ' This is their primary team, so they will have no primary team afterwards.' : ''}`}
        confirmLabel="Leave"
        destructive
        onClose={() => setLeaving(null)}
        onConfirm={async () => {
          if (!leaving) return;
          await teamMembershipsApi.remove(leaving.membershipId);
          await refresh();
          notify.success('Removed from the team.');
        }}
      />
    </div>
  );
};
