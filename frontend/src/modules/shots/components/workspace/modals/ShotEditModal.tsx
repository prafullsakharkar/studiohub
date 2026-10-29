import React, { useState, useEffect } from 'react';
import { Shot } from '@/types/production';
import { ProductionStatus, PriorityLevel } from '@/types/common';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { useShotMutations } from '@/modules/shots/hooks/useShotMutations';

export interface ShotEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  shot: Shot;
}

const STATUS_OPTIONS: ProductionStatus[] = [
  'Not Started',
  'In Progress',
  'Ready for Review',
  'Approved',
  'On Hold',
  'Archived',
];

const PRIORITY_OPTIONS: PriorityLevel[] = ['Low', 'Medium', 'High', 'Critical'];

const DEPARTMENTS = [
  'Compositing',
  'Animation',
  'Lighting',
  'FX',
  'Layout',
  'Matte Painting',
  'Matchmove',
  'Asset/Model',
];

export const ShotEditModal: React.FC<ShotEditModalProps> = ({ isOpen, onClose, shot }) => {
  const { updateShot, isUpdating } = useShotMutations();

  const [formData, setFormData] = useState({
    name: shot.name || '',
    code: shot.code || '',
    sequence_code: shot.sequence_code || '',
    status: shot.status || 'Not Started',
    priority: (shot.priority || 'Medium') as PriorityLevel,
    department: shot.department || 'Compositing',
    frame_in: shot.frame_in || 1001,
    frame_out: shot.frame_out || 1100,
    handle_frames: shot.handle_frames || 8,
    assigned_artist_name: shot.assigned_artist_name || '',
    notes: shot.notes || '',
    description: shot.description || '',
    thumbnail_url: shot.thumbnail_url || '',
    video_url: shot.video_url || '',
  });

  useEffect(() => {
    if (shot) {
      setFormData({
        name: shot.name || '',
        code: shot.code || '',
        sequence_code: shot.sequence_code || '',
        status: shot.status || 'Not Started',
        priority: (shot.priority || 'Medium') as PriorityLevel,
        department: shot.department || 'Compositing',
        frame_in: shot.frame_in || 1001,
        frame_out: shot.frame_out || 1100,
        handle_frames: shot.handle_frames || 8,
        assigned_artist_name: shot.assigned_artist_name || '',
        notes: shot.notes || '',
        description: shot.description || '',
        thumbnail_url: shot.thumbnail_url || '',
        video_url: shot.video_url || '',
      });
    }
  }, [shot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const frame_count = Math.max(1, Number(formData.frame_out) - Number(formData.frame_in) + 1);

    await updateShot({
      id: shot.id,
      data: {
        ...formData,
        frame_in: Number(formData.frame_in),
        frame_out: Number(formData.frame_out),
        frame_count,
        handle_frames: Number(formData.handle_frames),
      },
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Shot ${shot.code}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Shot Code</label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
              placeholder="e.g. SH010"
              className="font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Sequence Code</label>
            <Input
              value={formData.sequence_code}
              onChange={(e) => setFormData({ ...formData, sequence_code: e.target.value })}
              required
              placeholder="e.g. SQ01"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Production Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ProductionStatus })}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500"
            >
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as PriorityLevel })}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500"
            >
              {PRIORITY_OPTIONS.map((pr) => (
                <option key={pr} value={pr}>
                  {pr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Frame In (Head)</label>
            <Input
              type="number"
              value={formData.frame_in}
              onChange={(e) => setFormData({ ...formData, frame_in: Number(e.target.value) })}
              required
              className="font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Frame Out (Tail)</label>
            <Input
              type="number"
              value={formData.frame_out}
              onChange={(e) => setFormData({ ...formData, frame_out: Number(e.target.value) })}
              required
              className="font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Handles (Frames)</label>
            <Input
              type="number"
              value={formData.handle_frames}
              onChange={(e) => setFormData({ ...formData, handle_frames: Number(e.target.value) })}
              required
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Lead Artist</label>
          <Input
            value={formData.assigned_artist_name}
            onChange={(e) => setFormData({ ...formData, assigned_artist_name: e.target.value })}
            placeholder="e.g. Elena Rostova"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Turnover & Editorial Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder="Client brief, supervisor instructions, tracking references, or delivery specs..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isUpdating}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
