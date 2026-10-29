import React from 'react';
import {
  ShieldCheck,
  Layers,
  Film,
  Boxes,
  Database,
  Server,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Flame,
  KeyRound,
  FileCheck2,
  Workflow,
  Search,
  MoveUpRight,
} from 'lucide-react';
import { TestCoverageReport, FeatureInventoryItem } from '@/core/testing/types';

interface TestCoverageDashboardProps {
  coverage: TestCoverageReport;
  onSelectFeature?: (feat: FeatureInventoryItem) => void;
}

export const TestCoverageDashboard: React.FC<TestCoverageDashboardProps> = ({
  coverage,
  onSelectFeature,
}) => {
  const { overall, byLevel, byDomain, byCategory, gaps } = coverage;

  const getStatusColor = (pct: number) => {
    if (pct >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (pct >= 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const getBarColor = (pct: number) => {
    if (pct >= 90) return 'bg-emerald-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* 1. High-Level Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Coverage</span>
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white">{overall.coveragePct}%</span>
            <span className="text-xs text-slate-400 font-mono">({overall.passing}/{overall.total} passing)</span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getBarColor(overall.coveragePct)}`}
              style={{ width: `${overall.coveragePct}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unit Layer</span>
            <Layers className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white">{byLevel.unit.coveragePct}%</span>
            <span className="text-xs text-slate-400 font-mono">({byLevel.unit.passing}/{byLevel.unit.total})</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Logic, RBAC matrix, validators & schema checks</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Integration Layer</span>
            <Database className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white">{byLevel.integration.coveragePct}%</span>
            <span className="text-xs text-slate-400 font-mono">({byLevel.integration.passing}/{byLevel.integration.total})</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Primary production layer: API + MSW + Workspace</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">E2E Critical Flows</span>
            <Film className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white">{byLevel.e2e.coveragePct}%</span>
            <span className="text-xs text-slate-400 font-mono">({byLevel.e2e.passing}/{byLevel.e2e.total})</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Critical end-to-end user journeys & security</p>
        </div>
      </div>

      {/* 2. Test Pyramid & Domain Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domain Breakdown */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Boxes className="w-4 h-4 text-indigo-400" />
            Coverage by Domain
          </h3>
          <div className="space-y-3">
            {Object.entries(byDomain).map(([domain, data]) => (
              <div key={domain} className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{domain} Domain</span>
                  <span className="font-mono text-slate-400">
                    {data.passing} / {data.total} passed ({data.coveragePct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${getBarColor(data.coveragePct)}`}
                    style={{ width: `${data.coveragePct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Test Pyramid Distribution Rule */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            Standard Test Pyramid Distribution
          </h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-950/10 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-300">Unit Tests (Target: 60-70%)</span>
                <span className="font-mono text-blue-400 font-bold">
                  {overall.total > 0 ? Math.round((byLevel.unit.total / overall.total) * 100) : 0}% of Total
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Pure logic, permission helpers, Zod schema validation, transformers, and query key builders.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-950/10 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-300">Integration Tests (Target: 25-35%)</span>
                <span className="font-mono text-indigo-400 font-bold">
                  {overall.total > 0 ? Math.round((byLevel.integration.total / overall.total) * 100) : 0}% of Total
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Primary production test layer: Component + Query + MSW + Mock DB + Multi-Tenant Context.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/10 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300">E2E Tests (Target: 5-10%)</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {overall.total > 0 ? Math.round((byLevel.e2e.total / overall.total) * 100) : 0}% of Total
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Critical user journeys across the browser (Login, Tenant isolation, Review approvals, Recovery).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Automatic Gap Detection & Feature Inventory Report */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Automatic Feature Inventory & Gap Audit
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {gaps.length === 0 ? 'All 18 Feature Categories Covered' : `${gaps.length} Gaps Detected`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {coverage.gaps.length === 0 ? (
            <div className="col-span-full p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-emerald-300">100% Core Feature Matrix Covered</h4>
                <p className="text-[11px] text-slate-400">
                  Every discovered platform domain, organization workspace, production workflow, and RBAC matrix is mapped to active automated test suites.
                </p>
              </div>
            </div>
          ) : (
            gaps.map((gap) => (
              <div
                key={gap.id}
                className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 transition-colors cursor-pointer space-y-1.5"
                onClick={() => onSelectFeature?.(gap)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">{gap.id}</span>
                  <span className="text-[10px] font-mono text-slate-400">{gap.domain}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-200">{gap.feature}</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">{gap.description}</p>
                <div className="pt-1 flex items-center gap-1 text-[10px] text-amber-400/90 font-mono">
                  <AlertCircle className="w-3 h-3" />
                  <span>Missing automated test bindings</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
