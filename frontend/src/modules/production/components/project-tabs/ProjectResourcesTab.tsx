import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Clock,
  Briefcase,
  MapPin,
  Building,
  CheckCircle2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Project } from '@/types/projects';
import {
  mockProjectCrewMembers,
  ProjectCrewMember,
} from '@/mocks/db/production/projectDetails';
import { mockPeople } from '@/mocks/db/organization/organization';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Link } from 'react-router-dom';

interface ProjectResourcesTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectResourcesTab: React.FC<ProjectResourcesTabProps> = ({ project }) => {
  const [crew, setCrew] = useState<ProjectCrewMember[]>(
    mockProjectCrewMembers.filter((c) => c.project_id === project.id).length > 0
      ? mockProjectCrewMembers.filter((c) => c.project_id === project.id)
      : mockProjectCrewMembers
  );
  const [isAddOpen, setIsAddOpen] = useState(false);

  const addNotification = useNotificationStore((state) => state.addNotification);

  const totalLogged = crew.reduce((sum, c) => sum + c.logged_hours, 0);
  const totalEstimated = crew.reduce((sum, c) => sum + c.estimated_hours, 0);

  const [selectedPersonId, setSelectedPersonId] = useState(mockPeople[0]?.id || '');
  const [allocationPct, setAllocationPct] = useState(100);

  const handleAddCrew = (e: React.FormEvent) => {
    e.preventDefault();
    const person = mockPeople.find((p) => p.id === selectedPersonId);
    if (!person) return;

    const newMember: ProjectCrewMember = {
      id: `pcrew-${Date.now()}`,
      project_id: project.id,
      person_id: person.id,
      name: person.full_name,
      role: person.role,
      department: person.department_name || 'VFX Production',
      team: person.team_name || 'Production Squad',
      office: person.office_name || 'Montreal HQ (Main Stage)',
      allocation_pct: allocationPct,
      avatar_url: person.avatar_url,
      logged_hours: 0,
      estimated_hours: 160,
      skills: person.skills || ['NukeX', 'Houdini'],
    };

    setCrew([...crew, newMember]);
    setIsAddOpen(false);
    addNotification({
      type: 'success',
      title: 'Crew Member Assigned',
      message: `${person.full_name} (${person.role}) assigned at ${allocationPct}% capacity.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-xs font-mono text-slate-400">Assigned Crew Headcount</span>
          <div className="text-2xl font-bold font-mono text-white">{crew.length} Artists & Leads</div>
          <p className="text-[11px] text-slate-400 font-mono">100% On-Site & Remote Certified</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-xs font-mono text-slate-400">Logged vs Estimated Hours</span>
          <div className="text-2xl font-bold font-mono text-indigo-400">
            {totalLogged}h / {totalEstimated}h
          </div>
          <p className="text-[11px] text-indigo-300 font-mono">
            {Math.round((totalLogged / totalEstimated) * 100)}% of Show Hours Expended
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-xs font-mono text-slate-400">Multi-Site Operations</span>
          <div className="text-2xl font-bold font-mono text-emerald-400">2 Active Studio Hubs</div>
          <p className="text-[11px] text-emerald-400 font-mono">Montreal HQ + London Soho</p>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-3 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Assigned Show Crew Roster
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Supervisors, Lead Artists, Riggers, Animators, and Production Coordinators
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsAddOpen(true)}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Assign Talent
            </Button>
            <Link to="/organization">
              <Button size="sm" variant="ghost" rightIcon={<ExternalLink className="w-3 h-3" />}>
                People Directory
              </Button>
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 select-none">
                <th className="py-2.5 px-3">Crew Member</th>
                <th className="py-2.5 px-3">Department & Team</th>
                <th className="py-2.5 px-3">Office Location</th>
                <th className="py-2.5 px-3">Allocation</th>
                <th className="py-2.5 px-3">Logged Hours</th>
                <th className="py-2.5 px-3">Primary Toolset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {crew.map((member) => (
                <tr key={member.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                      />
                      <div>
                        <span className="font-bold text-white block">{member.name}</span>
                        <span className="text-[11px] font-mono text-indigo-300">{member.role}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-slate-200 font-medium block">{member.department}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{member.team}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{member.office}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px]">
                      {member.allocation_pct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    <span className="text-indigo-400 font-bold">{member.logged_hours}h</span> / {member.estimated_hours}h
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap gap-1">
                      {member.skills.slice(0, 2).map((s) => (
                        <span key={s} className="px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-slate-800 font-mono text-[10px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Talent Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Assign Artist to Production Crew"
        subtitle={`Assign crew member to show ${project.name} (${project.code})`}
      >
        <form onSubmit={handleAddCrew} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Select Studio Artist / Lead</label>
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            >
              {mockPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {p.role} ({p.department_name})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Capacity Allocation (%)</label>
            <input
              type="number"
              min={10}
              max={100}
              step={5}
              value={allocationPct}
              onChange={(e) => setAllocationPct(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsAddOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Assign to Show
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
