import React, { useState } from 'react';
import { PublishItem } from '@/types/publishing';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface RepublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PublishItem | null;
  onConfirm: (id: string, comment: string, artistName: string) => Promise<any>;
}

export const RepublishModal: React.FC<RepublishModalProps> = ({
  isOpen,
  onClose,
  item,
  onConfirm,
}) => {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  if (!item) return null;

  const nextVersionNum = `v${(parseInt(item.version_number.replace(/\D/g, '') || '1') + 1)
    .toString()
    .padStart(3, '0')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(item.id, comment, user?.full_name || 'Alex Chen');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      id="republish-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={`Republish ${item.entity_code}: ${item.version_number} ➔ ${nextVersionNum}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-indigo-950/20 border border-indigo-500/30 rounded-xl text-xs space-y-1 text-indigo-200">
          <div className="flex items-center gap-1.5 font-semibold text-indigo-400">
            <RefreshCw className="w-3.5 h-3.5" />
            Incremental Iteration Notice
          </div>
          <p>
            Republishing increments the pipeline pointer from{' '}
            <strong className="text-white font-mono">{item.version_number}</strong> to{' '}
            <strong className="text-emerald-400 font-mono">{nextVersionNum}</strong>. Existing render assets and previous
            snapshots are retained in history.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Reason for Iteration / Revision Notes
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Fixed matte edge fringe, matched background grade, updated USD stage cache..."
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            {loading ? 'Processing...' : `Republish as ${nextVersionNum}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
