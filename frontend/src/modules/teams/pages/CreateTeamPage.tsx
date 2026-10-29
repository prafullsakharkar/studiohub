import { useProjects } from '@/modules/production';
import { useTeamMutations } from '@/modules/teams';
import { useDepartments } from '@/modules/departments';
import { usePeople } from '@/modules/people';
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users2, ChevronLeft, Save } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';

export const CreateTeamPage: React.FC = () => {
  const navigate = useNavigate();
  const { createTeam } = useTeamMutations();
  const { data: departments } = useDepartments();
  const { data: peopleData } = usePeople();
  const { data: projectsData } = useProjects();

  const depts = departments?.items ?? [];
  const people = peopleData?.items || [];
  const projects = projectsData?.results || [];

  const [form, setForm] = useState({
    name: '',
    code: '',
    department_id: depts[0]?.id || '',
    lead_id: people[0]?.id || '',
    focus_discipline: 'Hero Assets',
    current_project_code: projects[0]?.code || 'NK99',
    description: '',
    capacity_hours_weekly: 160,
    utilization_percentage: 80,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const departmentId = form.department_id || depts[0]?.id;

    const result = await createTeam.mutateAsync({
      name: form.name,
      code: form.code,
      description: form.description,
      department: departmentId,
      color: '',
      capacity: 1,
    } as unknown as Parameters<typeof createTeam.mutateAsync>[0]);

    navigate(`/teams/${result.id}`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 animate-in fade-in duration-200">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <Link to="/teams">
          <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            Teams
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Users2 className="w-5 h-5 text-indigo-400" />
            Assemble Team Strike Squad
          </h1>
          <p className="text-xs text-slate-400">
            Form a focused squad with dedicated lead, discipline focus, and project attachment.
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
                  placeholder="e.g. Hero Creature Pod"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Squad Code (e.g. SQUAD-A) *</label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. CR-POD"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Parent Department *</label>
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
                <label className="block text-xs font-mono text-slate-400 mb-1">Squad Lead *</label>
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
                  placeholder="e.g. Hero Creature Rigging"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Initial Show Assignment</label>
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
              <label className="block text-xs font-mono text-slate-400 mb-1">Squad Description & Goals</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Scope of work and responsibilities..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Link to="/teams">
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={createTeam.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Assemble Squad
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};
