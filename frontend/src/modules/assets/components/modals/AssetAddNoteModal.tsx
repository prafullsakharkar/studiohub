import React, { useState } from 'react';
import type { Asset } from '@/types/production';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { useAssetMutations } from '@/modules/assets/hooks/useAssetMutations';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export interface AssetAddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
  onNoteAdded?: (note: any) => void;
}

export const AssetAddNoteModal: React.FC<AssetAddNoteModalProps> = ({
  isOpen,
  onClose,
  asset,
  onNoteAdded,
}) => {
  const { user } = useCurrentUser();
  const { updateAsset, isUpdating } = useAssetMutations();
  const { addNotification } = useNotificationStore();

  const [category, setCategory] = useState<'Creative' | 'Technical' | 'LookDev' | 'Rigging' | 'Editorial' | 'General'>('Creative');
  const [content, setContent] = useState('');
  const [department, setDepartment] = useState(asset.department_name || '3D Modeling & Assets');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const newNote = {
      id: `note-ast-${Date.now()}`,
      category,
      department,
      content,
      author: (user as any)?.full_name || (user as any)?.name || user?.email || 'Asset Lead TD',
      avatar: (user as any)?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      created_at: new Date().toISOString(),
    };

    const existingDesc = asset.description ? `${asset.description}\n\n[Note - ${category} / ${department}]: ${content}` : `[Note - ${category} / ${department}]: ${content}`;

    await updateAsset({
      id: asset.id,
      data: {
        description: existingDesc,
      },
    });

    if (onNoteAdded) {
      onNoteAdded(newNote);
    }

    addNotification({
      type: 'success',
      title: 'Note Added',
      message: `Production note logged for asset ${asset.code}.`,
    });
    setContent('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Add Production Note — ${asset.code}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Creative">Creative Direction & Feedback</option>
              <option value="Technical">Technical QC & Topology</option>
              <option value="LookDev">MaterialX & Texture Notes</option>
              <option value="Rigging">Skeletal & Deformer Notes</option>
              <option value="Editorial">Turnover & Layout Notice</option>
              <option value="General">General Note</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="3D Modeling & Assets">3D Modeling & Assets</option>
              <option value="LookDev & Shading">LookDev & Shading</option>
              <option value="Character & Creature Rigging">Rigging & Deformation</option>
              <option value="CFX & Groom">CFX & Groom</option>
              <option value="FX & Simulation">FX Simulation</option>
              <option value="VFX Supervision">Supervision</option>
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
            placeholder="Feedback regarding silhouette, UV padding, displacement maps, skin weights or USD variant sets..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
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
