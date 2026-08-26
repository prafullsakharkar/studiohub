import React, { useState } from 'react';
import {
  Film,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Sparkles,
  Plus,
  User,
  ShieldCheck,
  Edit,
} from 'lucide-react';
import { ProductionVersion } from '@/types/versions';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface VersionReviewsTabProps {
  version: ProductionVersion;
}

export const VersionReviewsTab: React.FC<VersionReviewsTabProps> = ({ version }) => {
  const { addNotification } = useNotificationStore();
  const [isNewReviewOpen, setIsNewReviewOpen] = useState(false);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewNotes, setNewReviewNotes] = useState('');
  const [newReviewStatus, setNewReviewStatus] = useState<'approved' | 'retake' | 'pending'>('approved');

  const [reviewsList, setReviewsList] = useState(version.review_sessions || [
    {
      id: 'rev-01',
      title: 'Dailies Session — Ep04 VFX Lead Polish',
      status: 'approved',
      reviewer_name: 'Elena Rostova',
      reviewer_role: 'VFX Supervisor',
      reviewer_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100',
      created_at: '2026-08-22T14:30:00Z',
      notes: 'Anamorphic flare integration on the cyber spine looks dialed in. Approved to publish to layout stage.',
      annotations_count: 3,
    },
    {
      id: 'rev-02',
      title: 'Director Cinematic Pass Signoff',
      status: 'pending',
      reviewer_name: 'David Fincher (Simulated)',
      reviewer_role: 'Director',
      reviewer_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      created_at: '2026-08-23T09:15:00Z',
      notes: 'Reviewing color grade against final ACES gamut print test.',
      annotations_count: 1,
    },
  ]);

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewTitle) return;

    const newRev = {
      id: `rev-${Date.now()}`,
      title: newReviewTitle,
      status: newReviewStatus,
      reviewer_name: 'Alex Vance (Lead TD)',
      reviewer_role: 'Pipeline Technical Director',
      reviewer_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      created_at: new Date().toISOString(),
      notes: newReviewNotes || 'Signoff recorded in StudioHub review engine.',
      annotations_count: 0,
    };

    setReviewsList([newRev, ...reviewsList]);
    setIsNewReviewOpen(false);
    setNewReviewTitle('');
    setNewReviewNotes('');

    addNotification({
      type: 'success',
      title: 'Review Session Created',
      message: `Review session "${newRev.title}" logged.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-sm font-mono font-bold text-slate-200 uppercase">
            Review Sessions & Feedback Loops
          </h3>
          <p className="text-xs text-slate-400">
            Track daily review reels, supervisor notes, visual annotations, and sign-offs for {version.version_number}.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsNewReviewOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          className="font-mono text-xs"
        >
          New Review Log
        </Button>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {reviewsList.map((rev) => (
          <div
            key={rev.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-3 hover:border-slate-700 transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-mono font-bold text-slate-200 block">{rev.title}</span>
                  <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                    <span>By {rev.reviewer_name} ({rev.reviewer_role})</span>
                    <span>•</span>
                    <span>{new Date(rev.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Badge
                  variant={rev.status === 'approved' ? 'success' : rev.status === 'retake' ? 'destructive' : 'warning'}
                  className="capitalize font-mono text-xs"
                >
                  {rev.status === 'approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {rev.status === 'retake' && <XCircle className="w-3 h-3 mr-1" />}
                  {rev.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                  {rev.status}
                </Badge>
              </div>
            </div>

            {/* Review Notes */}
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80 text-xs text-slate-300 font-mono">
              {rev.notes}
            </div>

            {/* Bottom annotations / actions */}
            <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-slate-500">
              <span className="flex items-center text-slate-400">
                <MessageSquare className="w-3.5 h-3.5 mr-1 text-slate-500" />
                {rev.annotations_count || 0} Canvas Annotations
              </span>
              <div className="flex items-center space-x-2">
                <Button size="xs" variant="ghost">
                  Open Interactive Review
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Review Modal */}
      <Modal isOpen={isNewReviewOpen} onClose={() => setIsNewReviewOpen(false)} title="Record Review Decision" size="md">
        <form onSubmit={handleAddReview} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Session Title</label>
            <input
              type="text"
              required
              value={newReviewTitle}
              onChange={(e) => setNewReviewTitle(e.target.value)}
              placeholder="e.g. VFX Supervisor Daily Review"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Review Decision Status</label>
            <select
              value={newReviewStatus}
              onChange={(e) => setNewReviewStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="approved">Approved (Pass to Next Stage)</option>
              <option value="retake">Retake / Changes Required</option>
              <option value="pending">Pending Further Evaluation</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Supervisor Notes</label>
            <textarea
              value={newReviewNotes}
              onChange={(e) => setNewReviewNotes(e.target.value)}
              rows={3}
              placeholder="Provide exact feedback, timecode stamps, or notes for the artist..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsNewReviewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Decision
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
