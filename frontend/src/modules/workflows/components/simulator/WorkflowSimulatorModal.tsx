import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  ArrowRight,
  Shield,
  Layers,
  Send,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  Workflow,
  WorkflowDryRunResult,
  WorkflowDryRunStep,
} from '@/types/workflow';
import { Button } from '@/shared/components/Button';
import { useSimulateWorkflow } from '../../hooks/useWorkflows';

interface WorkflowSimulatorModalProps {
  workflow: Workflow;
  isOpen: boolean;
  onClose: () => void;
  onStepChange?: (step: WorkflowDryRunStep | null, index: number) => void;
}

export const WorkflowSimulatorModal: React.FC<WorkflowSimulatorModalProps> = ({
  workflow,
  isOpen,
  onClose,
  onStepChange,
}) => {
  const [entityType, setEntityType] = useState<'Shot' | 'Asset' | 'Version'>('Shot');
  const [entityCode, setEntityCode] = useState<string>('SH_010');
  const [triggerEvent, setTriggerEvent] = useState<string>('version.approved');

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [simulationResult, setSimulationResult] = useState<WorkflowDryRunResult | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const simulateMutation = useSimulateWorkflow();

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(-1);
      setSimulationResult(null);
      setIsPlaying(false);
      onStepChange?.(null, -1);
    }
  }, [isOpen]);

  // Handle auto-playing steps
  useEffect(() => {
    let timer: any;
    if (isPlaying && simulationResult) {
      if (currentStepIndex < simulationResult.steps.length - 1) {
        timer = setTimeout(() => {
          const nextIndex = currentStepIndex + 1;
          setCurrentStepIndex(nextIndex);
          onStepChange?.(simulationResult.steps[nextIndex], nextIndex);
        }, 900);
      } else {
        setIsPlaying(false);
      }
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, simulationResult]);

  if (!isOpen) return null;

  const handleStartSimulation = async () => {
    try {
      const res = await simulateMutation.mutateAsync({
        id: workflow.id,
        payload: {
          entity_type: entityType,
          entity_code: entityCode,
          trigger_event: triggerEvent,
        },
      });
      setSimulationResult(res);
      setCurrentStepIndex(0);
      onStepChange?.(res.steps[0], 0);
      setIsPlaying(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStepNext = () => {
    if (!simulationResult) return;
    if (currentStepIndex < simulationResult.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      onStepChange?.(simulationResult.steps[nextIndex], nextIndex);
    }
  };

  const handleStepPrev = () => {
    if (!simulationResult) return;
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      onStepChange?.(simulationResult.steps[prevIndex], prevIndex);
    }
  };

  const handleReset = () => {
    setCurrentStepIndex(-1);
    setSimulationResult(null);
    setIsPlaying(false);
    onStepChange?.(null, -1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Workflow Dry-Run Tracer & Simulator</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {workflow.code}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulate end-to-end DAG execution, condition evaluations, and automation side-effects.
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

        {/* Configuration Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1">TARGET ENTITY TYPE</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
            >
              <option value="Shot">Shot Entity</option>
              <option value="Asset">Asset Entity</option>
              <option value="Version">Version Entity</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1">ENTITY CODE / NAME</label>
            <input
              type="text"
              value={entityCode}
              onChange={(e) => setEntityCode(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
              placeholder="e.g. SH_010, CYBER_BIKE"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1">TRIGGER EVENT</label>
            <select
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
            >
              <option value="version.approved">version.approved (Supervisor Signoff)</option>
              <option value="task.status_changed">task.status_changed (Artist Turnover)</option>
              <option value="qc.passed">qc.passed (Pyblish Verification)</option>
              <option value="task.blocked">task.blocked (Production Escalation)</option>
              <option value="delivery.created">delivery.created (Client Package Ingest)</option>
            </select>
          </div>
        </div>

        {/* Simulator Controls & Timeline Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Action Row */}
          <div className="flex items-center justify-between gap-3">
            {!simulationResult ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleStartSimulation}
                disabled={simulateMutation.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                <Play className="w-4 h-4 fill-white" />
                {simulateMutation.isPending ? 'Simulating DAG...' : 'Start Dry-Run Simulation'}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="gap-1.5"
                >
                  <Play className={`w-3.5 h-3.5 ${isPlaying ? 'text-amber-400' : 'text-emerald-400'}`} />
                  {isPlaying ? 'Pause Auto-Play' : 'Play / Resume'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStepPrev}
                  disabled={currentStepIndex <= 0}
                >
                  Step Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStepNext}
                  disabled={currentStepIndex >= simulationResult.steps.length - 1}
                >
                  Step Next
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            {simulationResult && (
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-slate-400">
                  Step {currentStepIndex + 1} of {simulationResult.steps.length}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Total Duration: {simulationResult.total_duration_ms}ms
                </span>
              </div>
            )}
          </div>

          {/* Timeline Visual Steps */}
          {simulationResult ? (
            <div className="space-y-3">
              <div className="space-y-2">
                {simulationResult.steps.map((step, idx) => {
                  const isCurrent = idx === currentStepIndex;
                  const isPassed = idx < currentStepIndex;

                  return (
                    <div
                      key={step.node_id}
                      className={`p-3.5 rounded-xl border transition-all text-xs flex items-start gap-3.5 ${
                        isCurrent
                          ? 'bg-indigo-950/80 border-indigo-400 ring-2 ring-indigo-400/30 shadow-lg'
                          : isPassed
                          ? 'bg-slate-950/70 border-emerald-500/40 text-slate-300'
                          : 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5 ${
                          isCurrent
                            ? 'bg-indigo-500 text-white animate-pulse'
                            : isPassed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <strong className="text-white font-bold">{step.node_title}</strong>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 uppercase">
                              {step.node_type}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">
                            {step.duration_ms}ms
                          </span>
                        </div>

                        <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
                          {step.log_message}
                        </p>

                        {/* Emitted actions */}
                        {step.emitted_actions && step.emitted_actions.length > 0 && (
                          <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                            {step.emitted_actions.map((act, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono flex items-center gap-1"
                              >
                                <Zap className="w-2.5 h-2.5 text-emerald-400" /> {act}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Side Effects Summary */}
              {simulationResult.side_effects && simulationResult.side_effects.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Automated Side Effects Dispatched ({simulationResult.side_effects.length})
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-400 list-disc list-inside">
                    {simulationResult.side_effects.map((side, i) => (
                      <li key={i} className="text-slate-300 font-mono text-[11px]">
                        {side}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-indigo-400">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Ready for Simulation</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Select your test entity parameters above and click &quot;Start Dry-Run Simulation&quot; to test DAG node traversals, condition branches, and automation events safely.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Simulations emit verifiable audit trail logs without altering live production databases.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
