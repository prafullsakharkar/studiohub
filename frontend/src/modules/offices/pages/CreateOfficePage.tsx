import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ChevronLeft, Save } from 'lucide-react';
import { useOfficeMutations, usePeople } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';

export const CreateOfficePage: React.FC = () => {
    const navigate = useNavigate();
    const { createOffice } = useOfficeMutations();
    const { data: peopleData } = usePeople();
    const people = peopleData?.results || [];

    const [form, setForm] = useState({
        name: '',
        code: '',
        city: '',
        country: '',
        address: '',
        timezone: 'UTC',
        capacity: 120,
        current_occupancy: 0,
        manager_id: 'usr-001',
        manager_name: 'Alex Chen',
        network_speed_gbps: 10,
        color_space: 'ACEScg',
        status: 'Operational' as 'Operational' | 'Remote Hub' | 'Maintenance',
        working_hours: '09:00 - 18:00 (Mon-Fri)',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedManager = people.find((p) => p.id === form.manager_id);

        const result = await createOffice.mutateAsync({
            ...form,
            manager_name: selectedManager?.full_name || form.manager_name,
        });

        navigate(`/offices/${result.id}`);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <Link to="/offices">
                    <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
                        Offices
                    </Button>
                </Link>
                <div>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-400" />
                        Register Facility Node
                    </h1>
                    <p className="text-xs text-slate-400">
                        Define a new studio office, remote hub, or maintenance site with capacity and infrastructure.
                    </p>
                </div>
            </div>

            <Card>
                <CardBody>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Office Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. Mumbai Hero Studio"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Office Code (2-4 uppercase letters) *</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={5}
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. MUM"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">City *</label>
                                <input
                                    type="text"
                                    required
                                    value={form.city}
                                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                                    placeholder="e.g. Mumbai"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Country *</label>
                                <input
                                    type="text"
                                    required
                                    value={form.country}
                                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                                    placeholder="e.g. India"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-mono text-slate-400 mb-1">Address</label>
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    placeholder="Street address"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Timezone</label>
                                <input
                                    type="text"
                                    value={form.timezone}
                                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                                    placeholder="e.g. Asia/Kolkata (UTC+5:30)"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Facility Manager</label>
                                <select
                                    value={form.manager_id}
                                    onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
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
                                <label className="block text-xs font-mono text-slate-400 mb-1">Seat Capacity</label>
                                <input
                                    type="number"
                                    value={form.capacity}
                                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Current Occupancy</label>
                                <input
                                    type="number"
                                    value={form.current_occupancy}
                                    onChange={(e) => setForm({ ...form, current_occupancy: Number(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Network Speed (Gbps)</label>
                                <input
                                    type="number"
                                    value={form.network_speed_gbps}
                                    onChange={(e) => setForm({ ...form, network_speed_gbps: Number(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Color Space</label>
                                <input
                                    type="text"
                                    value={form.color_space}
                                    onChange={(e) => setForm({ ...form, color_space: e.target.value })}
                                    placeholder="e.g. ACEScg"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Status</label>
                                <select
                                    value={form.status}
                                    onChange={(e) => setForm({ ...form, status: e.target.value as 'Operational' | 'Remote Hub' | 'Maintenance' })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                >
                                    <option value="Operational">Operational</option>
                                    <option value="Remote Hub">Remote Hub</option>
                                    <option value="Maintenance">Maintenance</option>
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-mono text-slate-400 mb-1">Working Hours</label>
                                <input
                                    type="text"
                                    value={form.working_hours}
                                    onChange={(e) => setForm({ ...form, working_hours: e.target.value })}
                                    placeholder="e.g. 09:00 - 18:00 (Mon-Fri)"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                            <Link to="/offices">
                                <Button variant="outline" size="sm">
                                    Cancel
                                </Button>
                            </Link>
                            <Button
                                variant="primary"
                                size="sm"
                                type="submit"
                                isLoading={createOffice.isPending}
                                leftIcon={<Save className="w-4 h-4" />}
                            >
                                Create Office
                            </Button>
                        </div>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
};
