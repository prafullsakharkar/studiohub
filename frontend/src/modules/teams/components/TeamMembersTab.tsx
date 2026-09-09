import React, { useState } from 'react';
import { Users, UserPlus, UserMinus, ShieldAlert, Mail, MapPin, ExternalLink, ShieldCheck } from 'lucide-react';
import { TeamEntity } from '@/types/organization';
import { usePeople, useTeamMutations } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Link } from 'react-router-dom';

export const TeamMembersTab: React.FC<{ team: TeamEntity }> = ({ team }) => {
  const { data: peopleData } = usePeople();
  const { updateTeam } = useTeamMutations();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState('');

  const allPeople = peopleData?.results || [];
  const memberIds = team.member_ids || [];

  // Get people who belong to this team
  const teamMembers = allPeople.filter(
    (p) => memberIds.includes(p.id) || p.team_id === team.id || p.team_name === team.name
  );

  // Available people not in team
  const availablePeople = allPeople.filter(
    (p) => !memberIds.includes(p.id) && p.team_id !== team.id && p.team_name !== team.name
  );

  const handleAddMember = () => {
    if (!selectedPersonId) return;
    const newMembers = [...new Set([...memberIds, selectedPersonId])];
    updateTeam.mutate({
      id: team.id,
      data: {
        member_ids: newMembers,
        member_count: newMembers.length,
      },
    });
    setSelectedPersonId('');
    setIsAddModalOpen(false);
  };

  const handleRemoveMember = (personId: string) => {
    const newMembers = memberIds.filter((id) => id !== personId);
    updateTeam.mutate({
      id: team.id,
      data: {
        member_ids: newMembers,
        member_count: Math.max(1, newMembers.length),
      },
    });
  };

  const handleChangeLead = (person: any) => {
    updateTeam.mutate({
      id: team.id,
      data: {
        lead_id: person.id,
        lead_name: person.full_name,
        lead_avatar: person.avatar_url,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Active Squad Members ({teamMembers.length})
          </h3>
          <p className="text-xs text-slate-400">
            Artists allocated to {team.name}. Squad lead is marked with a gold shield.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<UserPlus className="w-3.5 h-3.5" />}
        >
          Add Crew Member
        </Button>
      </div>

      {/* Member Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMembers.length === 0 ? (
          <div className="col-span-3 p-8 text-center rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
            No dedicated crew members attached. Click "Add Crew Member" to attach artists.
          </div>
        ) : (
          teamMembers.map((person) => {
            const isLead = team.lead_id === person.id || team.lead_name === person.full_name;
            return (
              <div
                key={person.id}
                className={`rounded-xl border p-4 space-y-3 transition-colors ${
                  isLead
                    ? 'border-amber-500/40 bg-amber-950/10'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={person.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-700"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-sm text-white">{person.full_name}</h4>
                        {isLead && (
                          <span title="Squad Lead" className="text-amber-400">
                            <ShieldCheck className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{person.role}</p>
                    </div>
                  </div>

                  <Badge variant={isLead ? 'warning' : 'outline'} className="text-[10px] font-mono">
                    {isLead ? 'Squad Lead' : 'Artist'}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-slate-400 font-mono text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{person.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{person.office_name}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {!isLead && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleChangeLead(person)}
                        className="text-[10px] text-amber-300 hover:bg-amber-950/30"
                      >
                        Make Lead
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleRemoveMember(person.id)}
                      className="text-[10px] text-rose-400 hover:bg-rose-950/30"
                    >
                      Remove
                    </Button>
                  </div>

                  <Link to={`/people/${person.id}`}>
                    <Button size="xs" variant="outline" rightIcon={<ExternalLink className="w-3 h-3" />}>
                      Profile
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-400" />
              Add Artist to {team.name}
            </h3>
            <p className="text-xs text-slate-400">
              Select an available artist from the studio roster to assign to this strike squad.
            </p>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Select Crew Member</label>
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="">-- Choose Artist --</option>
                {availablePeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.role} • {p.department_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button size="sm" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleAddMember}
                disabled={!selectedPersonId}
                isLoading={updateTeam.isPending}
              >
                Confirm Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
