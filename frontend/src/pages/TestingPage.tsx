import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Flame,
  Terminal,
  Shield,
  Layers,
  Search,
  Activity,
  ArrowRight,
  Database,
  WifiOff,
  Lock,
} from 'lucide-react';
import { TestRunnerEngine, TestGroup, TestResult } from '@/core/testing/TestRunnerEngine';
import { apiClient } from '@/api/client/ApiClient';
import { ApiError } from '@/api/errors/ApiError';
import { FormFieldError } from '@/shared/components/FormFieldError';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export const TestingPage: React.FC = () => {
  const [testGroups] = useState<TestGroup[]>(() => TestRunnerEngine.getTestGroups());
  const [runningTests, setRunningTests] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<{ id: string; name: string; result: TestResult } | null>(null);

  // Error simulation state
  const [simulatingStatus, setSimulatingStatus] = useState<number | null>(null);
  const [simulatedError, setSimulatedError] = useState<ApiError | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);

  // Sample form validation state
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');

  const runTest = async (testId: string, group: TestGroup) => {
    const test = group.tests.find((t) => t.id === testId);
    if (!test) return;

    setRunningTests((prev) => ({ ...prev, [testId]: true }));
    try {
      const res = await test.run();
      setResults((prev) => ({ ...prev, [testId]: res }));
      if (res.passed) {
        addNotification({
          type: 'success',
          title: 'Test Passed',
          message: `${test.name} completed in ${res.durationMs}ms`,
        });
      }
    } catch (err: any) {
      const res: TestResult = {
        passed: false,
        durationMs: 0,
        message: err.message || 'Test execution failed',
        error: err.stack || String(err),
      };
      setResults((prev) => ({ ...prev, [testId]: res }));
      addNotification({
        type: 'error',
        title: 'Test Failed',
        message: `${test.name}: ${err.message}`,
      });
    } finally {
      setRunningTests((prev) => ({ ...prev, [testId]: false }));
    }
  };

  const runGroup = async (group: TestGroup) => {
    for (const test of group.tests) {
      await runTest(test.id, group);
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    for (const group of testGroups) {
      for (const test of group.tests) {
        await runTest(test.id, group);
      }
    }
    setIsRunningAll(false);
  };

  const triggerErrorSimulation = (statusCode: number, customMessage?: string) => {
    setSimulatingStatus(statusCode);
    const mockValidationPayload =
      statusCode === 400
        ? {
            name: ['This field may not be blank.', 'Project name must be unique within the studio.'],
            code: ['Invalid project prefix (must be uppercase alphanumeric 3-5 chars).'],
            budget_usd: ['A valid integer is required.'],
          }
        : null;

    const error = ApiError.fromDrfResponse(statusCode, mockValidationPayload || customMessage || `Simulated HTTP ${statusCode} response`);
    setSimulatedError(error);

    let toastType: 'error' | 'warning' | 'info' = 'error';
    if (statusCode === 429) toastType = 'warning';

    addNotification({
      type: toastType,
      title: `HTTP ${statusCode} Trapped`,
      message: error.message,
    });
  };

  const submitTestForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Simulate real DRF validation error if blank
    if (!formName || !formCode) {
      const err = ApiError.fromDrfResponse(400, {
        name: !formName ? ['Project name is required by Django serializer.'] : undefined,
        code: !formCode ? ['Entity code is required.'] : undefined,
        non_field_errors: ['Please correct highlighted invalid parameters.'],
      });
      setFormError(err);
      return;
    }

    addNotification({
      type: 'success',
      title: 'Validation Passed',
      message: `Form payload for ${formName} [${formCode}] passed all server rules.`,
    });
  };

  const totalTests = testGroups.reduce((acc, g) => acc + g.tests.length, 0);
  const executedTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter((r) => r.passed).length;
  const failedTests = Object.values(results).filter((r) => !r.passed).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">API Integration & Test Runner</h1>
              <p className="text-sm text-slate-400">
                Automated DRF contract validation, MSW handlers, TanStack queries, and error simulation lab
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="run-all-tests-btn"
            onClick={runAllTests}
            disabled={isRunningAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            {isRunningAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            {isRunningAll ? 'Running Test Suites...' : 'Run All Test Suites'}
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Tests</span>
            <p className="text-2xl font-bold text-white mt-1">{totalTests}</p>
          </div>
          <Layers className="w-6 h-6 text-slate-500" />
        </div>

        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Passed</span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{passedTests}</p>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>

        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-rose-400 uppercase tracking-wider">Failed</span>
            <p className="text-2xl font-bold text-rose-400 mt-1">{failedTests}</p>
          </div>
          <XCircle className="w-6 h-6 text-rose-400" />
        </div>

        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">Coverage</span>
            <p className="text-2xl font-bold text-indigo-400 mt-1">
              {totalTests > 0 ? Math.round((executedTests / totalTests) * 100) : 0}%
            </p>
          </div>
          <Activity className="w-6 h-6 text-indigo-400" />
        </div>
      </div>

      {/* Main Grid: Test Suites + Error Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Test Groups */}
        <div className="lg:col-span-2 space-y-6">
          {testGroups.map((group) => (
            <div key={group.id} className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white text-base">{group.title}</h2>
                  <p className="text-xs text-slate-400">{group.description}</p>
                </div>
                <button
                  onClick={() => runGroup(group)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-slate-300" /> Run Suite
                </button>
              </div>

              <div className="divide-y divide-slate-800/60">
                {group.tests.map((test) => {
                  const isRunning = runningTests[test.id];
                  const res = results[test.id];

                  return (
                    <div
                      key={test.id}
                      className="p-4 hover:bg-slate-900/40 transition flex items-start justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          {isRunning ? (
                            <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                          ) : res?.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : res ? (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                          )}
                          <span className="font-medium text-sm text-slate-200">{test.name}</span>
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-400">
                            {test.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 ml-6.5">{test.description}</p>

                        {res && (
                          <div className="mt-2 ml-6.5 flex items-center gap-3 text-xs">
                            <span className={res.passed ? 'text-emerald-400' : 'text-rose-400'}>{res.message}</span>
                            <span className="text-slate-500 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {res.durationMs}ms
                            </span>
                            {res.details && (
                              <button
                                onClick={() => setSelectedDetails({ id: test.id, name: test.name, result: res })}
                                className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                              >
                                View Payload
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => runTest(test.id, group)}
                        disabled={isRunning}
                        className="shrink-0 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition border border-slate-700 cursor-pointer"
                        title="Run single test"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Error Simulator & Field Validation Demo */}
        <div className="space-y-6">
          {/* Error Simulation Lab */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              <h2 className="font-semibold text-white text-sm">HTTP Status Code Simulator</h2>
            </div>
            <p className="text-xs text-slate-400">
              Trigger simulated Django REST responses to inspect error handlers, banners, and toast notifications.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[
                { status: 400, label: '400 Bad Req' },
                { status: 401, label: '401 Auth Exp' },
                { status: 403, label: '403 Forbidden' },
                { status: 404, label: '404 Not Found' },
                { status: 409, label: '409 Conflict' },
                { status: 422, label: '422 Unproc' },
                { status: 429, label: '429 Throttle' },
                { status: 500, label: '500 Server' },
                { status: 502, label: '502 Gateway' },
                { status: 503, label: '503 Maint' },
                { status: 0, label: 'Offline / Net' },
              ].map(({ status, label }) => (
                <button
                  key={status}
                  onClick={() => triggerErrorSimulation(status)}
                  className={`px-2.5 py-2 text-xs font-mono rounded-lg border transition cursor-pointer text-center ${
                    simulatingStatus === status
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {simulatedError && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <FormFieldError error={simulatedError} />
              </div>
            )}
          </div>

          {/* Form Field-Level Server Validation Demo */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-white text-sm">Server Validation Form Test</h2>
            </div>
            <p className="text-xs text-slate-400">
              Submit with missing values to test automatic DRF field-level error mapping and inline rendering.
            </p>

            <form onSubmit={submitTestForm} className="space-y-3">
              <FormFieldError error={formError} />

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Cyber Runner 2077"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <FormFieldError error={formError} field="name" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Project Code</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="e.g. CR77"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 uppercase font-mono"
                />
                <FormFieldError error={formError} field="code" />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Submit Payload
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormName('Avatar Fire & Ash');
                    setFormCode('AFA');
                    setFormError(null);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition cursor-pointer"
                >
                  Fill Valid
                </button>
              </div>
            </form>
          </div>

          {/* Test Log Modal / Drawer */}
          {selectedDetails && (
            <div className="p-5 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">{selectedDetails.name}</h3>
                <button
                  onClick={() => setSelectedDetails(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-indigo-300 overflow-x-auto max-h-48 border border-slate-800">
                {JSON.stringify(selectedDetails.result.details || selectedDetails.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
