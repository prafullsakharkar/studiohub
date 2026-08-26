import React, { useState } from 'react';
import { Users, Plus, Shield, CheckCircle2, Film, Edit3, Search, UserCheck } from 'lucide-react';
import { Vendor, VendorTeam } from '@/types/organization';
import { mockVendorTeams } from '@/mocks/db/organization/clientVendorDetails';
import { mockProjects } from '@/mocks/db/production/projects';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface VendorTeamsTabProps {
  vendor: Vendor;
}

export const VendorTeamsTab: React.FC<VendorTeamsTabProps> = ({ vendor }) => {
  const [teams, setTeams] = useState<VendorTeam[]>(() =>
    mockVendorTeams.filter((t) => t.vendor_id === vendor.id)
  );
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Assign Team State
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [targetProjectCode, setTargetProjectCode] = useState('NK99');

  // Create Team State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [newLeadName, setNewLeadName] = useState('');
  const [newMemberCount, setNewMemberCount] = useState(10);
  const [newDiscipline, setNewDiscipline] = useState('Complex Matte Painting & Prep');

  const handleAssignTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) return;

    setTeams(
      teams.map((t) =>
        t.id === selectedTeamId ? { ...t, current_project_code: targetProjectCode } : t
      )
    );
    setIsAssignOpen(false);
    setSelectedTeamId('');
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamCode.trim()) return;

    const newTeam: VendorTeam = {
      id: `vt-${Date.now()}`,
      vendor_id: vendor.id,
      name: newTeamName,
      code: newTeamCode.toUpperCase(),
      lead_name: newLeadName || 'Squad Lead',
      member_count: Number(newMemberCount),
      current_project_code: targetProjectCode,
      focus_discipline: newDiscipline,
    };

    setTeams([...teams, newTeam]);
    setIsCreateOpen(false);
    setNewTeamName('');
    setNewTeamCode('');
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            Vendor Dedicated Squads & Team Units ({teams.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational artist squads contracted and assigned to specific production turnover packages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAssignOpen(true)}
            className="flex items-center gap-1.5 text-xs text-indigo-300 border-indigo-500/30"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Assign Team to Show
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Squad
          </Button>
        </div>
      </div>

      {/* Squad Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/80">
            No dedicated squads registered for this vendor.
          </div>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                      {team.name}
                    </h4>
                    <span className="text-[11px] font-mono text-purple-300">
                      Discipline: {team.focus_discipline}
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] text-purple-300 border-purple-500/30">
                    {team.code}
                  </Badge>
                </div>

                <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Squad Lead:</span>
                    <span className="text-white font-medium">{team.lead_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Artist Capacity:</span>
                    <span className="text-indigo-300 font-bold">{team.member_count} Artists</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Current Production:</span>
                    <Badge variant="secondary" className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 border-emerald-500/30">
                      [{team.current_project_code}]
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedTeamId(team.id);
                    setIsAssignOpen(true);
                  }}
                  className="text-xs w-full"
                >
                  Reassign Squad Scope →
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Assign Team Modal */}
      {isAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-400" />
                Assign Vendor Squad to Production Show
              </h2>
              <button
                onClick={() => setIsAssignOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignTeam} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400">Select Vendor Squad</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  required
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-hidden"
                >
                  <option value="">-- Choose Squad to Assign --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.code}] {t.name} ({t.focus_discipline} • {t.member_count} artists)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Target Production</label>
                <select
                  value={targetProjectCode}
                  onChange={(e) => setTargetProjectCode(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-hidden"
                >
                  {mockProjects.map((p) => (
                    <option key={p.id} value={p.code}>
                      [{p.code}] {p.name} ({p.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAssignOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="bg-purple-600 hover:bg-purple-500 text-white">
                  Assign Squad
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Register New Vendor Squad
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Squad Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Delta Clean Plate Unit"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Squad Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DCPU-04"
                    value={newTeamCode}
                    onChange={(e) => setNewTeamCode(e.target.value.toUpperCase())}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Squad Lead TD Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sneha Rao"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Focus Discipline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Complex Stunt Wire & Rig Extraction"
                  value={newDiscipline}
                  onChange={(e) => setNewDiscipline(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Artist Capacity</label>
                <input
                  type="number"
                  min="1"
                  value={newMemberCount}
                  onChange={(e) => setNewMemberCount(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-hidden font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="bg-purple-600 hover:bg-purple-500 text-white">
                  Create Squad
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
