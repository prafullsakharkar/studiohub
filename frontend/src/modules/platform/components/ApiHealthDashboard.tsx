import React, { useState, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  Flame,
  ShieldCheck,
  Server,
  Zap,
  Play,
  Clock,
  Layers,
  ArrowUpRight,
  Database,
  Cpu,
  Wifi,
  BarChart3,
  Sliders,
  Radio,
  Share2,
} from 'lucide-react';
import { useApiHealth } from '../health/useApiHealth';
import { EndpointMetric, ServiceHealthSummary } from '@/types/system';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LatencyTrendChart } from './health/LatencyTrendChart';
import { ServiceCard } from './health/ServiceCard';
import { EndpointDetailModal } from './health/EndpointDetailModal';
import { ChaosSimulatorModal } from './health/ChaosSimulatorModal';

export interface ApiHealthDashboardProps {
  className?: string;
  defaultCategory?: string;
  compactMode?: boolean;
}

export const ApiHealthDashboard: React.FC<ApiHealthDashboardProps> = ({
  className = '',
  defaultCategory = 'all',
  compactMode = false,
}) => {
  const {
    endpoints,
    services,
    incidents,
    probeHistory,
    globalMetrics,
    timeSeries,
    isAutoPolling,
    pollingIntervalSec,
    countdown,
    isProbingAll,
    chaosConfig,
    setIsAutoPolling,
    setPollingIntervalSec,
    setChaosConfig,
    probeEndpoint,
    probeAll,
    resetTelemetry,
    exportDiagnosticReport,
  } = useApiHealth();

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<'endpoints' | 'services' | 'analytics' | 'incidents' | 'logs'>('endpoints');
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory);
  const [statusFilter, setStatusFilter] = useState<'all' | 'operational' | 'degraded' | 'outage'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointMetric | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isChaosModalOpen, setIsChaosModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Probing single endpoint state tracker
  const [probingIds, setProbingIds] = useState<Record<string, boolean>>({});

  const handleSingleProbe = async (endpointId: string) => {
    setProbingIds((prev) => ({ ...prev, [endpointId]: true }));
    try {
      await probeEndpoint(endpointId);
    } finally {
      setTimeout(() => {
        setProbingIds((prev) => ({ ...prev, [endpointId]: false }));
      }, 350);
    }
  };

  const handleInspectEndpoint = (endpoint: EndpointMetric) => {
    setSelectedEndpoint(endpoint);
    setIsDetailModalOpen(true);
  };

  const handleCopyStatusSummary = () => {
    const summary = `StudioHub API Health Status: ${globalMetrics.overallStatus.toUpperCase()}
SLA: ${globalMetrics.slaCompliance}% | Avg Latency: ${globalMetrics.avgLatencyMs}ms | Healthy Endpoints: ${globalMetrics.healthyEndpointsCount}/${globalMetrics.totalEndpointsCount}
Report Timestamp: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(summary);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Filter endpoints
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      // Category filter
      if (selectedCategory !== 'all' && ep.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && ep.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          ep.name.toLowerCase().includes(q) ||
          ep.path.toLowerCase().includes(q) ||
          ep.categoryLabel.toLowerCase().includes(q) ||
          ep.method.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [endpoints, selectedCategory, statusFilter, searchQuery]);

  const categories = [
    { id: 'all', label: 'All Endpoints' },
    { id: 'platform', label: 'Platform & Core' },
    { id: 'auth', label: 'Auth & RBAC' },
    { id: 'production', label: 'Production Core' },
    { id: 'assets', label: 'OpenUSD Assets' },
    { id: 'tasks', label: 'Tasks & Timelogs' },
    { id: 'reviews', label: 'Screening & Reviews' },
    { id: 'publishing', label: 'Publishing & EXR' },
    { id: 'deliveries', label: 'Delivery Gateway' },
    { id: 'workflows', label: 'Workflows & DAG' },
    { id: 'farm', label: 'Farm & Compute' },
  ];

  return (
    <div id="studiohub-api-health-dashboard" className={`space-y-6 ${className}`}>
      {/* Top Banner & Real-Time Action Bar */}
      <div className="p-4 sm:p-5 bg-slate-900/95 border border-slate-800 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-white tracking-tight">
                StudioHub API & Core Services Health Engine
              </h2>
              {globalMetrics.overallStatus === 'operational' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  All Core Systems Operational
                </span>
              ) : globalMetrics.overallStatus === 'degraded' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Elevated Latency Detected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  Service Disruption
                </span>
              )}
              {chaosConfig.enabled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <Flame className="w-3 h-3 text-rose-400" />
                  Chaos Mode Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live telemetry, endpoint latency waterfall, SLA compliance, and distributed microservices status
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Polling Interval & Auto-Probe Switcher */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <Radio className={`w-3.5 h-3.5 ${isAutoPolling ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <button
              onClick={() => setIsAutoPolling(!isAutoPolling)}
              className="font-medium text-slate-300 hover:text-white transition-colors"
            >
              {isAutoPolling ? `Live (${countdown}s)` : 'Paused'}
            </button>
            <select
              value={pollingIntervalSec}
              onChange={(e) => setPollingIntervalSec(parseInt(e.target.value, 10))}
              disabled={!isAutoPolling}
              className="bg-transparent text-[11px] font-mono text-cyan-400 border-none outline-hidden cursor-pointer pl-1"
            >
              <option value="3" className="bg-slate-900 text-slate-200">3s</option>
              <option value="5" className="bg-slate-900 text-slate-200">5s</option>
              <option value="10" className="bg-slate-900 text-slate-200">10s</option>
              <option value="30" className="bg-slate-900 text-slate-200">30s</option>
            </select>
          </div>

          {/* Probe All Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={probeAll}
            disabled={isProbingAll}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isProbingAll ? 'animate-spin text-cyan-400' : ''}`} />}
          >
            {isProbingAll ? 'Probing All...' : 'Probe All'}
          </Button>

          {/* Chaos Simulator Trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChaosModalOpen(true)}
            className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 hover:text-white"
            leftIcon={<Flame className="w-3.5 h-3.5 text-rose-400" />}
          >
            Chaos Test
          </Button>

          {/* Export Report */}
          <Button
            variant="outline"
            size="sm"
            onClick={exportDiagnosticReport}
            title="Download JSON Health Report"
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export
          </Button>

          {/* Copy Summary */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyStatusSummary}
            title="Copy Health Summary to Clipboard"
            leftIcon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          >
            {copiedLink ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Primary KPI Metric Cards Row (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: 30-Day SLA */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              SLA Compliance
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Target 99.90%
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono tracking-tight flex items-baseline gap-2">
              {globalMetrics.slaCompliance}%
              <span className="text-xs font-normal text-emerald-400 font-sans">99.98% 30d</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Zero unplanned outages in current billing cycle</p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{ width: `${Math.min(100, globalMetrics.slaCompliance)}%` }}
            />
          </div>
        </div>

        {/* Card 2: Average Latency */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              Response Latency
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              P95: {globalMetrics.p95LatencyMs}ms
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-cyan-400 font-mono tracking-tight flex items-baseline gap-1.5">
              {globalMetrics.avgLatencyMs}
              <span className="text-xs font-normal text-slate-400 font-sans">ms avg</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              P99: {globalMetrics.p99LatencyMs}ms • AP-Southeast Edge
            </p>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
            <span>Auth: 8ms</span>
            <span>•</span>
            <span>USD: 16ms</span>
            <span>•</span>
            <span>Farm: 22ms</span>
          </div>
        </div>

        {/* Card 3: Success Rate & Throughput */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-indigo-400" />
              API Success Rate
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              1,420 req/s
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-400 font-mono tracking-tight flex items-baseline gap-2">
              {globalMetrics.successRate}%
              <span className="text-xs font-normal text-slate-400 font-sans">184.5k today</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Error budget: 99.2% remaining this quarter</p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full"
              style={{ width: `${Math.min(100, globalMetrics.successRate)}%` }}
            />
          </div>
        </div>

        {/* Card 4: Services & Endpoints Online */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-teal-400" />
              Active Nodes & Endpoints
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Farm: 124/128
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono tracking-tight flex items-baseline gap-2">
              {globalMetrics.healthyEndpointsCount}/{globalMetrics.totalEndpointsCount}
              <span className="text-xs font-normal text-emerald-400 font-sans">
                {globalMetrics.healthyServicesCount}/{globalMetrics.totalServicesCount} Services
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">OpenUSD Resolver & DRF cluster synchronized</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Last checked: {globalMetrics.lastFullProbeTime}</span>
          </div>
        </div>
      </div>

      {/* Latency & Telemetry Time Series Chart */}
      <LatencyTrendChart data={timeSeries} />

      {/* View Tabs & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'endpoints'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Core Endpoints ({filteredEndpoints.length})
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'services'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Microservices Matrix ({services.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'logs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Live Probe Stream {probeHistory.length > 0 && `(${probeHistory.length})`}
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'incidents'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            SLA & Incident History
          </button>
        </div>

        {/* Global Search and Status Filter */}
        {activeTab === 'endpoints' && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search endpoints..."
                className="pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500/50 w-44 sm:w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-hidden focus:border-cyan-500/50 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="operational">Operational</option>
              <option value="degraded">Degraded</option>
              <option value="outage">Outages</option>
            </select>
          </div>
        )}
      </div>

      {/* Subsystem Category Pills for Endpoints */}
      {activeTab === 'endpoints' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-slate-800 text-cyan-300 font-semibold border border-slate-700'
                  : 'bg-slate-950/50 text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* TAB 1: Endpoints Matrix */}
      {activeTab === 'endpoints' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium">
                  <th className="py-3 px-4">Method & Endpoint</th>
                  <th className="py-3 px-4">Subsystem</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Live Latency</th>
                  <th className="py-3 px-4">Sparkline (10p)</th>
                  <th className="py-3 px-4">24h Uptime</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredEndpoints.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No matching endpoints found.
                    </td>
                  </tr>
                ) : (
                  filteredEndpoints.map((ep) => {
                    const isProbing = Boolean(probingIds[ep.id]);
                    return (
                      <tr
                        key={ep.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => handleInspectEndpoint(ep)}
                      >
                        {/* Method & Path */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                                ep.method === 'GET'
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : ep.method === 'POST'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              }`}
                            >
                              {ep.method}
                            </span>
                            <div className="truncate max-w-xs sm:max-w-md">
                              <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                                {ep.name}
                              </div>
                              <div className="font-mono text-[11px] text-slate-400 truncate">{ep.path}</div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                            {ep.categoryLabel}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {ep.status === 'operational' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              200 OK
                            </span>
                          ) : ep.status === 'degraded' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              Degraded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle className="w-3 h-3" />
                              {ep.httpStatus || 500}
                            </span>
                          )}
                        </td>

                        {/* Latency */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-white text-xs">{ep.latencyMs}</span>
                          <span className="text-[10px] text-slate-500 ml-0.5 font-mono">ms</span>
                        </td>

                        {/* Sparkline */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-end gap-0.5 h-5 w-20">
                            {ep.recentLatencies.map((lat: number, idx: number) => {
                              const heightPct = Math.min(100, Math.max(15, (lat / 50) * 100));
                              return (
                                <div
                                  key={idx}
                                  title={`${lat}ms`}
                                  className={`flex-1 rounded-xs transition-all ${
                                    lat > 100 ? 'bg-rose-400' : lat > 40 ? 'bg-amber-400' : 'bg-cyan-400'
                                  }`}
                                  style={{ height: `${heightPct}%` }}
                                />
                              );
                            })}
                          </div>
                        </td>

                        {/* 24h Uptime */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-emerald-400 font-semibold">{ep.uptime24h}%</span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleSingleProbe(ep.id)}
                              disabled={isProbing}
                              leftIcon={<Play className={`w-3 h-3 ${isProbing ? 'animate-spin text-cyan-400' : ''}`} />}
                            >
                              {isProbing ? 'Pinging' : 'Ping'}
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleInspectEndpoint(ep)}
                            >
                              Inspect
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Microservices Matrix */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((srv) => (
            <ServiceCard key={srv.id} service={srv} />
          ))}
        </div>
      )}

      {/* TAB 3: Live Probe Stream Log */}
      {activeTab === 'logs' && (
        <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                Live Network Prober & Telemetry Event Log
              </h3>
              <p className="text-xs text-slate-400">Stream of individual HTTP probe execution records</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => probeAll()} disabled={isProbingAll}>
              Trigger Full Probe Run
            </Button>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto custom-scrollbar bg-slate-950/60 rounded-xl border border-slate-800/60 font-mono text-xs">
            {probeHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-sans text-xs">
                No probe history recorded yet. Click "Probe All" or ping individual endpoints to populate stream.
              </div>
            ) : (
              probeHistory.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-900/50">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-slate-500 text-[11px]">{item.timestamp}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        item.method === 'GET' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {item.method}
                    </span>
                    <span className="text-white truncate">{item.endpointPath}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-cyan-400 font-bold">{item.latencyMs}ms</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.success
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      HTTP {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SLA & Incident History */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              SLA Commitments & Operational Track Record
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400">Guaranteed SLA Threshold</span>
                <div className="text-lg font-bold text-white font-mono mt-1">99.90%</div>
                <span className="text-[10px] text-slate-500">Max allowed downtime: 43m/mo</span>
              </div>
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400">Actual 90-Day Performance</span>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-1">99.98%</div>
                <span className="text-[10px] text-emerald-500 font-medium">Exceeding SLA Target</span>
              </div>
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400">Mean Time to Recovery (MTTR)</span>
                <div className="text-lg font-bold text-cyan-400 font-mono mt-1">4.2 min</div>
                <span className="text-[10px] text-slate-500">Automated failover active</span>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Recent System Incidents & Scheduled Maintenance Log
            </h4>
            <div className="space-y-3">
              {incidents.map((inc) => (
                <div key={inc.id} className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            inc.severity === 'maintenance'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : inc.severity === 'minor'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {inc.severity}
                        </span>
                        <h5 className="text-xs font-bold text-white">{inc.title}</h5>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Affected Service: <strong className="text-slate-300">{inc.service}</strong> • Logged:{' '}
                        {new Date(inc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      Resolved
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{inc.description}</p>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    {inc.updates.map((upd: any, idx: number) => (
                      <div key={idx} className="text-[11px] flex items-start gap-2 text-slate-400 font-mono">
                        <span className="text-slate-500 shrink-0">
                          [{new Date(upd.timestamp).toLocaleTimeString()}]
                        </span>
                        <span>{upd.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <EndpointDetailModal
        endpoint={selectedEndpoint}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onProbe={probeEndpoint}
      />

      <ChaosSimulatorModal
        isOpen={isChaosModalOpen}
        onClose={() => setIsChaosModalOpen(false)}
        config={chaosConfig}
        onUpdateConfig={setChaosConfig}
        onReset={resetTelemetry}
      />
    </div>
  );
};
