import React, { useState, useMemo, useRef } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
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
  UserX,
  KeyRound,
  Sparkles,
  Filter,
  Check,
  Copy,
  X,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Film,
  Users,
  Settings,
  ShieldCheck,
  Palette,
  Server,
  Download,
  Square,
  CheckSquare,
  BarChart3,
  History as HistoryIcon,
  StopCircle,
} from 'lucide-react';
import {
  TestRunnerEngine,
  TestGroup,
  TestCase,
  TestResult,
  TestLevel,
  DomainType,
  TestPriority,
  TestRunHistoryItem,
} from '@/core/testing/TestRunnerEngine';
import { TestRegistryManager } from '@/core/testing/testRegistry';
import { TestCoverageDashboard } from './testing/TestCoverageDashboard';
import { TestDetailsDrawer } from './testing/TestDetailsDrawer';
import { TestRunHistoryView } from './testing/TestRunHistoryView';
import { apiClient } from '@/api/client/ApiClient';
import { ApiError } from '@/api/errors/ApiError';
import { FormFieldError } from '@/shared/components/FormFieldError';
import { Button } from '@/shared/components/Button';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { hasElevatedAccess } from '@/core/permissions/rbac';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { notify } from '@/core/notifications/notify';
import { centralErrorHandler } from '@/core/api/error-handler';
import { ApiErrorState } from '@/components/system/ApiErrorState';
import { ValidationSummary } from '@/components/system/ValidationSummary';

type ActiveViewTab = 'matrix' | 'coverage' | 'error-lab' | 'history';
type SuiteCategory = 'all' | 'production' | 'api' | 'rbac' | 'platform' | 'ui' | 'error';
type StatusFilter = 'all' | 'passed' | 'failed' | 'pending';

function getSuiteCategory(groupId: string): SuiteCategory {
  if (groupId === 'prod-permissions-ui-suite') return 'rbac';
  if (groupId.startsWith('prod-') || groupId === 'critical-e2e') {
    return 'production';
  }
  if (groupId === 'crud' || groupId === 'relationships' || groupId === 'search-filter-sort' || groupId === 'api-parity') {
    return 'api';
  }
  if (
    groupId.includes('rbac') ||
    groupId.includes('authz') ||
    groupId.includes('permissions') ||
    groupId.includes('project-workspace-isolation')
  ) {
    return 'rbac';
  }
  if (groupId.startsWith('platform-')) {
    return 'platform';
  }
  if (groupId.includes('components') || groupId.includes('canonical')) {
    return 'ui';
  }
  if (groupId.includes('error')) {
    return 'error';
  }
  return 'production';
}

const CATEGORY_DEFINITIONS: { id: SuiteCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All Suites', icon: Layers },
  { id: 'production', label: 'Production Workflows', icon: Film },
  { id: 'api', label: 'Core API & CRUD', icon: Database },
  { id: 'rbac', label: 'RBAC & Security', icon: ShieldCheck },
  { id: 'platform', label: 'Platform & Facilities', icon: Server },
  { id: 'ui', label: 'UI & Design System', icon: Palette },
  { id: 'error', label: 'Error Simulation Lab', icon: Flame },
];

