import React, { useState, useMemo } from 'react';
import {
  Cable,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Play,
  Pause,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  MessageSquare,
  Cpu,
  Layers,
  Send,
  CreditCard,
  Activity,
  Terminal,
  ArrowUpRight,
  Plus,
  Trash2,
  Key,
  Database,
  GitFork,
  HelpCircle,
  FileCode,
  Sparkles,
  Server,
  Zap,
  Lock,
  Clock,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { mockIntegrations, mockMigrationJob } from '@/mocks/db/intelligence/integrations';
import { Integration, IntegrationCategory, IntegrationLog, IntegrationStatus } from '@/types/integrations';
import { PlatformGraphModal } from '@/modules/platform/components/PlatformGraphModal';

const CATEGORIES: { id: IntegrationCategory | 'all'; label: string; icon: any; count?: number }[] = [
  { id: 'all', label: 'All Integrations', icon: Cable },
  { id: 'pipeline', label: 'Pipeline & DCC', icon: Cpu },
  { id: 'storage', label: 'Storage & NAS', icon: HardDrive },
  { id: 'identity', label: 'Identity & SSO', icon: ShieldCheck },
  { id: 'communication', label: 'Communication', icon: MessageSquare },
  { id: 'production', label: 'Production & Sync', icon: Layers },
  { id: 'media', label: 'Media & Transfers', icon: Send },
  { id: 'finance', label: 'Finance & Ledger', icon: CreditCard },
  { id: 'analytics', label: 'Telemetry & APM', icon: Activity },
];

export const IntegrationsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations);
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'disconnected' | 'paused'>('all');

  // Modal / Drawer States
  const [activeTab, setActiveTab] = useState<'hub' | 'migration' | 'webhooks'>('hub');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ loading: boolean; success?: boolean; latency?: number; message?: string } | null>(null);
  const [isSyncingId, setIsSyncingId] = useState<string | null>(null);
  const [showPlatformGraph, setShowPlatformGraph] = useState(false);

  // Migration state
  const [migrationJob, setMigrationJob] = useState(mockMigrationJob);
  const [isMigrating, setIsMigrating] = useState(false);

  // Filtered List
  const filteredIntegrations = useMemo(() => {
    return integrations.filter((item) => {
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.provider_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'connected' && item.status === 'connected') ||
        (statusFilter === 'disconnected' && item.status === 'disconnected') ||
        (statusFilter === 'paused' && item.status === 'paused');

      return matchCategory && matchSearch && matchStatus;
    });
  }, [integrations, selectedCategory, searchQuery, statusFilter]);

  // Action Handlers
  const handleToggleStatus = (integration: Integration) => {
    const nextStatus: IntegrationStatus =
      integration.status === 'connected' ? 'paused' : integration.status === 'paused' ? 'connected' : 'connected';
    
    setIntegrations((prev) =>
      prev.map((item) => (item.id === integration.id ? { ...item, status: nextStatus } : item))
    );
  };

  const handleTestConnection = (integration: Integration) => {
    setSelectedIntegration(integration);
    setTestResult({ loading: true });
    setTestModalOpen(true);

    setTimeout(() => {
      const latency = Math.floor(Math.random() * 40) + 15;
      setTestResult({
        loading: false,
        success: true,
        latency,
        message: `Successfully established secure TLS handshake with ${integration.name}. API key and permission scopes verified.`,
      });
    }, 1200);
  };

  const handleSyncNow = (integration: Integration) => {
    setIsSyncingId(integration.id);
    setTimeout(() => {
      setIsSyncingId(null);
      setIntegrations((prev) =>
        prev.map((item) => {
          if (item.id === integration.id) {
            const newLog: IntegrationLog = {
              id: `log-${Date.now()}`,
              timestamp: new Date().toISOString(),
              level: 'success',
              message: `Manual sync cycle finished. Verified ${Math.floor(Math.random() * 50) + 10} updated records.`,
              duration_ms: Math.floor(Math.random() * 200) + 50,
            };
            return {
              ...item,
              sync_config: {
                ...item.sync_config,
                last_sync_at: new Date().toISOString(),
                last_sync_status: 'success',
                synced_records_count: item.sync_config.synced_records_count + 12,
              },
              logs: [newLog, ...item.logs],
            };
          }
          return item;
        })
      );
    }, 1500);
  };

  const handleSaveConfig = (updatedConfig: Record<string, any>) => {
    if (!selectedIntegration) return;
    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === selectedIntegration.id
          ? {
              ...item,
              configuration: { ...item.configuration, ...updatedConfig },
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );
    setConfigDrawerOpen(false);
  };

  const handleTriggerMigration = () => {
    setIsMigrating(true);
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex >= migrationJob.steps.length) {
        clearInterval(interval);
        setIsMigrating(false);
        setMigrationJob((prev) => ({
          ...prev,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }));
        return;
      }

      setMigrationJob((prev) => {
        const nextSteps = [...prev.steps];
        if (nextSteps[stepIndex]) {
          nextSteps[stepIndex] = { ...nextSteps[stepIndex], status: 'completed' };
        }
        return { ...prev, steps: nextSteps };
      });
      stepIndex++;
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
                  <Cable className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white tracking-wide">Integration Hub</h1>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      8 Categories Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connect pipeline DCC tools, render farms, cloud storage, SSO providers, and media delivery engines
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPlatformGraph(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all shadow"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Platform Graph & Lineage
              </button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-4 mt-5 border-t border-slate-800/80 pt-3">
            <button
              onClick={() => setActiveTab('hub')}
              className={`flex items-center gap-2 text-xs font-semibold pb-2 border-b-2 transition-all ${
                activeTab === 'hub'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cable className="w-3.5 h-3.5" />
              Connected Providers ({integrations.length})
            </button>
            <button
              onClick={() => setActiveTab('migration')}
              className={`flex items-center gap-2 text-xs font-semibold pb-2 border-b-2 transition-all ${
                activeTab === 'migration'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              VFX Migration Center (ShotGrid / ftrack / Kitsu)
            </button>
            <button
              onClick={() => setActiveTab('webhooks')}
              className={`flex items-center gap-2 text-xs font-semibold pb-2 border-b-2 transition-all ${
                activeTab === 'webhooks'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Webhooks & Event Bus Subscriptions
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        
        {/* TAB 1: INTEGRATION HUB */}
        {activeTab === 'hub' && (
          <div className="space-y-6">
            {/* Filters and Search Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search integrations, tools, APIs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-400 px-2 font-medium">Status:</span>
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setStatusFilter('connected')}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      statusFilter === 'connected' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Connected
                  </button>
                  <button
                    onClick={() => setStatusFilter('paused')}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      statusFilter === 'paused' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Paused
                  </button>
                </div>
              </div>
            </div>

            {/* Categories Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                const Icon = cat.icon;
                const count =
                  cat.id === 'all'
                    ? integrations.length
                    : integrations.filter((i) => i.category === cat.id).length;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cat.label}
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Integrations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIntegrations.map((item) => {
                const isSyncing = isSyncingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-lg"
                  >
                    <div>
                      {/* Top Row: Provider Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/80 text-indigo-400 group-hover:text-white transition-colors">
                            <Cpu className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                                {item.name}
                              </h3>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                              {item.category} • v{item.version}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              item.status === 'connected'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : item.status === 'paused'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : item.status === 'syncing'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {item.status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Score: {item.health_score}%
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-300 line-clamp-2 mb-4 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Metrics & Sync Info */}
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs mb-4">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Sync Mode:</span>
                          <span className="text-slate-200 font-mono capitalize">{item.sync_config.direction}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Last Synced:</span>
                          <span className="text-slate-200 font-mono">
                            {item.sync_config.last_sync_at
                              ? new Date(item.sync_config.last_sync_at).toLocaleTimeString()
                              : 'Never'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Records / Latency:</span>
                          <span className="text-emerald-400 font-mono">
                            {item.sync_config.synced_records_count.toLocaleString()} records ({item.sync_config.avg_latency_ms}ms)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions Bar */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTestConnection(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1"
                          title="Test Connection Handshake"
                        >
                          <Zap className="w-3 h-3 text-amber-400" />
                          Test
                        </button>
                        <button
                          onClick={() => handleSyncNow(item)}
                          disabled={isSyncing || item.status !== 'connected'}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                            isSyncing
                              ? 'bg-indigo-600/50 text-slate-300 cursor-not-allowed'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                          title="Trigger Immediate Sync Cycle"
                        >
                          <RefreshCw className={`w-3 h-3 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
                          {isSyncing ? 'Syncing...' : 'Sync'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedIntegration(item);
                            setLogsDrawerOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1"
                          title="View Provider Logs"
                        >
                          <Terminal className="w-3 h-3 text-cyan-400" />
                          Logs
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedIntegration(item);
                            setConfigDrawerOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Configure Settings & Credentials"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            item.status === 'connected'
                              ? 'bg-amber-950/60 text-amber-400 hover:bg-amber-900/60 border border-amber-500/30'
                              : 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-500/30'
                          }`}
                          title={item.status === 'connected' ? 'Pause Sync' : 'Resume Sync'}
                        >
                          {item.status === 'connected' ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: MIGRATION CENTER */}
        {activeTab === 'migration' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-400" />
                    VFX Production Migration Center
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Migrate projects, cut sequences, asset hierarchies, published versions, and user timelogs from legacy tracker databases.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTriggerMigration}
                    disabled={isMigrating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg ${
                      isMigrating
                        ? 'bg-indigo-600/50 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${isMigrating ? 'animate-spin' : ''}`} />
                    {isMigrating ? 'Running Migration...' : 'Start Migration Job'}
                  </button>
                </div>
              </div>

              {/* Source Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-300">Autodesk ShotGrid</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300">
                      Target Configured
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Source: <code className="text-slate-300">https://ipm-studios.shotgunstudio.com</code>
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 opacity-60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300">ftrack Studio</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-400">
                      Disconnected
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Configure API Key in settings to enable</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 opacity-60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300">Kitsu Studio</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-400">
                      Standby
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Ready for project entity import</p>
                </div>
              </div>

              {/* Migration Steps Progress */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Migration Pipeline Pipeline Steps (Job ID: {migrationJob.id})
                </h4>
                <div className="space-y-2">
                  {migrationJob.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            step.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : step.status === 'in_progress'
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {step.status === 'completed' ? '✓' : idx + 1}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-200">{step.name}</span>
                          {step.message && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{step.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 font-mono text-[11px]">
                        <span className="text-slate-400">
                          {step.processed_records} / {step.total_records} records
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase ${
                            step.status === 'completed'
                              ? 'bg-emerald-950 text-emerald-400'
                              : step.status === 'in_progress'
                              ? 'bg-indigo-950 text-indigo-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {step.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WEBHOOKS & EVENT BUS */}
        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  StudioHub Global Event Bus & Outbound Webhooks
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Listen to production events and dispatch encrypted JSON payloads to third-party endpoints, CI/CD runners, and custom VFX pipeline daemons.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { event: 'version.published', desc: 'Fires when new USD/EXR version is pushed to stage', active_subscribers: 4 },
                  { event: 'shot.status_changed', desc: 'Fires when editorial cut or supervisor approval changes status', active_subscribers: 6 },
                  { event: 'task.assigned', desc: 'Fires when artist is assigned to a department task', active_subscribers: 3 },
                  { event: 'delivery.manifest_created', desc: 'Fires when Aspera delivery package is generated', active_subscribers: 2 },
                  { event: 'review.dailies_signed_off', desc: 'Fires when dailies session is approved with director notes', active_subscribers: 5 },
                  { event: 'render.job_failed', desc: 'Fires when Deadline or Tractor encounters worker timeout', active_subscribers: 3 },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-400">{item.event}</span>
                      <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-slate-300">
                      {item.active_subscribers} endpoints
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: TEST CONNECTION MODAL */}
      {testModalOpen && selectedIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Testing {selectedIntegration.name}
              </h3>
              <button
                onClick={() => setTestModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>

            {testResult?.loading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-xs text-slate-400">Pinging provider endpoints & verifying auth credentials...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Handshake Verified (Latency: {testResult?.latency}ms)
                  </div>
                  <p className="text-slate-300">{testResult?.message}</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-[11px] font-mono text-slate-400">
                  <div>✓ TLS 1.3 Cipher Negotiation: SUCCESS</div>
                  <div>✓ Authentication Scope: OK (Full Read/Write)</div>
                  <div>✓ Health Ping Endpoint: 200 OK</div>
                </div>

                <button
                  onClick={() => setTestModalOpen(false)}
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DRAWER 1: CONFIGURATION DRAWER */}
      {configDrawerOpen && selectedIntegration && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Configure {selectedIntegration.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedIntegration.category} • Provider ID: {selectedIntegration.provider_id}</p>
                </div>
                <button
                  onClick={() => setConfigDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Dynamic Config Fields */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Provider Parameters</h4>
                {selectedIntegration.config_fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>{field.label}</span>
                      {field.required && <span className="text-[10px] text-rose-400 font-mono">Required</span>}
                    </label>
                    {field.type === 'boolean' ? (
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={Boolean(field.value)}
                          className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                        />
                        <span>Enable {field.label}</span>
                      </label>
                    ) : field.type === 'select' ? (
                      <select
                        defaultValue={field.value}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        defaultValue={field.value}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Credentials Section */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Credentials & Secrets
                </h4>
                {Object.entries(selectedIntegration.credentials_masked).map(([key, val]) => (
                  <div key={key} className="space-y-1">
                    <span className="text-xs text-slate-400 font-mono">{key}</span>
                    <input
                      type="password"
                      defaultValue={val}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => setConfigDrawerOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveConfig({})}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 2: LOGS DRAWER */}
      {logsDrawerOpen && selectedIntegration && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    {selectedIntegration.name} Logs
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">Live event feed & diagnostic traces</p>
                </div>
                <button
                  onClick={() => setLogsDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                {selectedIntegration.logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span
                        className={`font-bold uppercase ${
                          log.level === 'success'
                            ? 'text-emerald-400'
                            : log.level === 'warn'
                            ? 'text-amber-400'
                            : 'text-indigo-400'
                        }`}
                      >
                        [{log.level}]
                      </span>
                      <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{log.message}</p>
                    {log.duration_ms && (
                      <span className="text-[10px] text-slate-500">Duration: {log.duration_ms}ms</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={() => setLogsDrawerOpen(false)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLATFORM GRAPH MODAL */}
      <PlatformGraphModal
        isOpen={showPlatformGraph}
        onClose={() => setShowPlatformGraph(false)}
      />
    </div>
  );
};
