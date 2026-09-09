import React, { useState } from 'react';
import { PublishItem } from '@/types/publishing';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Archive, AlertTriangle } from 'lucide-react';

interface UnpublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PublishItem | null;
  onConfirm: (id: string, reason: string, userName: string) => Promise<any>;
}

export const UnpublishModal: React.FC<UnpublishModalProps> = ({
  isOpen,
  onClose,
  item,
  onConfirm,
}) => {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(item.id, reason, user?.full_name || 'Alex Chen');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      id="unpublish-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={`Unpublish & Deprecate ${item.publish_code}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl text-xs space-y-1 text-rose-200">
          <div className="flex items-center gap-1.5 font-semibold text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Deprecation Warning
          </div>
          <p>
            Unpublishing will mark this asset/shot cut version as deprecated. Downstream departments and delivery
            turnovers will be flagged to discontinue referencing this specific version pointer.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Reason for Deprecation / Unpublishing
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Cut omitted by editorial, major asset redesign requested, incorrect color primaries..."
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
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
            className="text-xs bg-rose-600 hover:bg-rose-500 text-white"
            leftIcon={<Archive className="w-3.5 h-3.5" />}
          >
            {loading ? 'Processing...' : 'Confirm Deprecation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
