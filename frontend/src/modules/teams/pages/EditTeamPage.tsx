import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Users2, ChevronLeft, Save } from 'lucide-react';
import { useTeam, useTeamMutations, useDepartments, usePeople } from '@/modules/organization/hooks/useOrganizationData';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export const EditTeamPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: team, isLoading } = useTeam(id || '');
  const { updateTeam } = useTeamMutations();
  const { data: departments } = useDepartments();
  const { data: peopleData } = usePeople();
  const { data: projectsData } = useProjects();

  const depts = departments || [];
  const people = peopleData?.results || [];
  const projects = projectsData?.results || [];

  const [form, setForm] = useState({
    name: '',
    code: '',
    department_id: '',
    lead_id: '',
    focus_discipline: '',
    current_project_code: '',
    description: '',
    capacity_hours_weekly: 160,
    utilization_percentage: 80,
  });

  useEffect(() => {
    if (team) {
      setForm({
        name: team.name,
        code: team.code,
        department_id: team.department_id,
        lead_id: team.lead_id,
        focus_discipline: team.focus_discipline,
        current_project_code: team.current_project_code,
        description: team.description,
        capacity_hours_weekly: team.capacity_hours_weekly || 160,
        utilization_percentage: team.utilization_percentage || 80,
      });
    }
  }, [team]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-lg font-bold text-white">Team Squad Not Found</h2>
        <Link to="/teams">
          <Button variant="outline" size="sm">Back to Teams</Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedDept = depts.find((d) => d.id === form.department_id);
    const selectedLead = people.find((p) => p.id === form.lead_id);

    await updateTeam.mutateAsync({
      id: team.id,
      data: {
        ...form,
        department_name: selectedDept?.name || team.department_name,
        lead_name: selectedLead?.full_name || team.lead_name,
        lead_avatar: selectedLead?.avatar_url || team.lead_avatar,
      },
    });

    navigate(`/teams/${team.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <Link to={`/teams/${team.id}`}>
          <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            Back to Team
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Users2 className="w-5 h-5 text-indigo-400" />
            Edit Team Squad: {team.name}
          </h1>
          <p className="text-xs text-slate-400">
            Update squad lead, parent craft department, focus discipline, and show assignment.
          </p>
        </div>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Squad Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Squad Code *</label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Parent Department</label>
                <select
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Squad Lead</label>
                <select
                  value={form.lead_id}
                  onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Discipline Focus</label>
                <input
                  type="text"
                  value={form.focus_discipline}
                  onChange={(e) => setForm({ ...form, focus_discipline: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Current Show Assignment</label>
                <select
                  value={form.current_project_code}
                  onChange={(e) => setForm({ ...form, current_project_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Squad Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Link to={`/teams/${team.id}`}>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={updateTeam.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};
