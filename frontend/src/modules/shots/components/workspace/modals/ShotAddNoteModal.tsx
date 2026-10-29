import React, { useState } from 'react';
import { Shot } from '@/types/production';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { useShotMutations } from '@/modules/shots/hooks/useShotMutations';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';

export interface ShotAddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  shot: Shot;
  onNoteAdded?: (note: any) => void;
}

export const ShotAddNoteModal: React.FC<ShotAddNoteModalProps> = ({
  isOpen,
  onClose,
  shot,
  onNoteAdded,
}) => {
  const recordActivity = useActivityStore((state) => state.recordActivity);
  const { user } = useCurrentUser();
  const { updateShot, isUpdating } = useShotMutations();
  const { addNotification } = useNotificationStore();

  const [category, setCategory] = useState<'Creative' | 'Technical' | 'Turnover' | 'Client' | 'General'>('Creative');
  const [content, setContent] = useState('');
  const [department, setDepartment] = useState(shot.department || 'Compositing');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const newNote = {
      id: `note-${Date.now()}`,
      category,
      department,
      content,
      author: (user as any)?.full_name || (user as any)?.name || user?.email || 'Production Supervisor',
      created_at: new Date().toISOString(),
    };

    // Append to shot notes or update shot
    const existingNotes = shot.notes ? `${shot.notes}\n\n[${category} - ${department}]: ${content}` : `[${category} - ${department}]: ${content}`;
    
    await updateShot({
      id: shot.id,
      data: {
        notes: existingNotes,
      },
    });

    recordActivity({
      action: 'commented',
      actionLabel: 'Note Added',
      resourceType: 'shot',
      resourceId: shot.id,
      resourceName: shot.code,
      resourceCode: shot.code,
      projectId: shot.project_id,
      context: shot.code,
      description: `Added ${category} note to ${shot.code}: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
      tags: ['Shot', 'Note', category],
    });

    if (onNoteAdded) {
      onNoteAdded(newNote);
    }

    addNotification({
      type: 'success',
      title: 'Note Added',
      message: `Production note logged for shot ${shot.code}.`,
    });
    setContent('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Add Production Note — ${shot.code}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Creative">Creative Direction</option>
              <option value="Technical">Technical QC / Pipeline</option>
              <option value="Turnover">Editorial Turnover</option>
              <option value="Client">Client Review Feedback</option>
              <option value="General">General Note</option>
            </select>
          </div>

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
              <option value="Editorial">Editorial</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Note Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            required
            placeholder="Enter instructions, notes on grain matching, edge quality, depth-of-field or color balance..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isUpdating}>
            Add Note
          </Button>
        </div>
      </form>
    </Modal>
  );
};
