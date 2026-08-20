import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building2, ChevronLeft, Save } from 'lucide-react';
import { useOffice, useOfficeMutations, usePeople } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export const EditOfficePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: office, isLoading } = useOffice(id || '');
    const { updateOffice } = useOfficeMutations();
    const { data: peopleData } = usePeople();
    const people = peopleData?.results || [];

    const [form, setForm] = useState({
        name: '',
        code: '',
        city: '',
        country: '',
        address: '',
        timezone: '',
        capacity: 120,
        current_occupancy: 0,
        manager_id: '',
        manager_name: '',
        network_speed_gbps: 10,
        color_space: '',
        status: 'Operational' as 'Operational' | 'Remote Hub' | 'Maintenance',
        working_hours: '',
    });

    useEffect(() => {
        if (office) {
            setForm({
                name: office.name,
                code: office.code,
                city: office.city,
                country: office.country,
                address: office.address,
                timezone: office.timezone,
                capacity: office.capacity,
                current_occupancy: office.current_occupancy,
                manager_id: office.manager_id,
                manager_name: office.manager_name,
                network_speed_gbps: office.network_speed_gbps,
                color_space: office.color_space,
                status: office.status,
                working_hours: office.working_hours || '',
            });
        }
    }, [office]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (!office) {
        return (
            <div className="p-8 text-center space-y-4">
                <h2 className="text-lg font-bold text-white">Office Not Found</h2>
                <Link to="/offices">
                    <Button variant="outline" size="sm">Back to Offices</Button>
                </Link>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedManager = people.find((p) => p.id === form.manager_id);

        await updateOffice.mutateAsync({
            id: office.id,
            data: {
                ...form,
                manager_name: selectedManager?.full_name || form.manager_name,
            },
        });

        navigate(`/offices/${office.id}`);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <Link to={`/offices/${office.id}`}>
                    <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
                        Back to Office
                    </Button>
                </Link>
                <div>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-400" />
                        Edit Office: {office.name}
                    </h1>
                    <p className="text-xs text-slate-400">
                        Update facility details, capacity, infrastructure, and management.
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
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Office Code *</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={5}
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
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
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-mono text-slate-400 mb-1">Address</label>
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-1">Timezone</label>
                                <input
                                    type="text"
                                    value={form.timezone}
                                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
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
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                            <Link to={`/offices/${office.id}`}>
                                <Button variant="outline" size="sm">
                                    Cancel
                                </Button>
                            </Link>
                            <Button
                                variant="primary"
                                size="sm"
                                type="submit"
                                isLoading={updateOffice.isPending}
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
