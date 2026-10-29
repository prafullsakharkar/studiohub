import React, { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { CheckCircle2 } from 'lucide-react';

interface DeliveryApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryId: string;
  onApprove: (id: string, actorName?: string, notes?: string) => Promise<any>;
}

export const DeliveryApprovalModal: React.FC<DeliveryApprovalModalProps> = ({
  isOpen,
  onClose,
  deliveryId,
  onApprove,
}) => {
  const [approverName, setApproverName] = useState('Michael Sterling (Post Exec)');
  const [notes, setNotes] = useState('All 4K EXRs and ProRes slates approved for final online conform.');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onApprove(deliveryId, approverName, notes);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      id="delivery-approval-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Client Turnover Acceptance & Approval"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs space-y-1 text-emerald-200">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Client Acceptance
          </div>
          <p>
            Approving locks the delivery version manifest, records the SHA-256 hash snapshot, and marks the milestone
            as accepted.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Approved By (Representative)</label>
          <input
            type="text"
            value={approverName}
            onChange={(e) => setApproverName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Sign-off Approval Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            {loading ? 'Approving...' : 'Sign-Off & Approve'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
