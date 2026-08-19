import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layers, ChevronLeft, Save, Plus } from 'lucide-react';
import { useDepartmentMutations, usePeople } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';

export const CreateDepartmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { createDepartment } = useDepartmentMutations();
  const { data: peopleData } = usePeople();
  const people = peopleData?.results || [];

  const [form, setForm] = useState({
    name: '',
    code: '',
    head_id: 'usr-001',
    head_name: 'Alex Chen',
    head_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    color: '#6366f1',
    description: '',
    software_stack: 'Maya, OpenUSD, Python',
    capacity_hours_weekly: 160,
    utilization_percentage: 75,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stackArray = form.software_stack.split(',').map((s) => s.trim()).filter(Boolean);
    const selectedHead = people.find((p) => p.id === form.head_id);

    const result = await createDepartment.mutateAsync({
      ...form,
      head_name: selectedHead?.full_name || form.head_name,
      head_avatar: selectedHead?.avatar_url || form.head_avatar,
      software_stack: stackArray,
      member_count: 1,
    });

    navigate(`/departments/${result.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <Link to="/departments">
          <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            Departments
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Initialize Department Craft
          </h1>
          <p className="text-xs text-slate-400">
            Define a studio craft division, lead supervisor, DCC toolchain, and weekly capacity target.
          </p>
        </div>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Lighting & LookDev"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Department Code (2-4 uppercase letters) *</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. LGT"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Head of Department (HoD)</label>
                <select
                  value={form.head_id}
                  onChange={(e) => setForm({ ...form, head_id: e.target.value })}
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
                <label className="block text-xs font-mono text-slate-400 mb-1">Department Color Accent</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-8 bg-slate-950 border border-slate-800 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Weekly Capacity (Hours)</label>
                <input
                  type="number"
                  value={form.capacity_hours_weekly}
                  onChange={(e) => setForm({ ...form, capacity_hours_weekly: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Software Stack (Comma-separated)</label>
                <input
                  type="text"
                  value={form.software_stack}
                  onChange={(e) => setForm({ ...form, software_stack: e.target.value })}
                  placeholder="Houdini, Katana, USD, RenderMan"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description & Pipeline Mandate</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Scope of work, deliverables, and review guidelines..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Link to="/departments">
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={createDepartment.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Create Department
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};
