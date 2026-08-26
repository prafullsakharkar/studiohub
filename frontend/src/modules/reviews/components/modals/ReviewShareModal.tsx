import React, { useState } from 'react';
import { ReviewSession } from '@/types/reviews';
import { Button } from '@/shared/components/Button';
import { Share2, Copy, Check, Lock, Shield, Eye, X, Building } from 'lucide-react';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ReviewShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: ReviewSession;
}

export const ReviewShareModal: React.FC<ReviewShareModalProps> = ({
  isOpen,
  onClose,
  review,
}) => {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [copied, setCopied] = useState(false);
  const [allowClientApproval, setAllowClientApproval] = useState(true);
  const [requirePasscode, setRequirePasscode] = useState(false);
  const [passcode, setPasscode] = useState('NK99-REV-4482');

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/review/share/${review.code}?token=tok_${review.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    addNotification({
      type: 'success',
      title: 'Review Link Copied',
      message: 'Secure shareable link copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Share Review Session</h3>
              <p className="text-[11px] font-mono text-slate-400">
                {review.title} ({review.code})
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
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Generate an authenticated screening link for external clients (
            <strong className="text-white">{review.client?.name || 'Authorized Client'}</strong>), studio executives, or remote reviewers.
          </p>

          {/* Share Link Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono text-slate-400">Client Access URL:</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 focus:outline-none select-all"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopyLink}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 whitespace-nowrap"
                leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Access Control Preferences */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 text-xs">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
              Security & Permissions
            </span>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                Allow Client Approval Sign-Off
              </span>
              <input
                type="checkbox"
                checked={allowClientApproval}
                onChange={(e) => setAllowClientApproval(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Enforce Passcode Protection
              </span>
              <input
                type="checkbox"
                checked={requirePasscode}
                onChange={(e) => setRequirePasscode(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-600"
              />
            </label>

            {requirePasscode && (
              <div className="pt-1">
                <input
                  type="text"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-amber-300"
                  placeholder="Enter passcode..."
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs border-slate-700 text-slate-300 hover:text-white"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
