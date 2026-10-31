import type React from 'react';
import { teamsApi } from '@/api/masterdata/directory';
import type { Team } from '@/api/masterdata/directory';
import { AssignmentChoice } from './AssignmentChoice';

/** The person's team (one at most); saved as the person's `team`. */
export const PersonTeamsTab: React.FC<{ currentTeamId: string | null | undefined; onAssignTeam: (teamId: string | null) => Promise<unknown> }> = ({ currentTeamId, onAssignTeam }) => (
  <AssignmentChoice<Team> noun="team" queryKey={teamsApi.keys.all} fetchPage={teamsApi.list} currentId={currentTeamId} onAssign={onAssignTeam} describe={(t) => t.focus_discipline || ''} />
);
