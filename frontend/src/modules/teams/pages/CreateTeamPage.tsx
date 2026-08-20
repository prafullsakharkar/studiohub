import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users2, ChevronLeft, Save } from 'lucide-react';
import { useTeamMutations, useDepartments, usePeople } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';

export const CreateTeamPage: React.FC = () => {
    const navigate = useNavigate();
    const { createTeam } = useTeamMutations();
    const { data: departments } = useDepartments();
    const { data: peopleData } = usePeople();
    const people = peopleData?.results || [];

    const [form, setForm] = useState({
        name: '',
        code: '',
        department_id: '',
        department_name: '',
        lead_id: 'usr-001',
        lead_name: 'Alex Chen',
        lead_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        current_project_code: 'NK99',
        focus_discipline: '',
        capacity_utilization: 78,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedDept = departments?.find((d) => d.id === form.department_id);
        const selectedLead = people.find((p) => p.id === form.lead_id);

        const result = await createTeam.mutateAsync({
            ...form,
            department_name: selectedDept?.name || form.department_name,
            lead_name: selectedLead?.full_name || form.lead_name,
            lead_avatar: selectedLead?.avatar_url || form.lead_avatar,
            member_count: 1,
            member_ids: [form.lead_id],
        });

        navigate(`/teams/${result.id}`);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <Link to="/teams">
                    <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
                        Teams
                    </Button>
                </Link>
                <div>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users2 className="w-5 h-5 text-indigo-400" />
                        Assemble Team Squad
                    </h1>
                    <p className="text-xs text-slate-400">
                        Define a specialized strike squad, squad captain, parent department, and focus discipline.
                    </p>
                </div>
            </div>

            <Card>
                <CardBody>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Team Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. Hero Asset Strike Squad"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Team Code (2-4 uppercase letters) *</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={5}
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. HERO"
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
                                    <option value="">Select department...</option>
                                    {(departments || []).map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name} ({d.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Squad Captain (Lead)</label>
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
                                <label className="block text-xs font-mono text-slate-400 mb-1">Focus Discipline</label>
                                <input
                                    type="text"
                                    value={form.focus_discipline}
                                    onChange={(e) => setForm({ ...form, focus_discipline: e.target.value })}
                                    placeholder="e.g. Hero Asset LookDev"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Current Project Code</label>
                                <input
                                    type="text"
                                    value={form.current_project_code}
                                    onChange={(e) => setForm({ ...form, current_project_code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. NK99"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Capacity Utilization (%)</label>
                                <input
                                    type="number"
                                    value={form.capacity_utilization}
                                    onChange={(e) => setForm({ ...form, capacity_utilization: Number(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                                />
                            </div>
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
                                Create Team
                            </Button>
                        </div>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
};
