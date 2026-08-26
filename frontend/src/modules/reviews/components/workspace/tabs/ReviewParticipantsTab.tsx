import React, { useState } from 'react';
import { ReviewSession, ReviewParticipant } from '@/types/reviews';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import {
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Plus,
  Mail,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';

interface ReviewParticipantsTabProps {
  review: ReviewSession;
  onUpdateVerdict?: (participantId: string, verdict: ReviewParticipant['verdict'], notes?: string) => Promise<any>;
}

export const ReviewParticipantsTab: React.FC<ReviewParticipantsTabProps> = ({
  review,
  onUpdateVerdict,
}) => {
  const { user } = useAuth();
  const reviewers = review.reviewers || [];

  const [selectedVerdict, setSelectedVerdict] = useState<ReviewParticipant['verdict']>('Approved');
  const [verdictNotes, setVerdictNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUserParticipant = reviewers.find((r) => r.user_id === user?.id || r.email === user?.email);

  const handleCastVerdict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserParticipant && reviewers.length === 0) return;
    setIsSubmitting(true);
    try {
      if (onUpdateVerdict) {
        await onUpdateVerdict(
          currentUserParticipant?.id || reviewers[0]?.id,
          selectedVerdict,
          verdictNotes
        );
      }
      setVerdictNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="review-participants-tab" className="p-6 space-y-6 max-w-5xl mx-auto custom-scrollbar overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            Review Participants & Sign-Off Matrix ({reviewers.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Stakeholder approval status, required sign-offs, and department representatives.
          </p>
        </div>
      </div>

      {/* Cast Individual Verdict Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="py-3 px-4 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Cast Your Stakeholder Verdict
          </h4>
          <span className="text-xs font-mono text-slate-400">
            Acting as: <strong className="text-white">{user?.full_name || 'Alex Chen'}</strong> ({user?.role || 'VFX Supervisor'})
          </span>
        </CardHeader>
        <CardBody className="p-4 space-y-4">
          {/* Verdict Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSelectedVerdict('Approved')}
              className={`p-3 rounded-xl border flex items-center space-x-3 transition-all ${
                selectedVerdict === 'Approved'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-bold">Approve Cut</div>
                <div className="text-[10px] opacity-70">Ready for final client/mastering</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedVerdict('Changes Requested')}
              className={`p-3 rounded-xl border flex items-center space-x-3 transition-all ${
                selectedVerdict === 'Changes Requested'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/30'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-bold">Request Changes</div>
                <div className="text-[10px] opacity-70">Minor tweaks or notes attached</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedVerdict('Rejected')}
              className={`p-3 rounded-xl border flex items-center space-x-3 transition-all ${
                selectedVerdict === 'Rejected'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500/30'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-bold">Reject Cut</div>
                <div className="text-[10px] opacity-70">Needs substantial rework</div>
              </div>
            </button>
          </div>

          <textarea
            rows={2}
            value={verdictNotes}
            onChange={(e) => setVerdictNotes(e.target.value)}
            placeholder="Add specific remarks or sign-off reasoning..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
          />

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCastVerdict}
              isLoading={isSubmitting}
              className="text-xs bg-indigo-600 hover:bg-indigo-500"
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Submit Sign-Off Verdict
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Participants List */}
      <div className="space-y-3">
        {reviewers.map((rev) => (
          <Card key={rev.id} className="bg-slate-900 border-slate-800">
            <CardBody className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <img
                  src={rev.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                  alt={rev.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">{rev.name}</span>
                    {rev.is_required && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono text-[10px] font-bold">
                        Mandatory Sign-off
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{rev.role}</span>
                    {rev.email && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {rev.email}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                {rev.verdict_date && (
                  <span className="text-[10px] font-mono text-slate-500">
                    Signed off: {new Date(rev.verdict_date).toLocaleDateString()}
                  </span>
                )}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                    rev.verdict === 'Approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : rev.verdict === 'Changes Requested'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : rev.verdict === 'Rejected'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {rev.verdict === 'Approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {rev.verdict === 'Changes Requested' && <AlertTriangle className="w-3.5 h-3.5" />}
                  {rev.verdict === 'Rejected' && <XCircle className="w-3.5 h-3.5" />}
                  {rev.verdict === 'Pending' && <Clock className="w-3.5 h-3.5" />}
                  {rev.verdict}
                </span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
};
