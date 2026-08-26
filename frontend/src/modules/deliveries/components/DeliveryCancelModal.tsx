import React, { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Ban } from 'lucide-react';

interface DeliveryCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryId: string;
  onCancel: (id: string, reason: string) => Promise<any>;
}

export const DeliveryCancelModal: React.FC<DeliveryCancelModalProps> = ({
  isOpen,
  onClose,
  deliveryId,
  onCancel,
}) => {
  const [reason, setReason] = useState('Turnover rescheduled / Superseded by new turnover schedule');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onCancel(deliveryId, reason);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      id="delivery-cancel-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Turnover Package"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-300">
          Cancelling will withdraw the pending delivery package from transfer queues and mark the delivery record as
          cancelled.
        </p>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Cancellation</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-slate-600"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Back
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-white"
            leftIcon={<Ban className="w-3.5 h-3.5" />}
          >
            {loading ? 'Cancelling...' : 'Cancel Delivery'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
