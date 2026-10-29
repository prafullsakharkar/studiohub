import React, { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { XCircle, AlertTriangle } from 'lucide-react';

interface DeliveryRejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryId: string;
  onReject: (id: string, reason: string, notes: string) => Promise<any>;
}

export const DeliveryRejectModal: React.FC<DeliveryRejectModalProps> = ({
  isOpen,
  onClose,
  deliveryId,
  onReject,
}) => {
  const [reason, setReason] = useState('Missing Slate Burn-In or Color Metadata');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onReject(deliveryId, reason, notes);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      id="delivery-reject-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="Client Turnover Rejection & Retake Flag"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl text-xs space-y-1 text-rose-200">
          <div className="flex items-center gap-1.5 font-semibold text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Turnover Rejection Warning
          </div>
          <p>
            Rejecting this delivery package notifies the VFX editorial team and triggers a package repackaging task with
            required retakes.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Rejection Category</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
          >
            <option value="Missing Slate Burn-In or Color Metadata">Missing Slate Burn-In or Color Metadata</option>
            <option value="Resolution / Pixel Aspect Ratio Mismatch">Resolution / Pixel Aspect Ratio Mismatch</option>
            <option value="Frame Sequence Drop / Missing Frames">Frame Sequence Drop / Missing Frames</option>
            <option value="Audio Stem Sync Mismatch">Audio Stem Sync Mismatch</option>
            <option value="Editorial Cut Timing Changed">Editorial Cut Timing Changed</option>
            <option value="Other Client QC Failure">Other Client QC Failure</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Detailed QC Notes for Artists</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Specify which shots failed, timecodes, or framing adjustments requested by client editorial..."
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
            leftIcon={<XCircle className="w-3.5 h-3.5" />}
          >
            {loading ? 'Submitting Rejection...' : 'Submit Rejection'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
