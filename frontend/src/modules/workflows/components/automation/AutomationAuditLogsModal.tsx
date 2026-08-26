import React from 'react';
import {
  X,
  History,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Zap,
  Layers,
} from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { useAutomationAuditLogs } from '../../hooks/useWorkflows';

interface AutomationAuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutomationAuditLogsModal: React.FC<AutomationAuditLogsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { data: logs, isLoading } = useAutomationAuditLogs();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Automation Audit Trail & Execution Logs</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Permission-verified history of all triggered workflows and cascading operations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logs Table / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs">
              Loading audit records...
            </div>
          ) : logs && logs.length > 0 ? (
            logs.map((log) => {
              const isSuccess = log.status === 'success';

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${
                          isSuccess
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {log.status}
                      </span>
                      <strong className="text-white font-mono">{log.rule_name}</strong>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-indigo-400" /> {log.actor_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(log.executed_at).toLocaleString()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {log.duration_ms}ms
                      </span>
                    </div>
                  </div>

                  {/* Trigger & Entity context */}
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Trigger: <strong className="text-amber-300">{log.trigger_event}</strong> on{' '}
                      <span className="text-indigo-300">
                        {log.entity_type} {log.entity_code}
                      </span>
                    </span>
                  </div>

                  {/* Step Execution Logs */}
                  {(() => {
                    const steps = log.step_logs || log.action_logs || [];
                    return (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                          Execution Trace ({steps.length} actions)
                        </span>
                        <div className="space-y-1">
                          {steps.map((actLog, aIdx) => (
                            <div
                              key={actLog.step || aIdx}
                              className="px-2.5 py-1 rounded bg-slate-900/40 border border-slate-800/60 font-mono text-[11px] flex items-center justify-between text-slate-300"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">[{actLog.action_type}]</span>
                                <span>{actLog.message || actLog.step}</span>
                              </div>
                              <span className="text-[10px] text-slate-500">{actLog.duration_ms}ms</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 font-mono text-xs">
              No audit logs recorded yet.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
