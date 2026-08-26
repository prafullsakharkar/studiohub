import React from 'react';
import { SchedulingOverbookingAlert, Resource } from '@/types/scheduling';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Users,
  Cpu,
  Clock,
  ArrowRight,
  ShieldAlert,
  Zap,
} from 'lucide-react';

interface OverbookingAlertDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: SchedulingOverbookingAlert[];
  resources: Resource[];
  onResolve: (alertId: string, resourceId?: string) => Promise<void>;
}

export const OverbookingAlertDrawer: React.FC<OverbookingAlertDrawerProps> = ({
  isOpen,
  onClose,
  alerts,
  resources,
  onResolve,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Overbooking & Conflicts
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                    {alerts.length} Active
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Capacity limits, double-bookings & bottle-necks</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-sm">
            {alerts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200">No Overbooking Conflicts</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  All crew capacity, suites, and equipment allocations are within standard operational limits.
                </p>
              </div>
            ) : (
              alerts.map((alert) => {
                const isPerson = alert.resource_type === 'person';
                const isEq = alert.resource_type === 'equipment';

                return (
                  <div
                    key={alert.id}
                    className="p-4 rounded-xl bg-slate-950/80 border border-red-900/50 shadow-md space-y-3 hover:border-red-700/60 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-lg ${
                            isPerson
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : isEq
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {isPerson ? <Users className="w-4 h-4" /> : <Cpu className="w-4 h-4 text-purple-400" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-100">{alert.resource_name}</h4>
                          <span className="text-[11px] text-slate-400">{alert.department || alert.resource_type}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-red-500/20 text-red-300 border border-red-500/40">
                        +{alert.excess_hours}h Over
                      </span>
                    </div>

                    {/* Metric Bar */}
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Scheduled vs Capacity:</span>
                        <span className="font-mono font-bold text-red-400">
                          {alert.scheduled_hours}h / {alert.max_capacity_hours}h max
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500"
                          style={{
                            width: `${Math.min(100, (alert.scheduled_hours / alert.max_capacity_hours) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Conflicting Events List */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Overlapping Tasks & Bookings ({alert.conflicting_events.length}):
                      </p>
                      <div className="space-y-1">
                        {alert.conflicting_events.map((evt, idx) => (
                          <div
                            key={idx}
                            className="px-2.5 py-1.5 rounded-md bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                          >
                            <span className="text-slate-300 truncate max-w-[200px]">{evt.title}</span>
                            <span className="text-slate-400 font-mono text-[11px] shrink-0 font-medium">
                              {evt.hours}h ({evt.project_code || 'ALL'})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Suggested Resolution */}
                    {alert.suggested_resolution && (
                      <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/40 text-indigo-200 text-xs space-y-1">
                        <span className="font-bold flex items-center gap-1 text-indigo-300">
                          <Zap className="w-3 h-3 text-indigo-400" />
                          Recommended Action:
                        </span>
                        <p className="text-[11px] text-slate-300 leading-relaxed">{alert.suggested_resolution}</p>
                      </div>
                    )}

                    {/* Resolution Action */}
                    <button
                      onClick={() => onResolve(alert.id, alert.resource_id)}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Apply Rebalance & Resolve Conflict
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
