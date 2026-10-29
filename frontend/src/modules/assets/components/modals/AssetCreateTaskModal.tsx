import { useTaskMutations } from '@/modules/tasks';
import type { Asset, Task } from '@/types/production';
import React, { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { ProductionStatus, PriorityLevel, Department } from '@/types/common';

export interface AssetCreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
}

export const AssetCreateTaskModal: React.FC<AssetCreateTaskModalProps> = ({ isOpen, onClose, asset }) => {
  const { createTask, isCreating } = useTaskMutations();
  const { addNotification } = useNotificationStore();

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState<Department>('3D Modeling & Assets');
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [assigneeName, setAssigneeName] = useState(asset.assigned_artist_name || 'Sarah Jenkins');
  const [estimatedHours, setEstimatedHours] = useState(24);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [software, setSoftware] = useState(asset.software ? `${asset.software} 2025` : 'Maya 2025');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const taskCode = `TSK-${asset.code.replace('AST_', '')}-${department.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;
      await createTask({
        title: title || `${department} for ${asset.name}`,
        code: taskCode,
        project_id: asset.project_id,
        project_code: asset.project_code,
        entity_type: 'Asset',
        entity_id: asset.id,
        entity_code: asset.code,
        department,
        status: 'Not Started' as ProductionStatus,
        priority,
        assignee_name: assigneeName,
        assignee_id: 'usr-004',
        assignee_avatar: asset.assigned_artist_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        due_date: dueDate,
        estimated_hours: Number(estimatedHours),
        logged_hours: 0,
        software,
        description: description || `Task created from Asset Workspace for ${asset.name} (${asset.code})`,
      } as Partial<Task>);

      addNotification({
        type: 'success',
        title: 'Task Created',
        message: `Task ${taskCode} created for asset ${asset.code}.`,
      });
      onClose();
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Task Creation Failed',
        message: 'Could not create task. Please try again.',
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Create Task for Asset ${asset.code}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title / Step</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`e.g. ${department} - Hi-Poly Sculpt & UV Layout`}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="3D Modeling & Assets">3D Modeling & Assets</option>
              <option value="LookDev & Shading">LookDev & Shading</option>
              <option value="Character & Creature Rigging">Rigging & Deformation</option>
              <option value="CFX & Groom">CFX & Groom</option>
              <option value="FX & Simulation">FX & Simulation</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Artist</label>
            <Input
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="Artist name..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">DCC Tool</label>
            <Input
              value={software}
              onChange={(e) => setSoftware(e.target.value)}
              placeholder="e.g. Maya 2025 / ZBrush"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Estimated Hours</label>
            <Input
              type="number"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(Number(e.target.value))}
              min={1}
              max={200}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Due Date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Task Deliverable Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Specific topology limits, polygon quotas, shader specifications or layer conventions..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isCreating}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
};
