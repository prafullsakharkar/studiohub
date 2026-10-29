import React from 'react';
import { Clock, CheckCircle2, XCircle, Trash2, RotateCcw, ShieldCheck, History } from 'lucide-react';
import { TestRunHistoryItem } from '@/core/testing/types';

interface TestRunHistoryViewProps {
  history: TestRunHistoryItem[];
  onClearHistory: () => void;
}

export const TestRunHistoryView: React.FC<TestRunHistoryViewProps> = ({ history, onClearHistory }) => {
  if (history.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
        <History className="w-8 h-8 text-slate-600 mx-auto" />
        <h3 className="text-sm font-bold text-slate-300">No Historical Test Runs Recorded</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Execute test suites from the Test Matrix tab to record historical trends and regression metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-400" />
          Recent Execution Runs ({history.length})
        </h3>
        <button
          onClick={onClearHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-medium text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear History
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 divide-y divide-slate-800/80 overflow-hidden">
        {history.map((run, idx) => (
          <div key={run.id || idx} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  run.failed === 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {run.failed === 0 ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white font-mono">Run #{history.length - idx}</span>
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-sm uppercase">
                    {run.runMode}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(run.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-3 font-mono">
                  <span className="text-emerald-400 font-semibold">{run.passed} passed</span>
                  {run.failed > 0 && <span className="text-rose-400 font-semibold">{run.failed} failed</span>}
                  <span>{run.durationMs}ms total</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-bold font-mono text-white">{run.coveragePct}%</span>
              <span className="block text-[10px] text-slate-500 uppercase">Coverage</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