export const TestingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const isAdmin = hasElevatedAccess(user);

  const [testGroups] = useState<TestGroup[]>(() => TestRunnerEngine.getTestGroups());
  const [activeTab, setActiveTab] = useState<ActiveViewTab>('matrix');

  // Execution state
  const [runningTests, setRunningTests] = useState<Record<string, boolean>>({});
  const [runningGroups, setRunningGroups] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const cancelExecutionRef = useRef(false);

  // Selection & Details
  const [selectedTestIds, setSelectedTestIds] = useState<Record<string, boolean>>({});
  const [inspectedTest, setInspectedTest] = useState<TestCase | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<SuiteCategory>('all');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // History state
  const [runHistory, setRunHistory] = useState<TestRunHistoryItem[]>(() => TestRunnerEngine.getRunHistory());

  // Error simulation state
  const [activeScenario, setActiveScenario] = useState<string>('none');
  const [simulatingStatus, setSimulatingStatus] = useState<number | null>(null);
  const [simulatedError, setSimulatedError] = useState<ApiError | null>(null);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');

  // Flattened all tests
  const allTests = useMemo(() => testGroups.flatMap((g) => g.tests), [testGroups]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = allTests.length;
    let passed = 0;
    let failed = 0;
    let pending = 0;

    allTests.forEach((t) => {
      const res = results[t.id];
      if (res?.passed === true) passed++;
      else if (res && !res.passed) failed++;
      else pending++;
    });

    const coveragePct = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { total, passed, failed, pending, coveragePct };
  }, [allTests, results]);

  // Coverage report
  const coverageReport = useMemo(() => {
    return TestRegistryManager.calculateCoverage(allTests, results);
  }, [allTests, results]);

  // Filtered Test Groups
  const filteredGroups = useMemo(() => {
    return testGroups
      .map((group) => {
        const groupCategory = getSuiteCategory(group.id);
        const matchesCategory = selectedCategory === 'all' || groupCategory === selectedCategory;
        if (!matchesCategory) return null;

        const filteredTests = group.tests.filter((test) => {
          // Domain
          if (selectedDomain !== 'all' && test.domain !== selectedDomain) return false;
          // Level
          if (selectedLevel !== 'all' && test.testLevel !== selectedLevel) return false;
          // Priority
          if (selectedPriority !== 'all' && test.priority !== selectedPriority) return false;

          // Status filter
          const res = results[test.id];
          if (statusFilter === 'passed' && !res?.passed) return false;
          if (statusFilter === 'failed' && (!res || res.passed)) return false;
          if (statusFilter === 'pending' && res) return false;

          // Search query
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchesId = test.id.toLowerCase().includes(q);
            const matchesName = test.name.toLowerCase().includes(q);
            const matchesDesc = test.description.toLowerCase().includes(q);
            const matchesEntity = test.entity?.toLowerCase().includes(q);
            const matchesTags = test.tags?.some((t) => t.toLowerCase().includes(q));
            if (!matchesId && !matchesName && !matchesDesc && !matchesEntity && !matchesTags) return false;
          }

          return true;
        });

        if (filteredTests.length === 0) return null;

        return {
          ...group,
          tests: filteredTests,
        };
      })
      .filter(Boolean) as TestGroup[];
  }, [testGroups, selectedCategory, selectedDomain, selectedLevel, selectedPriority, statusFilter, searchQuery, results]);

  const handleScenarioChange = (scenario: string) => {
    setActiveScenario(scenario);
    if (scenario === 'none') {
      notify.info('Mock error scenario cleared. API restored to normal.');
    } else {
      notify.warning(`Active mock error scenario: ${scenario}`);
    }
  };

  const runTest = async (testId: string, group: TestGroup, isBatch: boolean = false) => {
    const test = group.tests.find((t) => t.id === testId);
    if (!test) return;

    setRunningTests((prev) => ({ ...prev, [testId]: true }));
    try {
      const res = await test.run();
      setResults((prev) => ({ ...prev, [testId]: res }));
      if (res.passed && !isBatch) {
        notify.success(`${test.name} (${res.durationMs}ms)`, {
          title: 'Test Passed',
          dedupKey: `test-pass-${test.id}`,
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
      if (!isBatch) {
        notify.error(`${test.name}: ${err.message}`, {
          title: 'Test Failed',
          dedupKey: `test-fail-${test.id}`,
        });
      }
    } finally {
      setRunningTests((prev) => ({ ...prev, [testId]: false }));
    }
  };

  const runGroup = async (group: TestGroup) => {
    setRunningGroups((prev) => ({ ...prev, [group.id]: true }));
    try {
      const tests = group.tests;
      for (let i = 0; i < tests.length; i += 8) {
        if (cancelExecutionRef.current) break;
        const chunk = tests.slice(i, i + 8);
        await Promise.all(chunk.map((test) => runTest(test.id, group, true)));
      }
      notify.success(`Completed test suite: ${group.title}`, {
        dedupKey: `group-complete-${group.id}`,
      });
    } finally {
      setRunningGroups((prev) => ({ ...prev, [group.id]: false }));
    }
  };

  const runFilteredSuites = async (runMode: 'all' | 'selected' | 'failed' = 'all') => {
    setIsRunningAll(true);
    cancelExecutionRef.current = false;
    const startTime = performance.now();

    try {
      let targetTests: { test: TestCase; group: TestGroup }[] = [];

      testGroups.forEach((group) => {
        group.tests.forEach((test) => {
          if (runMode === 'selected') {
            if (selectedTestIds[test.id]) targetTests.push({ test, group });
          } else if (runMode === 'failed') {
            const res = results[test.id];
            if (res && !res.passed) targetTests.push({ test, group });
          } else {
            targetTests.push({ test, group });
          }
        });
      });

      // Execute in concurrent chunks of 8
      for (let i = 0; i < targetTests.length; i += 8) {
        if (cancelExecutionRef.current) {
          notify.warning('Test execution stopped by user.');
          break;
        }
        const chunk = targetTests.slice(i, i + 8);
        await Promise.all(chunk.map(({ test, group }) => runTest(test.id, group, true)));
      }

      const totalDuration = Math.round(performance.now() - startTime);

      // Record to history
      const historyItem: TestRunHistoryItem = {
        id: `run-${Date.now()}`,
        timestamp: new Date().toISOString(),
        total: targetTests.length,
        passed: stats.passed,
        failed: stats.failed,
        skipped: stats.pending,
        durationMs: totalDuration,
        runMode,
        coveragePct: stats.coveragePct,
      };
      TestRunnerEngine.saveRunHistory(historyItem);
      setRunHistory(TestRunnerEngine.getRunHistory());

      if (!cancelExecutionRef.current) {
        notify.success(`Automated suite executed in ${totalDuration}ms`, {
          title: 'Full Test Run Complete',
        });
      }
    } finally {
      setIsRunningAll(false);
    }
  };

  const stopExecution = () => {
    cancelExecutionRef.current = true;
    setIsRunningAll(false);
  };

  const resetAllResults = () => {
    setResults({});
    setSelectedTestIds({});
    notify.info('Test results reset.');
  };

  const toggleSelectTest = (testId: string) => {
    setSelectedTestIds((prev) => ({
      ...prev,
      [testId]: !prev[testId],
    }));
  };

  const toggleSelectAllVisible = () => {
    const visibleTestIds = filteredGroups.flatMap((g) => g.tests.map((t) => t.id));
    const allSelected = visibleTestIds.every((id) => selectedTestIds[id]);

    const next: Record<string, boolean> = { ...selectedTestIds };
    visibleTestIds.forEach((id) => {
      next[id] = !allSelected;
    });
    setSelectedTestIds(next);
  };

  const exportReport = (format: 'json' | 'csv') => {
    const data =
      format === 'json'
        ? TestRegistryManager.exportReportAsJson(allTests, results)
        : TestRegistryManager.exportReportAsCsv(allTests, results);

    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studiohub-test-report-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success(`Exported test report as ${format.toUpperCase()}`);
  };

  const selectedCount = Object.values(selectedTestIds).filter(Boolean).length;

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[600px] p-8 text-center bg-slate-950 text-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-lg">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Denied: Administrator Only</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          The API &amp; Test Suite is strictly restricted to Platform and Organization Administrators. Your current role does not have privileges to execute automated test suites or view system diagnostics.
        </p>
        <Button variant="primary" onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* 1. Header & Navigation Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">API & Test Suite Runner</h1>
                <span className="inline-flex items-center font-medium rounded-md whitespace-nowrap px-2.5 py-0.5 text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {stats.total} Tests Available
                </span>
                <span className="inline-flex items-center font-medium rounded-md whitespace-nowrap px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Unit 65% / Int 30% / E2E 5%
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Centralized production test runner, RBAC matrix validator, multi-tenant isolation, and gap analysis engine.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Bar Actions & View Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/platform/health')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            title="View live API and services health telemetry"
          >
            <Activity className="w-4 h-4" />
            <span>View Live Services</span>
          </button>
          {/* Failed Tests Only Filter Button */}
          <button
            id="failed-tests-only-nav-btn"
            onClick={() => {
              if (statusFilter === 'failed') {
                setStatusFilter('all');
              } else {
                setStatusFilter('failed');
                setActiveTab('matrix');
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              statusFilter === 'failed'
                ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-md shadow-rose-950/40 ring-1 ring-rose-500/40'
                : stats.failed > 0
                ? 'bg-slate-900 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title={statusFilter === 'failed' ? 'Click to show all tests' : 'Filter report view to failed tests only'}
          >
            <XCircle
              className={`w-4 h-4 ${
                statusFilter === 'failed'
                  ? 'text-rose-400 animate-pulse'
                  : stats.failed > 0
                  ? 'text-rose-400'
                  : 'text-slate-500'
              }`}
            />
            <span>Failed Tests Only</span>
            <span
              className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-bold ${
                statusFilter === 'failed'
                  ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                  : stats.failed > 0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {stats.failed}
            </span>
            {statusFilter === 'failed' && (
              <span className="text-[10px] uppercase font-mono tracking-wider bg-rose-600/40 text-rose-200 px-1.5 py-0.5 rounded-sm ml-0.5">
                ACTIVE
              </span>
            )}
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Test Matrix
            </button>
            <button
              onClick={() => setActiveTab('coverage')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'coverage'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Coverage & Gaps
            </button>
            <button
              onClick={() => setActiveTab('error-lab')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'error-lab'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Error Lab
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <HistoryIcon className="w-3.5 h-3.5" />
              History ({runHistory.length})
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Test Cases</span>
          <span id="stat-total-tests" className="text-2xl font-bold font-mono text-white mt-1 block">
            {stats.total}
          </span>
          <span className="text-[10px] text-slate-500">100% Discoverable</span>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Passed</span>
          <span id="stat-passed-tests" className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
            {stats.passed}
          </span>
          <span className="text-[10px] text-emerald-500/80">Active Green</span>
        </div>

        <div
          onClick={() => {
            if (statusFilter === 'failed') {
              setStatusFilter('all');
            } else {
              setStatusFilter('failed');
              setActiveTab('matrix');
            }
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'failed'
              ? 'border-rose-500 bg-rose-500/20 shadow-md shadow-rose-950/30 ring-1 ring-rose-500/40'
              : 'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40'
          }`}
          title="Click to toggle Failed Tests Only filter"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">Failed</span>
            {statusFilter === 'failed' && (
              <span className="text-[9px] font-mono uppercase bg-rose-500/30 text-rose-200 px-1.5 py-0.2 rounded-xs font-bold">
                Filtered
              </span>
            )}
          </div>
          <span id="stat-failed-tests" className="text-2xl font-bold font-mono text-rose-400 mt-1 block">
            {stats.failed}
          </span>
          <span className="text-[10px] text-rose-500/80">
            {statusFilter === 'failed' ? 'Showing failed tests only' : 'Click to isolate failures'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Pending</span>
          <span className="text-2xl font-bold font-mono text-slate-300 mt-1 block">
            {stats.pending}
          </span>
          <span className="text-[10px] text-slate-500">Awaiting Run</span>
        </div>

        <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
          <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block">Coverage Rate</span>
          <span id="stat-coverage" className="text-2xl font-bold font-mono text-indigo-400 mt-1 block">
            {stats.coveragePct}%
          </span>
          <span className="text-[10px] text-indigo-400/80">Verified Pass Rate</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Gaps Detected</span>
          <span className="text-2xl font-bold font-mono text-slate-200 mt-1 block">
            {coverageReport.gaps.length}
          </span>
          <span className="text-[10px] text-emerald-400">Zero Unmapped Areas</span>
        </div>
      </div>

      {/* 3. Tab Views */}
      {activeTab === 'coverage' && (
        <TestCoverageDashboard coverage={coverageReport} />
      )}

      {activeTab === 'history' && (
        <TestRunHistoryView
          history={runHistory}
          onClearHistory={() => {
            TestRunnerEngine.clearRunHistory();
            setRunHistory([]);
            notify.info('Test execution history cleared.');
          }}
        />
      )}

      {activeTab === 'error-lab' && (
        <div className="space-y-6">
          {/* Error Scenario Selector */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Simulated Network & API Error Conditions
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inject deterministic server error responses across all DRF mock router endpoints to test frontend resilience.
                </p>
              </div>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                Active: {activeScenario}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {(
                [
                  { id: 'none', label: 'Normal (None)' },
                  { id: 'network_error', label: 'Network Error' },
                  { id: '401_unauthorized', label: '401 Unauthorized' },
                  { id: '403_forbidden', label: '403 Forbidden' },
                  { id: '404_not_found', label: '404 Not Found' },
                  { id: '409_conflict', label: '409 Conflict' },
                  { id: '422_validation_error', label: '422 Validation' },
                  { id: '429_rate_limit', label: '429 Rate Limit' },
                  { id: '500_server_error', label: '500 Server Error' },
                  { id: '503_service_unavailable', label: '503 Unavailable' },
                ] as const
              ).map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => handleScenarioChange(sc.id)}
                  className={`p-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                    activeScenario === sc.id
                      ? 'border-indigo-500 bg-indigo-600/20 text-white font-bold'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Form Validation Error Simulator */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Live Form Validation & API Error Handler Sandbox
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Simulate Form Submission</h4>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Project Name (Required, min 3 chars)</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Neon Horizon"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <FormFieldError error={formError} field="name" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Project Code (Required, 3-6 uppercase chars)</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. NHZ"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <FormFieldError error={formError} field="code" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (!formName || formName.length < 3) {
                        const err = new ApiError('Validation failed', 422, {
                          name: ['Project name must be at least 3 characters long.'],
                        });
                        setFormError(err);
                        centralErrorHandler.handleError(err, { source: 'ErrorSimulator' });
                        return;
                      }
                      if (!formCode || !/^[A-Z0-9]{3,6}$/.test(formCode)) {
                        const err = new ApiError('Validation failed', 422, {
                          code: ['Code must be 3-6 uppercase alphanumeric characters.'],
                        });
                        setFormError(err);
                        centralErrorHandler.handleError(err, { source: 'ErrorSimulator' });
                        return;
                      }
                      setFormError(null);
                      notify.success('Form validation passed successfully!');
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                  >
                    Validate & Submit
                  </button>
                  <button
                    onClick={() => {
                      setFormError(null);
                      setFormName('');
                      setFormCode('');
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Clear Form
                  </button>
                </div>
              </div>

              <div className="space-y-3 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Error State Preview</h4>
                {formError ? (
                  <ValidationSummary error={formError} />
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No active validation errors. Trigger form validation to inspect error boundaries.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="space-y-5">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="run-all-tests-btn"
                onClick={() => runFilteredSuites('all')}
                disabled={isRunningAll}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 ${isRunningAll ? 'animate-spin' : ''}`} />
                {isRunningAll ? 'Running Test Suites...' : `Run All Tests (${stats.total})`}
              </button>

              {selectedCount > 0 && (
                <button
                  onClick={() => runFilteredSuites('selected')}
                  disabled={isRunningAll}
                  className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-2 transition-all"
                >
                  <Play className="w-3.5 h-3.5" />
                  Run Selected ({selectedCount})
                </button>
              )}

              {stats.failed > 0 && (
                <button
                  onClick={() => runFilteredSuites('failed')}
                  disabled={isRunningAll}
                  className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-2 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Failed ({stats.failed})
                </button>
              )}

              {isRunningAll && (
                <button
                  onClick={stopExecution}
                  className="px-3.5 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-xs font-bold text-white flex items-center gap-1.5 transition-all"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  Stop Execution
                </button>
              )}

              <button
                id="reset-tests-btn"
                onClick={resetAllResults}
                disabled={isRunningAll}
                className="px-3 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Results
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAllVisible}
                className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                {filteredGroups.flatMap((g) => g.tests).every((t) => selectedTestIds[t.id]) ? (
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                Select All Visible
              </button>

              {/* Export Dropdown */}
              <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 divide-x divide-slate-800">
                <button
                  onClick={() => exportReport('json')}
                  className="px-2.5 py-1.5 text-xs font-mono text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1"
                  title="Export JSON Report"
                >
                  <Download className="w-3 h-3" />
                  JSON
                </button>
                <button
                  onClick={() => exportReport('csv')}
                  className="px-2.5 py-1.5 text-xs font-mono text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1"
                  title="Export CSV Report"
                >
                  CSV
                </button>
              </div>
            </div>
          </div>

          {/* Category Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {CATEGORY_DEFINITIONS.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Multi-Dimension Search & Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search test ID, name, entity, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Domain Filter */}
            <div>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="all">All Domains</option>
                <option value="Platform">Platform Domain</option>
                <option value="Organization">Organization Domain</option>
                <option value="Production">Production Domain</option>
                <option value="Cross-Cutting">Cross-Cutting</option>
              </select>
            </div>

            {/* Test Level Filter */}
            <div>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="all">All Levels (Unit/Int/E2E)</option>
                <option value="unit">Unit Tests</option>
                <option value="integration">Integration Tests</option>
                <option value="e2e">E2E Critical Flows</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                id="status-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="passed">Passed Tests</option>
                <option value="failed">Failed Tests Only ({stats.failed})</option>
                <option value="pending">Pending Tests</option>
              </select>
            </div>
          </div>

          {/* Active Failed Tests Only Troubleshooting Banner */}
          {statusFilter === 'failed' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 backdrop-blur-xs text-xs text-rose-200">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold text-white">Troubleshooting Mode: Showing Failed Tests Only</span>
                  <span className="text-rose-300/80 ml-2">
                    ({stats.failed} failed test{stats.failed === 1 ? '' : 's'} isolated out of {stats.total} total)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {stats.failed > 0 && (
                  <button
                    onClick={() => runFilteredSuites('failed')}
                    disabled={isRunningAll}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Re-run Failed ({stats.failed})
                  </button>
                )}
                <button
                  onClick={() => setStatusFilter('all')}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Show All Tests
                </button>
              </div>
            </div>
          )}

          {/* Test Groups & Cases List */}
          <div className="space-y-4">
            {filteredGroups.length === 0 ? (
              <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
                {statusFilter === 'failed' && stats.failed === 0 ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <h3 className="text-base font-bold text-white">No Failed Tests Detected</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      All executed tests in the selected category are passing green! Run test suites or clear filter to inspect all test cases.
                    </p>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      Show All Tests
                    </button>
                  </>
                ) : (
                  <>
                    <Search className="w-8 h-8 text-slate-600 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-300">No Matching Test Cases Found</h3>
                    <p className="text-xs text-slate-500">Try adjusting your category, search query, or filters.</p>
                  </>
                )}
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isGroupRunning = runningGroups[group.id];
                const groupPassCount = group.tests.filter((t) => results[t.id]?.passed).length;

                return (
                  <div key={group.id} className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xs">
                    {/* Group Header */}
                    <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{group.title}</h3>
                          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-sm border border-indigo-500/20">
                            {groupPassCount} / {group.tests.length} Passed
                          </span>
                          {group.domain && (
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-sm">
                              {group.domain}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{group.description}</p>
                      </div>

                      <button
                        onClick={() => runGroup(group)}
                        disabled={isGroupRunning || isRunningAll}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                      >
                        <Play className={`w-3 h-3 ${isGroupRunning ? 'animate-spin' : ''}`} />
                        {isGroupRunning ? 'Running Suite...' : 'Run Suite'}
                      </button>
                    </div>

                    {/* Test Case Rows */}
                    <div className="divide-y divide-slate-800/60">
                      {group.tests.map((test) => {
                        const isRunning = runningTests[test.id];
                        const res = results[test.id];
                        const isSelected = !!selectedTestIds[test.id];

                        return (
                          <div
                            key={test.id}
                            className={`test-case-row p-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors ${
                              isSelected ? 'bg-indigo-950/20' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Selection Checkbox */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectTest(test.id)}
                                className="w-4 h-4 rounded-sm border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                              />

                              {/* Status Icon */}
                              <div className="shrink-0">
                                {isRunning ? (
                                  <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                                ) : res?.passed ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : res ? (
                                  <XCircle className="w-4 h-4 text-rose-400" />
                                ) : (
                                  <Clock className="w-4 h-4 text-slate-600" />
                                )}
                              </div>

                              {/* Test Info */}
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded-sm border border-slate-800">
                                    {test.id}
                                  </span>
                                  <span className="font-medium text-sm text-white truncate">{test.name}</span>
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-sm">
                                    {test.category}
                                  </span>
                                  <span className="text-[10px] font-mono text-cyan-400 uppercase">
                                    {test.testLevel}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 truncate">{test.description}</p>
                                {res && (
                                  <div
                                    className={`text-[11px] font-mono mt-0.5 truncate ${
                                      res.passed ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {res.message} {res.durationMs > 0 && `(${res.durationMs}ms)`}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row Action Controls */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => setInspectedTest(test)}
                                className="px-2.5 py-1 rounded-md border border-slate-800 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              >
                                Details
                              </button>
                              <button
                                onClick={() => runTest(test.id, group)}
                                disabled={isRunning || isRunningAll}
                                className="p-1.5 rounded-md text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
                                title="Run this test"
                              >
                                <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. Test Details Inspection Drawer */}
      <TestDetailsDrawer
        test={inspectedTest}
        result={inspectedTest ? results[inspectedTest.id] || null : null}
        isRunning={inspectedTest ? runningTests[inspectedTest.id] : false}
        onClose={() => setInspectedTest(null)}
        onRunTest={(testId) => {
          const group = testGroups.find((g) => g.tests.some((t) => t.id === testId));
          if (group) runTest(testId, group);
        }}
      />
    </div>
  );
};
