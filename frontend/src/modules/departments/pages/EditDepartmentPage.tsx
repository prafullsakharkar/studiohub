import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layers, ChevronLeft, Save } from 'lucide-react';
import { useDepartment, useDepartmentMutations, usePeople } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export const EditDepartmentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: dept, isLoading } = useDepartment(id || '');
  const { updateDepartment } = useDepartmentMutations();
  const { data: peopleData } = usePeople();
  const people = peopleData?.results || [];

  const [form, setForm] = useState({
    name: '',
    code: '',
    head_id: '',
    head_name: '',
    head_avatar: '',
    color: '#6366f1',
    description: '',
    software_stack: '',
    capacity_hours_weekly: 160,
    utilization_percentage: 75,
  });

  useEffect(() => {
    if (dept) {
      setForm({
        name: dept.name,
        code: dept.code,
        head_id: dept.head_id,
        head_name: dept.head_name,
        head_avatar: dept.head_avatar,
        color: dept.color,
        description: dept.description,
        software_stack: (dept.software_stack || []).join(', '),
        capacity_hours_weekly: dept.capacity_hours_weekly || 160,
        utilization_percentage: dept.utilization_percentage || 75,
      });
    }
  }, [dept]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!dept) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-lg font-bold text-white">Department Not Found</h2>
        <Link to="/departments">
          <Button variant="outline" size="sm">Back to Departments</Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stackArray = form.software_stack.split(',').map((s) => s.trim()).filter(Boolean);
    const selectedHead = people.find((p) => p.id === form.head_id);

    await updateDepartment.mutateAsync({
      id: dept.id,
      data: {
        ...form,
        head_name: selectedHead?.full_name || form.head_name,
        head_avatar: selectedHead?.avatar_url || form.head_avatar,
        software_stack: stackArray,
      },
    });

    navigate(`/departments/${dept.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <Link to={`/departments/${dept.id}`}>
          <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            Back to Department
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Edit Department: {dept.name}
          </h1>
          <p className="text-xs text-slate-400">
            Update craft lead, software stack, and weekly operational capacity.
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Department Code *</label>
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
                <label className="block text-xs font-mono text-slate-400 mb-1">Head of Department</label>
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Link to={`/departments/${dept.id}`}>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={updateDepartment.isPending}
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
