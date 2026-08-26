import React, { useState } from 'react';
import { AITaskRecommendation } from '@/types/intelligence';
import {
  UserCheck,
  Zap,
  Clock,
  Check,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

interface AITaskRecommenderProps {
  recommendations: AITaskRecommendation[];
  onApplyRecommendation: (rec: AITaskRecommendation) => Promise<any>;
}

export const AITaskRecommender: React.FC<AITaskRecommenderProps> = ({
  recommendations,
  onApplyRecommendation,
}) => {
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApply = async (rec: AITaskRecommendation) => {
    setApplyingId(rec.task_id);
    try {
      await onApplyRecommendation(rec);
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Smart Task & Workload Rebalancer
          </h3>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-900/60">
          {recommendations.length} Suggestions
        </span>
      </div>

      {recommendations.length > 0 ? (
        <div className="space-y-2.5">
          {recommendations.map((rec) => (
            <div
              key={rec.task_id}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 space-y-2 text-xs transition-colors"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px] border border-emerald-800/40">
                    {rec.project_code}
                  </span>
                  <span className="font-semibold text-slate-100">{rec.task_title}</span>
                </div>
                <div className="text-[10px] text-teal-400 font-mono flex items-center gap-1 bg-teal-950/40 px-2 py-0.5 rounded border border-teal-900/40">
                  <TrendingUp className="w-3 h-3" /> Fit Score: {Math.round(rec.fit_score * 100)}%
                </div>
              </div>

              {/* Reassignment Map */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px]">
                <div className="space-y-0.5">
                  <div className="text-slate-400 text-[10px]">Current:</div>
                  <div className="text-slate-300 font-medium">
                    {rec.current_assignee_name || 'Unassigned'}
                  </div>
                </div>

                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />

                <div className="space-y-0.5 text-right">
                  <div className="text-slate-400 text-[10px]">Recommended:</div>
                  <div className="text-indigo-300 font-semibold">{rec.recommended_assignee_name}</div>
                </div>
              </div>

              <p className="text-slate-400 text-[11px] leading-relaxed">{rec.reason}</p>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <div className="text-[10px] text-slate-400 font-mono">
                  Speedup: <strong className="text-emerald-400">+{rec.estimated_speedup_days} Days</strong>
                </div>
                <button
                  id={`btn-apply-rec-${rec.task_id}`}
                  disabled={applyingId === rec.task_id}
                  onClick={() => handleApply(rec)}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>{applyingId === rec.task_id ? 'Assigning...' : 'Accept Reassignment'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-slate-400">
          Workload is currently well-balanced across all departments.
        </div>
      )}
    </div>
  );
};
