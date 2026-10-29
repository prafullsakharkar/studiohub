import { useTaskMutations } from '@/modules/tasks/hooks/useTasks';
import React, { useState } from 'react';
import { Shot } from '@/types/production';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { ProductionStatus, PriorityLevel } from '@/types/common';

export interface ShotCreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  shot: Shot;
}

export const ShotCreateTaskModal: React.FC<ShotCreateTaskModalProps> = ({ isOpen, onClose, shot }) => {
  const { createTask } = useTaskMutations();
  const { addNotification } = useNotificationStore();

  const [name, setName] = useState('');
  const [department, setDepartment] = useState(shot.department || 'Compositing');
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [assigneeName, setAssigneeName] = useState(shot.assigned_artist_name || '');
  const [estimatedHours, setEstimatedHours] = useState(16);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const taskCode = `${shot.code}_${department.slice(0, 4).toUpperCase()}_01`;
      await createTask.mutateAsync({
        name: name || `${department} Task for ${shot.code}`,
        code: taskCode,
        project_id: shot.project_id,
        project_code: shot.project_code,
        shot_id: shot.id,
        sequence_code: shot.sequence_code,
        department,
        status: 'Not Started' as ProductionStatus,
        priority,
        assignee_name: assigneeName,
        estimated_hours: Number(estimatedHours),
        description: description || `Task created from Shot Workspace for ${shot.code}`,
        progress: 0,
      } as any);

      addNotification({
        type: 'success',
        title: 'Task Created',
        message: `Task added to shot ${shot.code}.`,
      });
      onClose();
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Task Creation Failed',
        message: 'Could not create task. Please retry.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Create Task for Shot ${shot.code}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Task Name / Step</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. ${department} Final Polish & Clean Plate`}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Compositing">Compositing</option>
              <option value="Animation">Animation</option>
              <option value="Lighting">Lighting</option>
              <option value="FX">FX</option>
              <option value="Layout">Layout</option>
              <option value="Matte Painting">Matte Painting</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Artist</label>
            <Input
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="Artist name..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Estimated Hours (Bids)</label>
            <Input
              type="number"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(Number(e.target.value))}
              min={1}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Task Brief & Requirements</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Specific instructions, tracking markers to paint out, matte requirements..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
};
