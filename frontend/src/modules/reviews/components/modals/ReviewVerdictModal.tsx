import React, { useState } from 'react';
import { ReviewSession } from '@/types/reviews';
import { Button } from '@/shared/components/Button';
import { CheckCircle2, AlertTriangle, XCircle, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';

interface ReviewVerdictModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: ReviewSession;
  verdictType: 'Approved' | 'Changes Requested' | 'Rejected';
  onConfirm: (notes: string, actorName: string) => Promise<any>;
  isLoading?: boolean;
}

export const ReviewVerdictModal: React.FC<ReviewVerdictModalProps> = ({
  isOpen,
  onClose,
  review,
  verdictType,
  onConfirm,
  isLoading,
}) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(notes, user?.full_name || 'Alex Chen');
    onClose();
  };

  const getHeaderInfo = () => {
    switch (verdictType) {
      case 'Approved':
        return {
          title: 'Approve Cut Version',
          color: 'emerald',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          desc: `Confirm supervisor sign-off on ${review.entity_code} (${review.version_number}). This marks the cut version as ready for downstream client turnover or final mastering.`,
          buttonText: 'Confirm Approval',
          buttonClass: 'bg-emerald-600 hover:bg-emerald-500',
        };
      case 'Changes Requested':
        return {
          title: 'Request Changes',
          color: 'amber',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          desc: `Send actionable revision notes for ${review.entity_code} (${review.version_number}). The assigned artist will be notified to address these comments.`,
          buttonText: 'Submit Change Request',
          buttonClass: 'bg-amber-600 hover:bg-amber-500',
        };
      case 'Rejected':
        return {
          title: 'Reject & Mark for Retake',
          color: 'rose',
          icon: <XCircle className="w-5 h-5 text-rose-400" />,
          desc: `Reject ${review.entity_code} (${review.version_number}) and mandate a complete turnover retake.`,
          buttonText: 'Confirm Retake Rejection',
          buttonClass: 'bg-rose-600 hover:bg-rose-500',
        };
    }
  };

  const header = getHeaderInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl bg-${header.color}-500/10 border border-${header.color}-500/20`}>
              {header.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{header.title}</h3>
              <p className="text-[11px] font-mono text-slate-400">
                {review.entity_code} • {review.version_number}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">{header.desc}</p>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Review Directives & Feedback Notes:
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                verdictType === 'Approved'
                  ? 'e.g. Gorgeous work on edge integration and smoke depth! Approved for DI master.'
                  : 'e.g. Flare falloff on edge is 0.05 too hot, please tone down and resubmit v004...'
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Sign-Off Lead:</span>
            <span className="text-white font-semibold">
              {user?.full_name || 'Alex Chen'} ({user?.role || 'VFX Supervisor'})
            </span>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onClose}
              className="text-xs border-slate-700 text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isLoading}
              className={`text-xs text-white ${header.buttonClass}`}
            >
              {header.buttonText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
