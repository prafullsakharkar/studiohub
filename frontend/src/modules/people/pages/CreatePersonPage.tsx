import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ChevronLeft, Save, Sparkles, Building, MapPin } from 'lucide-react';
import { usePersonMutations, useDepartments, useTeams, useOffices } from '@/modules/organization/hooks/useOrganizationData';
import { Person } from '@/types/organization';
import { Button } from '@/shared/components/Button';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';

export const CreatePersonPage: React.FC = () => {
  const navigate = useNavigate();
  const { createPerson } = usePersonMutations();
  const { data: departments } = useDepartments();
  const { data: teams } = useTeams();
  const { data: offices } = useOffices();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: 'Senior 3D Artist',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-02',
    team_name: 'Hero Asset Crew',
    office_id: 'off-01',
    office_name: 'Montreal HQ (Main Stage)',
    seniority: 'Senior' as const,
    skills: 'Maya, OpenUSD, Python, ZBrush',
    phone: '+1 (555) 019-2831',
    timezone: 'America/Toronto (EDT)',
    security_clearance: 'MPAA Tier 3',
    status: 'Active' as const,
    availability_status: 'Available' as const,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const skillsArray = form.skills.split(',').map((s) => s.trim()).filter(Boolean);
    const selectedDept = departments?.find((d) => d.id === form.department_id);
    const selectedOffice = offices?.find((o) => o.id === form.office_id);
    const selectedTeam = teams?.find((t) => t.id === form.team_id);

    const result = await createPerson.mutateAsync({
      ...form,
      role: form.role as Person['role'],
      department_name: selectedDept?.name || form.department_name,
      office_name: selectedOffice?.name || form.office_name,
      team_name: selectedTeam?.name || form.team_name,
      skills: skillsArray,
      avatar_url: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
    });

    navigate(`/people/${result.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <Link to="/people">
          <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            Roster
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            Invite & Provision Artist Account
          </h1>
          <p className="text-xs text-slate-400">
            Create an internal crew record, assign department craft, strike squad, and facility clearance.
          </p>
        </div>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Elena Rostova"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Studio Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. elena@apex.vfx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Production Role *</label>
                <input
                  type="text"
                  required
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="e.g. Lead FX TD"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Seniority Level</label>
                <select
                  value={form.seniority}
                  onChange={(e) => setForm({ ...form, seniority: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Head of Department">Head of Department</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Department</label>
                <select
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  {(departments || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Assigned Strike Squad / Team</label>
                <select
                  value={form.team_id}
                  onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  {(teams || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Facility Hub / Office</label>
                <select
                  value={form.office_id}
                  onChange={(e) => setForm({ ...form, office_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  {(offices || []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Security Clearance</label>
                <select
                  value={form.security_clearance}
                  onChange={(e) => setForm({ ...form, security_clearance: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="MPAA Tier 1">MPAA Tier 1 (Standard)</option>
                  <option value="MPAA Tier 2">MPAA Tier 2 (Confidential)</option>
                  <option value="MPAA Tier 3">MPAA Tier 3 (Hero Asset Access)</option>
                  <option value="MPAA Tier 4">MPAA Tier 4 (Full Master Access)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Skills & Toolchain (Comma separated)</label>
              <input
                type="text"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="Maya, Houdini, USD, Python"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Link to="/people">
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={createPerson.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Provision Account
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};
