import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  Play,
  Layers,
  Shield,
  FileCode2,
  Terminal,
  Activity,
  CheckSquare,
  Sparkles,
} from 'lucide-react';
import { TestCase, TestResult } from '@/core/testing/types';

interface TestDetailsDrawerProps {
  test: TestCase | null;
  result: TestResult | null;
  isRunning?: boolean;
  onClose: () => void;
  onRunTest: (testId: string) => void;
}

export const TestDetailsDrawer: React.FC<TestDetailsDrawerProps> = ({
  test,
  result,
  isRunning,
  onClose,
  onRunTest,
}) => {
  const [copiedPayload, setCopiedPayload] = useState(false);

  if (!test) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const payloadText = JSON.stringify(
    {
      testId: test.id,
      name: test.name,
      domain: test.domain,
      entity: test.entity,
      level: test.testLevel,
      priority: test.priority,
      status: result?.passed ? 'PASSED' : result ? 'FAILED' : 'PENDING',
      durationMs: result?.durationMs,
      message: result?.message,
      error: result?.error,
      details: result?.details,
      request: result?.request,
      response: result?.response,
    },
    null,
    2
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-start justify-between bg-slate-950/40">
          <div className="space-y-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-sm border border-indigo-500/20">
                {test.id}
              </span>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-sm">
                {test.domain}
              </span>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-sm border border-cyan-500/20 uppercase">
                {test.testLevel}
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-sm uppercase ${
                  test.priority === 'critical'
                    ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                    : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                }`}
              >
                {test.priority}
              </span>
            </div>
            <h2 className="text-base font-bold text-white leading-snug">{test.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              result?.passed
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                : result
                ? 'border-rose-500/30 bg-rose-500/5 text-rose-300'
                : 'border-slate-800 bg-slate-950/40 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-3">
              {result?.passed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : result ? (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              ) : (
                <Clock className="w-5 h-5 text-slate-500 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {result?.passed ? 'Test Passed' : result ? 'Test Failed' : 'Pending Execution'}
                </div>
                <div className="text-xs opacity-90">{result?.message || 'Ready to run.'}</div>
              </div>
            </div>
            {result?.durationMs !== undefined && (
              <span className="font-mono text-xs text-slate-400">{result.durationMs}ms</span>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Description</h3>
            <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              {test.description}
            </p>
          </div>

          {/* Preconditions Checklist */}
          {test.preconditions && test.preconditions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                Preconditions
              </h3>
              <ul className="space-y-1.5 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                {test.preconditions.map((item, idx) => (
                  <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                    <span className="text-indigo-400 font-mono text-[10px] mt-0.5">0{idx + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Execution Steps */}
          {test.steps && test.steps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Execution Steps
              </h3>
              <ol className="space-y-1.5 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                {test.steps.map((step, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-cyan-400 font-mono font-bold text-[10px] mt-0.5">[{idx + 1}]</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Expected Result */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Expected Result</h3>
            <p className="text-xs text-emerald-400/90 leading-relaxed bg-emerald-950/20 p-3 rounded-lg border border-emerald-900/30">
              {test.expectedResult}
            </p>
          </div>

          {/* Diagnostics / Stack Trace */}
          {result?.error && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-rose-400" />
                Error & Stack Trace
              </h3>
              <pre className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-lg text-[11px] font-mono text-rose-300 overflow-x-auto whitespace-pre-wrap">
                {result.error}
              </pre>
            </div>
          )}

          {/* JSON Payload & Telemetry */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                Diagnostic Telemetry Payload
              </h3>
              <button
                onClick={() => copyToClipboard(payloadText)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
              >
                {copiedPayload ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56">
              {payloadText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => onRunTest(test.id)}
            disabled={isRunning}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Executing Test...' : 'Re-run This Test'}
          </button>
        </div>
      </div>
    </div>
  );
};
