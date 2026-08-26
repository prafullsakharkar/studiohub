import React, { useState } from 'react';
import { AIRiskItem } from '@/types/intelligence';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface AIRiskRadarProps {
  risks: AIRiskItem[];
  onResolveRisk: (riskId: string) => Promise<any>;
}

export const AIRiskRadar: React.FC<AIRiskRadarProps> = ({ risks, onResolveRisk }) => {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await onResolveRisk(id);
    } catch (err) {
      console.error(err);
    } finally {
      setResolvingId(null);
    }
  };

  const getSeverityBadge = (sev: AIRiskItem['severity']) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
            <AlertOctagon className="w-3 h-3" /> Critical Slip
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> High Risk
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            Medium
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-slate-800 text-slate-400">
            Low
          </span>
        );
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            AI Anomaly & Production Risk Scanner
          </h3>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-900/60 font-semibold">
          {risks.length} Detected
        </span>
      </div>

      {risks.length > 0 ? (
        <div className="space-y-2.5">
          {risks.map((risk) => (
            <div
              key={risk.id}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 space-y-2 text-xs transition-colors"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {getSeverityBadge(risk.severity)}
                  <span className="font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px] border border-emerald-800/40">
                    {risk.project_code}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Impact: <strong className="text-slate-300">{risk.impacted_entity_name}</strong>
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 font-mono">
                  Confidence: {Math.round(risk.confidence_score * 100)}%
                </div>
              </div>

              <h4 className="font-semibold text-slate-100">{risk.title}</h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">{risk.description}</p>

              {/* Suggested Action Box */}
              <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-900/40 text-indigo-200 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2 flex-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-snug">{risk.suggested_action}</span>
                </div>

                {risk.auto_mitigation_available && (
                  <button
                    id={`btn-mitigate-${risk.id}`}
                    disabled={resolvingId === risk.id}
                    onClick={() => handleResolve(risk.id)}
                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{resolvingId === risk.id ? 'Applying...' : 'Auto-Mitigate'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          <span className="text-slate-300 font-medium">All systems green</span>
          <span className="text-[11px]">No critical timeline slips or capacity anomalies detected.</span>
        </div>
      )}
    </div>
  );
};
