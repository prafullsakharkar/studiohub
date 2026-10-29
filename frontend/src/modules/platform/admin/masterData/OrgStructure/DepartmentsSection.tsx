import React, { useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Building2, Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import {
  usePlatformDepartments,
  useCreatePlatformDepartment,
  useUpdatePlatformDepartment,
  useDeletePlatformDepartment,
} from '@/core/masterData/useMasterData';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

const DEPT_COLOR_PRESETS =  ['#06b6d4', '#a855f7', '#3b82f6', '#f97316', '#eab308', '#10b981', '#ec4899', '#6366f1'];
const POPULAR_DCC_SUITES =  ['Maya', 'Houdini', 'Nuke', 'ZBrush', 'Blender', 'Katana', 'Solaris', 'RenderMan', 'DaVinci Resolve', 'OpenUSD', 'Python'];

export interface DepartmentsSectionHandle {
  openCreate: () => void;
}

interface DepartmentsSectionProps {
  searchQuery: string;
  hideHeaderCreateButton?: boolean;
}

export const DepartmentsSection = forwardRef<DepartmentsSectionHandle, DepartmentsSectionProps>(({
  searchQuery,
  hideHeaderCreateButton = false,
}, ref) => {
  const { addNotification } = useNotificationStore();

  const { data: departments = [], isLoading: isDepartmentsLoading } = usePlatformDepartments();
  const createDeptMutation = useCreatePlatformDepartment();
  const updateDeptMutation = useUpdatePlatformDepartment();
  const deleteDeptMutation = useDeletePlatformDepartment();

  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [deptFormData, setDeptFormData] = useState({
    name: '',
    code: '',
    lead: '',
    color: '#06b6d4',
    description: '',
    software_stack: [] as string[],
    capacity_hours_weekly: 200,
  });

  const [deleteDept, setDeleteDept] = useState<{ isOpen: boolean; id: string; title: string }>({
    isOpen: false,
    id: '',
    title: '',
  });

  // Filtered Departments
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departments;
    const q = searchQuery.toLowerCase();
    return departments.filter(
      (d: any) =>
        d.name?.toLowerCase().includes(q) ||
        d.code?.toLowerCase().includes(q) ||
        (d.head_name || d.lead)?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        (d.software_stack && d.software_stack.some((s: string) => s.toLowerCase().includes(q)))
    );
  }, [departments, searchQuery]);

  const handleOpenCreateDept = () => {
    setEditingDept(null);
    setDeptFormData({
      name: '',
      code: '',
      lead: 'Alex Chen',
      color: '#06b6d4',
      description: '',
      software_stack: ['Maya', 'Nuke'],
      capacity_hours_weekly: 240,
    });
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = (dept: any) => {
    setEditingDept(dept);
    setDeptFormData({
      name: dept.name || '',
      code: dept.code || '',
      lead: dept.head_name || dept.lead || '',
      color: dept.color || '#06b6d4',
      description: dept.description || '',
      software_stack: dept.software_stack ? [...dept.software_stack] : ['Maya'],
      capacity_hours_weekly: dept.capacity_hours_weekly || 200,
    });
    setIsDeptModalOpen(true);
  };

  const handleSubmitDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptFormData.name.trim()) return;

    if (editingDept) {
      updateDeptMutation.mutate(
        { id: editingDept.id, data: deptFormData },
        {
          onSuccess: () => {
            addNotification({
              type: 'success',
              title: 'Department Updated',
              message: `Department '${deptFormData.name}' updated successfully.`,
            });
            setIsDeptModalOpen(false);
          },
          onError: (err: any) => {
            addNotification({
              type: 'error',
              title: 'Update Failed',
              message: err?.message || 'Failed to update department.',
            });
          },
        }
      );
    } else {
      createDeptMutation.mutate(deptFormData, {
        onSuccess: () => {
          addNotification({
            type: 'success',
            title: 'Department Created',
            message: `Department '${deptFormData.name}' created successfully.`,
          });
          setIsDeptModalOpen(false);
        },
        onError: (err: any) => {
          addNotification({
            type: 'error',
            title: 'Creation Failed',
            message: err?.message || 'Failed to create department.',
          });
        },
      });
    }
  };

  const handleDeleteDept = () => {
    if (!deleteDept.id) return;
    deleteDeptMutation.mutate(deleteDept.id, {
      onSuccess: () => {
        addNotification({
          type: 'success',
          title: 'Department Deleted',
          message: `'${deleteDept.title}' was removed successfully.`,
        });
        setDeleteDept({ isOpen: false, id: '', title: '' });
      },
      onError: (err: any) => {
        addNotification({
          type: 'error',
          title: 'Deletion Failed',
          message: err?.message || 'Failed to delete department.',
        });
      },
    });
  };

  useImperativeHandle(ref, () => ({
    openCreate: handleOpenCreateDept,
  }));

  return (
    <div className="space-y-6">
      
        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Platform Departments
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Standard functional departments, leads, canonical DCC stacks, and pipeline capacities.
              </p>
            </div>
            {!hideHeaderCreateButton && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreateDept}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold border-0 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                New Department
              </Button>
            )}
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {isDepartmentsLoading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading departments...</div>
            ) : filteredDepartments.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">No departments found.</p>
                <Button variant="outline" size="sm" onClick={handleOpenCreateDept}>
                  Create Department
                </Button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Department Name</th>
                    <th className="py-3.5 px-4">Code</th>
                    <th className="py-3.5 px-4">Department Lead</th>
                    <th className="py-3.5 px-4">DCC Software Stack</th>
                    <th className="py-3.5 px-4 text-center">Weekly Capacity</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {filteredDepartments.map((d: any) => (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition group">
                      <td className="py-4 px-6 font-semibold text-white">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: d.color || '#06b6d4' }}
                          />
                          <div>
                            <span>{d.name}</span>
                            {d.description && <p className="text-[11px] text-slate-400 font-normal">{d.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-cyan-300">{d.code}</td>
                      <td className="py-4 px-4 text-slate-300 text-xs font-medium">{d.head_name || d.lead || 'Unassigned'}</td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {d.software_stack && d.software_stack.length > 0 ? (
                            d.software_stack.map((s: string) => (
                              <span
                                key={s}
                                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-950 text-cyan-300 border border-cyan-500/20"
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500 italic">Standard Pipeline</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-slate-300 text-xs">
                        <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
                          {d.capacity_hours_weekly || 200} hrs / wk
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDept(d)}
                            className="h-8 px-2 text-slate-400 hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDept({ isOpen: true, id: d.id, title: d.name })
                            }
                            className="h-8 px-2 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

      {isDeptModalOpen && (
        <Modal
          isOpen={isDeptModalOpen}
          onClose={() => setIsDeptModalOpen(false)}
          title={editingDept ? `Edit Department: ${editingDept.name}` : 'Create Department'}
          size="md"
        >
          <form onSubmit={handleSubmitDept} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Department Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. 3D Computer Graphics, Visual FX"
                value={deptFormData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  const autoCode = val.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 5);
                  setDeptFormData({
                    ...deptFormData,
                    name: val,
                    code: deptFormData.code || autoCode,
                  });
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Code Slug *</label>
                <input
                  type="text"
                  required
                  placeholder="3D"
                  value={deptFormData.code}
                  onChange={(e) => setDeptFormData({ ...deptFormData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Department Lead</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marcus Vance"
                  value={deptFormData.lead}
                  onChange={(e) => setDeptFormData({ ...deptFormData, lead: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={deptFormData.color}
                    onChange={(e) => setDeptFormData({ ...deptFormData, color: e.target.value })}
                    className="w-9 h-9 rounded bg-transparent border-0 cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-1">
                    {DEPT_COLOR_PRESETS.slice(0, 4).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDeptFormData({ ...deptFormData, color: c })}
                        className="w-5 h-5 rounded-full border border-slate-700"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Weekly Capacity (Hours)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={deptFormData.capacity_hours_weekly}
                  onChange={(e) =>
                    setDeptFormData({ ...deptFormData, capacity_hours_weekly: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            {/* Software Stack Selection */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">DCC Software Stack</label>
              <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                {POPULAR_DCC_SUITES.map((tool) => {
                  const isSelected = deptFormData.software_stack.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setDeptFormData({
                            ...deptFormData,
                            software_stack: deptFormData.software_stack.filter((t) => t !== tool),
                          });
                        } else {
                          setDeptFormData({
                            ...deptFormData,
                            software_stack: [...deptFormData.software_stack, tool],
                          });
                        }
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {tool}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Department focus and production domains."
                value={deptFormData.description}
                onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button type="button" variant="ghost" onClick={() => setIsDeptModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={createDeptMutation.isPending || updateDeptMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold border-0"
              >
                {editingDept ? 'Save Department' : 'Create Department'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteDept.isOpen && (
        <Modal
          isOpen={deleteDept.isOpen}
          onClose={() => setDeleteDept({ isOpen: false, id: '', title: '' })}
          title="Delete Department"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-white">Are you sure you want to delete '{deleteDept.title}'?</p>
                <p>
                  This action will permanently remove the department from platform master registries and cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteDept({ isOpen: false, id: '', title: '' })}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteDept}
                isLoading={deleteDeptMutation.isPending}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
});
