import { usePerson, usePersonMutations } from '@/modules/people/hooks/usePeopleData';
import { useDepartments } from '@/modules/departments';
import { useTeams } from '@/modules/teams';
import { useOffices } from '@/modules/offices';
import { ProductionRoleSelect } from '@/modules/access/components/ProductionRoleSelect';
import { ApiError } from '@/api/errors/ApiError';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit3, ChevronLeft, Save, Sparkles, Building, MapPin, AlertCircle } from 'lucide-react';
;
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export const EditPersonPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: person, isLoading } = usePerson(id || '');
  const { updatePerson } = usePersonMutations();
  const { data: departmentsData } = useDepartments();
  const { data: teamsData } = useTeams();
  const { data: officesData } = useOffices();
  const departments = departmentsData?.items ?? [];
  const teams = teamsData?.items ?? [];
  const offices = officesData?.items ?? [];

  const [form, setForm] = useState<{
    full_name: string;
    email: string;
    role: string;
    role_id: string;
    department_id: string;
    department_name: string;
    team_id: string;
    team_name: string;
    office_id: string;
    office_name: string;
    seniority: string;
    skills: string;
    phone: string;
    timezone: string;
    security_clearance: string;
    status: string;
    availability_status: string;
  }>({
    full_name: '',
    email: '',
    role: '',
    role_id: '',
    department_id: '',
    department_name: '',
    team_id: '',
    team_name: '',
    office_id: '',
    office_name: '',
    seniority: 'Senior',
    skills: '',
    phone: '',
    timezone: '',
    security_clearance: 'MPAA Tier 3',
    status: 'Active',
    availability_status: 'Available',
  });

  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    if (person) {
      setForm({
        full_name: person.full_name || '',
        email: person.email || '',
        role: person.role || '',
        role_id: person.role_id || '',
        department_id: person.department_id || '',
        department_name: person.department_name || '',
        team_id: person.team_id || '',
        team_name: person.team_name || '',
        office_id: person.office_id || '',
        office_name: person.office_name || '',
        seniority: person.seniority || 'Mid',
        skills: person.skills ? person.skills.join(', ') : '',
        phone: person.phone || '+1 (555) 019-2831',
        timezone: person.timezone || 'America/Toronto (EDT)',
        security_clearance: person.security_clearance || 'MPAA Tier 3',
        status: person.status || 'Active',
        availability_status: person.availability_status || 'Available',
      });
    }
  }, [person]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-lg font-bold text-white">Artist Not Found</h2>
        <Link to="/people">
          <Button variant="outline" size="sm">Back to Roster</Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role_id) return;
    const skillsArray = form.skills.split(',').map((s) => s.trim()).filter(Boolean);
    const selectedDept = departments?.find((d) => d.id === form.department_id);
    const selectedOffice = offices?.find((o) => o.id === form.office_id);
    const selectedTeam = teams?.find((t) => t.id === form.team_id);

    try {
      await updatePerson.mutateAsync({
        id: person.id,
        data: {
          ...form,
          department_id: form.department_id || undefined,
          team_id: form.team_id || undefined,
          office_id: form.office_id || undefined,
          department_name: selectedDept?.name || form.department_name,
          office_name: selectedOffice?.name || form.office_name,
          team_name: selectedTeam?.name || form.team_name,
          skills: skillsArray,
        },
      });

      navigate(`/people/${person.id}`);
    } catch (err) {
      const fieldError = ApiError.fromUnknown(err).getFirstFieldError('role_id');
      if (fieldError) {
        // Keep the form open with the field error and state intact.
        setRoleError(fieldError);
        return;
      }
      throw err;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 animate-in fade-in duration-200">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <Link to={`/people/${person.id}`}>
          <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            Back to Profile
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-indigo-400" />
            Edit Profile: {person.full_name}
          </h1>
          <p className="text-xs text-slate-400">
            Update production role, department, team squad alignment, and clearance tier.
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <ProductionRoleSelect
                  value={form.role_id}
                  fallbackRoleName={form.role}
                  onChange={(roleId, position) => {
                    setForm((f) => ({
                      ...f,
                      role_id: roleId,
                      ...(position ? { role: position.title } : {}),
                    }));
                    setRoleError(null);
                  }}
                />
                {roleError && <p className="text-[11px] text-rose-400 mt-1">{roleError}</p>}
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
                  <option value="">None — unassigned</option>
                  {(departments || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Assigned Strike Squad</label>
                <select
                  value={form.team_id}
                  onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="">None — unassigned</option>
                  {(teams || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Facility Hub</label>
                <select
                  value={form.office_id}
                  onChange={(e) => setForm({ ...form, office_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="">None — unassigned</option>
                  {(offices || []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Clearance Tier</label>
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
              <label className="block text-xs font-mono text-slate-400 mb-1">Skills & Toolchain</label>
              <input
                type="text"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Link to={`/people/${person.id}`}>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={updatePerson.isPending}
                disabled={!form.role_id}
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
