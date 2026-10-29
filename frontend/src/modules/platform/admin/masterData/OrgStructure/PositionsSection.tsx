import React, { useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Briefcase, Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import {
  usePlatformPositions,
  useCreatePlatformPosition,
  useUpdatePlatformPosition,
  useDeletePlatformPosition,
  usePlatformDepartments,
} from '@/core/masterData/useMasterData';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export interface PositionsSectionHandle {
  openCreate: () => void;
}

interface PositionsSectionProps {
  searchQuery: string;
  hideHeaderCreateButton?: boolean;
}

export const PositionsSection = forwardRef<PositionsSectionHandle, PositionsSectionProps>(({
  searchQuery,
  hideHeaderCreateButton = false,
}, ref) => {
  const { addNotification } = useNotificationStore();

  const { data: positions = [], isLoading: isPositionsLoading } = usePlatformPositions();
  const createPosMutation = useCreatePlatformPosition();
  const updatePosMutation = useUpdatePlatformPosition();
  const deletePosMutation = useDeletePlatformPosition();

  const { data: departments = [] } = usePlatformDepartments();
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [editingPos, setEditingPos] = useState<any | null>(null);
  const [posFormData, setPosFormData] = useState({
    title: '',
    code: '',
    department: 'Pipeline & Core Tech',
    level: 'Senior',
    band_level: 'L4 - Senior',
    salary_range: '$120k - $150k',
    employment_type: 'Full-Time Staff',
    status: 'Active',
    description: '',
  });

  const [deletePos, setDeletePos] = useState<{ isOpen: boolean; id: string; title: string }>({
    isOpen: false,
    id: '',
    title: '',
  });

  // Filtered Positions
  const filteredPositions = useMemo(() => {
    if (!searchQuery.trim()) return positions;
    const q = searchQuery.toLowerCase();
    return positions.filter(
      (p: any) =>
        p.title?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        (p.department_name || p.department)?.toLowerCase().includes(q) ||
        (p.seniority_level || p.level)?.toLowerCase().includes(q) ||
        p.band_level?.toLowerCase().includes(q)
    );
  }, [positions, searchQuery]);

  const handleOpenCreatePos = () => {
    setEditingPos(null);
    setPosFormData({
      title: '',
      code: '',
      department: departments[0]?.name || 'Pipeline & Core Tech',
      level: 'Senior',
      band_level: 'L4 - Senior',
      salary_range: '$120k - $150k',
      employment_type: 'Full-Time Staff',
      status: 'Active',
      description: '',
    });
    setIsPosModalOpen(true);
  };

  const handleOpenEditPos = (pos: any) => {
    setEditingPos(pos);
    setPosFormData({
      title: pos.title || '',
      code: pos.code || '',
      department: pos.department_name || pos.department || departments[0]?.name || '3D Computer Graphics',
      level: pos.seniority_level || pos.level || 'Senior',
      band_level: pos.band_level || 'L4 - Senior',
      salary_range: pos.salary_range || '$120k - $150k',
      employment_type: pos.employment_type || 'Full-Time Staff',
      status: pos.status || 'Active',
      description: pos.description || '',
    });
    setIsPosModalOpen(true);
  };

  const handleSubmitPos = (e: React.FormEvent) => {
    e.preventDefault();
    if (!posFormData.title.trim()) return;

    if (editingPos) {
      updatePosMutation.mutate(
        {
          id: editingPos.id,
          data: {
            ...posFormData,
          },
        },
        {
          onSuccess: () => {
            addNotification({
              type: 'success',
              title: 'Position Updated',
              message: `Position '${posFormData.title}' updated successfully.`,
            });
            setIsPosModalOpen(false);
          },
          onError: (err: any) => {
            addNotification({
              type: 'error',
              title: 'Update Failed',
              message: err?.message || 'Failed to update position.',
            });
          },
        }
      );
    } else {
      createPosMutation.mutate(
        {
          ...posFormData,
        },
        {
          onSuccess: () => {
            addNotification({
              type: 'success',
              title: 'Position Created',
              message: `Position '${posFormData.title}' created successfully.`,
            });
            setIsPosModalOpen(false);
          },
          onError: (err: any) => {
            addNotification({
              type: 'error',
              title: 'Creation Failed',
              message: err?.message || 'Failed to create position.',
            });
          },
        }
      );
    }
  };

  const handleDeletePos = () => {
    if (!deletePos.id) return;
    deletePosMutation.mutate(deletePos.id, {
      onSuccess: () => {
        addNotification({
          type: 'success',
          title: 'Position Deleted',
          message: `'${deletePos.title}' was removed successfully.`,
        });
        setDeletePos({ isOpen: false, id: '', title: '' });
      },
      onError: (err: any) => {
        addNotification({
          type: 'error',
          title: 'Deletion Failed',
          message: err?.message || 'Failed to delete position.',
        });
      },
    });
  };

  useImperativeHandle(ref, () => ({
    openCreate: handleOpenCreatePos,
  }));

  return (
    <div className="space-y-6">
      
        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-400" />
                Positions & Seniority Levels
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Standardized studio job definitions, compensation bands, and department alignments.
              </p>
            </div>
            {!hideHeaderCreateButton && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreatePos}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-0 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                New Position
              </Button>
            )}
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {isPositionsLoading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading positions...</div>
            ) : filteredPositions.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Briefcase className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">No positions found.</p>
                <Button variant="outline" size="sm" onClick={handleOpenCreatePos}>
                  Create Position
                </Button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Position Title</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Seniority Level</th>
                    <th className="py-3.5 px-4">Band & Salary</th>
                    <th className="py-3.5 px-4">Type & Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {filteredPositions.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition group">
                      <td className="py-4 px-6 font-semibold text-white">
                        <div>
                          <span>{p.title}</span>
                          {p.code && <span className="text-[11px] font-mono text-slate-500 block">{p.code}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-300 text-xs font-medium">
                        {p.department_name || p.department || 'General'}
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          variant="outline"
                          className="text-xs bg-slate-950 text-emerald-300 border-emerald-500/30 font-mono"
                        >
                          {p.seniority_level || p.level || 'Senior'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-xs font-mono text-slate-400">
                        <div>{p.band_level || 'L4 - Staff'}</div>
                        <div className="text-[11px] text-slate-500">{p.salary_range || '$110k - $140k'}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-950 text-slate-300 border border-slate-800">
                            {p.employment_type || 'Full-Time Staff'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditPos(p)}
                            className="h-8 px-2 text-slate-400 hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeletePos({ isOpen: true, id: p.id, title: p.title })
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

      {isPosModalOpen && (
        <Modal
          isOpen={isPosModalOpen}
          onClose={() => setIsPosModalOpen(false)}
          title={editingPos ? `Edit Position: ${editingPos.title}` : 'Create Position'}
          size="md"
        >
          <form onSubmit={handleSubmitPos} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Position Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Lead Pipeline TD, VFX Supervisor"
                value={posFormData.title}
                onChange={(e) => {
                  const val = e.target.value;
                  const autoCode = val.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 12);
                  setPosFormData({
                    ...posFormData,
                    title: val,
                    code: posFormData.code || autoCode,
                  });
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Code Slug *</label>
                <input
                  type="text"
                  required
                  placeholder="LEAD_PIPE_TD"
                  value={posFormData.code}
                  onChange={(e) => setPosFormData({ ...posFormData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Department</label>
                <select
                  value={posFormData.department}
                  onChange={(e) => setPosFormData({ ...posFormData, department: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                  <option value="Executive Leadership">Executive Leadership</option>
                  <option value="Production Management">Production Management</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Seniority Level</label>
                <select
                  value={posFormData.level}
                  onChange={(e) => setPosFormData({ ...posFormData, level: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Principal">Principal / Executive</option>
                  <option value="Lead">Lead Staff</option>
                  <option value="Senior">Senior Specialist</option>
                  <option value="Mid">Mid-Level</option>
                  <option value="Junior">Junior / Associate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Band Level</label>
                <input
                  type="text"
                  placeholder="L5 - Lead Staff"
                  value={posFormData.band_level}
                  onChange={(e) => setPosFormData({ ...posFormData, band_level: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Salary Range</label>
                <input
                  type="text"
                  placeholder="$140k - $180k"
                  value={posFormData.salary_range}
                  onChange={(e) => setPosFormData({ ...posFormData, salary_range: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Employment Type</label>
                <select
                  value={posFormData.employment_type}
                  onChange={(e) => setPosFormData({ ...posFormData, employment_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Full-Time Staff">Full-Time Staff</option>
                  <option value="Contract">Contract</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Job Description</label>
              <textarea
                rows={2}
                placeholder="Core duties, prerequisites, and pipeline expectations."
                value={posFormData.description}
                onChange={(e) => setPosFormData({ ...posFormData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button type="button" variant="ghost" onClick={() => setIsPosModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={createPosMutation.isPending || updatePosMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-0"
              >
                {editingPos ? 'Save Position' : 'Create Position'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deletePos.isOpen && (
        <Modal
          isOpen={deletePos.isOpen}
          onClose={() => setDeletePos({ isOpen: false, id: '', title: '' })}
          title="Delete Position"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-white">Are you sure you want to delete '{deletePos.title}'?</p>
                <p>
                  This action will permanently remove the position from platform master registries and cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletePos({ isOpen: false, id: '', title: '' })}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeletePos}
                isLoading={deletePosMutation.isPending}
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
