import React, { useState, useMemo } from 'react';
import {
  Zap,
  Play,
  Pause,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Sliders,
  Trash2,
  Copy,
  Terminal,
  Activity,
  GitFork,
  MessageSquare,
  Send,
  UploadCloud,
  Layers,
  Cpu,
  Bot,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { mockAutomationRules, mockAutomationRuns, mockAutomationTemplates } from '@/mocks/db/intelligence/automations';
import { AutomationAction, AutomationCondition, AutomationRule, AutomationRun, AutomationTemplate, TriggerEventType } from '@/types/automations';
import { PlatformGraphModal } from '@/modules/platform/components/PlatformGraphModal';

export const AutomationsPage: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>(mockAutomationRules);
  const [runs, setRuns] = useState<AutomationRun[]>(mockAutomationRuns);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'rules' | 'runs' | 'templates'>('rules');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Interactive Drawers / Modals
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [runInspectorOpen, setRunInspectorOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<AutomationRun | null>(null);
  const [showPlatformGraph, setShowPlatformGraph] = useState(false);

  // Builder Form State
  const [builderForm, setBuilderForm] = useState<{
    name: string;
    description: string;
    trigger_event: TriggerEventType;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
  }>({
    name: 'New Production Rule',
    description: 'Custom trigger, condition and action chain',
    trigger_event: 'version.approved',
    conditions: [{ id: 'c-new-1', field: 'project_code', operator: 'equals', value: 'NK99' }],
    actions: [
      { id: 'a-new-1', type: 'publish_version', name: 'Promote USD Master Layer', params: {} },
      { id: 'a-new-2', type: 'notify_channel', name: 'Send Slack Notification', params: { channel: '#nk99-alerts' } },
    ],
  });

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      const matchSearch =
        !searchQuery.trim() ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.trigger_label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'enabled' && r.enabled) ||
        (statusFilter === 'disabled' && !r.enabled);

      return matchSearch && matchStatus;
    });
  }, [rules, searchQuery, statusFilter]);

  // Handlers
  const handleToggleRule = (rule: AutomationRule) => {
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleCreateFromTemplate = (template: AutomationTemplate) => {
    const newRule: AutomationRule = {
      id: `auto-rule-${Date.now()}`,
      name: template.title,
      description: template.description,
      enabled: true,
      trigger_event: template.trigger_event,
      trigger_label: template.title,
      conditions: [...template.conditions],
      actions: [...template.actions],
      runs_count: 0,
      created_by: 'Pipeline TD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [template.badge, 'Template'],
    };

    setRules((prev) => [newRule, ...prev]);
    setActiveTab('rules');
  };

  const handleSaveBuilderRule = () => {
    if (selectedRule) {
      // Update existing
      setRules((prev) =>
        prev.map((r) =>
          r.id === selectedRule.id
            ? {
                ...r,
                name: builderForm.name,
                description: builderForm.description,
                trigger_event: builderForm.trigger_event,
                conditions: builderForm.conditions,
                actions: builderForm.actions,
                updated_at: new Date().toISOString(),
              }
            : r
        )
      );
    } else {
      // Create new
      const newRule: AutomationRule = {
        id: `auto-rule-${Date.now()}`,
        name: builderForm.name,
        description: builderForm.description,
        enabled: true,
        trigger_event: builderForm.trigger_event,
        trigger_label: builderForm.name,
        conditions: builderForm.conditions,
        actions: builderForm.actions,
        runs_count: 0,
        created_by: 'Studio Supervisor',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: ['Custom', 'VFX Rule'],
      };
      setRules((prev) => [newRule, ...prev]);
    }
    setBuilderModalOpen(false);
    setSelectedRule(null);
  };

  const handleSimulateRule = (rule: AutomationRule) => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      const simulatedRun: AutomationRun = {
        id: `run-sim-${Date.now()}`,
        rule_id: rule.id,
        rule_name: rule.name,
        trigger_event: rule.trigger_event,
        triggered_at: new Date().toISOString(),
        status: 'success',
        duration_ms: Math.floor(Math.random() * 200) + 80,
        context_entity: {
          type: 'version',
          id: 'v-nk99-010-010-comp-v04',
          code: 'NK99_010_010_comp_v04.exr',
          project_code: 'NK99',
        },
        conditions_evaluated: rule.conditions.map((c) => ({
          field: c.field,
          expected: c.value,
          actual: c.value,
          passed: true,
        })),
        action_results: rule.actions.map((a) => ({
          action_id: a.id,
          action_type: a.type,
          status: 'success',
          duration_ms: Math.floor(Math.random() * 60) + 20,
          message: `Simulated action [${a.name}] executed with zero side-effects.`,
        })),
        logs: [
          `[${new Date().toLocaleTimeString()}] Simulation started for ${rule.name}`,
          `[${new Date().toLocaleTimeString()}] Target context: Version NK99_010_010_comp_v04.exr (Project: NK99)`,
          `[${new Date().toLocaleTimeString()}] All ${rule.conditions.length} conditions evaluated to TRUE`,
          `[${new Date().toLocaleTimeString()}] Simulated ${rule.actions.length} action dispatches: 100% successful`,
        ],
      };

      setSimulationResult(simulatedRun);
      setSelectedRun(simulatedRun);
      setRunInspectorOpen(true);
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
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white tracking-wide">Automation Hub</h1>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Rule Engine Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Build event triggers, multi-action chains, downstream task cascades, and client delivery triggers
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
                Platform Graph
              </button>
              <button
                onClick={() => {
                  setSelectedRule(null);
                  setBuilderForm({
                    name: 'New Custom VFX Rule',
                    description: 'Trigger actions on production lifecycle changes',
                    trigger_event: 'version.approved',
                    conditions: [{ id: 'c-1', field: 'project_code', operator: 'equals', value: 'NK99' }],
                    actions: [
                      { id: 'a-1', type: 'publish_version', name: 'Promote USD Master Layer', params: {} },
                      { id: 'a-2', type: 'notify_channel', name: 'Send Slack Notification', params: { channel: '#nk99-alerts' } },
                    ],
                  });
                  setBuilderModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-lg shadow-purple-600/30"
              >
                <Plus className="w-4 h-4" />
                Create Automation Rule
              </button>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-4 mt-5 border-t border-slate-800/80 pt-3">
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-2 text-xs font-semibold pb-2 border-b-2 transition-all ${
                activeTab === 'rules'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Active Rules ({rules.length})
            </button>
            <button
              onClick={() => setActiveTab('runs')}
              className={`flex items-center gap-2 text-xs font-semibold pb-2 border-b-2 transition-all ${
                activeTab === 'runs'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Execution Runs & Logs ({runs.length})
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 text-xs font-semibold pb-2 border-b-2 transition-all ${
                activeTab === 'templates'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              VFX Automation Recipes ({mockAutomationTemplates.length})
            </button>
          </div>
        </div>
      </div>

      {/* Body Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        
        {/* TAB 1: ACTIVE RULES */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search rules, triggers, actions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <span className="text-slate-400 px-2 font-medium">Status:</span>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                    statusFilter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('enabled')}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                    statusFilter === 'enabled' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Enabled
                </button>
                <button
                  onClick={() => setStatusFilter('disabled')}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                    statusFilter === 'disabled' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Disabled
                </button>
              </div>
            </div>

            {/* Rules List */}
            <div className="space-y-4">
              {filteredRules.map((rule) => {
                return (
                  <div
                    key={rule.id}
                    className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg group"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            rule.enabled ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-600'
                          }`}
                        />
                        <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                          {rule.name}
                        </h3>
                        {rule.tags?.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-1">{rule.description}</p>

                      {/* Visual Flow summary */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          {rule.trigger_label}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                        <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                          {rule.conditions.length} Condition{rule.conditions.length > 1 ? 's' : ''}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                        <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                          {rule.actions.length} Action{rule.actions.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Stats & Controls */}
                    <div className="flex items-center gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-mono text-slate-300">
                          {rule.runs_count} runs
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Last: {rule.last_run_at ? new Date(rule.last_run_at).toLocaleTimeString() : 'Never'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSimulateRule(rule)}
                          disabled={isSimulating}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1"
                          title="Simulate / Dry-Run rule execution"
                        >
                          <Play className="w-3 h-3 text-amber-400" />
                          Simulate
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRule(rule);
                            setBuilderForm({
                              name: rule.name,
                              description: rule.description,
                              trigger_event: rule.trigger_event,
                              conditions: [...rule.conditions],
                              actions: [...rule.actions],
                            });
                            setBuilderModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Edit Rule"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            rule.enabled
                              ? 'bg-amber-950/60 text-amber-400 hover:bg-amber-900/60 border border-amber-500/30'
                              : 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-500/30'
                          }`}
                          title={rule.enabled ? 'Disable Rule' : 'Enable Rule'}
                        >
                          {rule.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: EXECUTION RUNS */}
        {activeTab === 'runs' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Live Execution Ledger</h3>
                <p className="text-xs text-slate-400">Step-by-step telemetry for automation triggers and action pipelines</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono border border-emerald-500/30">
                ● Engine Health 100%
              </span>
            </div>

            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  onClick={() => {
                    setSelectedRun(run);
                    setRunInspectorOpen(true);
                  }}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                        {run.status}
                      </span>
                      <h4 className="text-xs font-bold text-white">{run.rule_name}</h4>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      Target: <span className="text-slate-200">{run.context_entity.code}</span> • Trigger: {run.trigger_event}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                    <span>{run.duration_ms}ms</span>
                    <span>{new Date(run.triggered_at).toLocaleTimeString()}</span>
                    <button className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold">
                      Inspect Trace
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: RECIPES MARKETPLACE */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">Pre-Built VFX Automation Recipes</h2>
              <p className="text-xs text-slate-400">Battle-tested automation pipelines ready for instant one-click activation</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockAutomationTemplates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition-all flex flex-col justify-between group shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {tmpl.badge}
                      </span>
                      <span className="text-xs text-slate-500 font-mono capitalize">{tmpl.category}</span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                      {tmpl.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{tmpl.description}</p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400">
                      {tmpl.actions.length} action step{tmpl.actions.length > 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => handleCreateFromTemplate(tmpl)}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors shadow flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Install Recipe
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* MODAL: RULE BUILDER */}
      {builderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                {selectedRule ? 'Edit Automation Rule' : 'Visual Automation Rule Builder'}
              </h3>
              <button
                onClick={() => setBuilderModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-gradient-to-b from-slate-900 to-slate-950">
              {/* Name & Description */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Rule Name</label>
                  <input
                    type="text"
                    value={builderForm.name}
                    onChange={(e) => setBuilderForm({ ...builderForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Description</label>
                  <input
                    type="text"
                    value={builderForm.description}
                    onChange={(e) => setBuilderForm({ ...builderForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Step 1: TRIGGER */}
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[11px] flex items-center justify-center">1</span>
                  <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">Trigger Event</h4>
                </div>
                <select
                  value={builderForm.trigger_event}
                  onChange={(e) => setBuilderForm({ ...builderForm, trigger_event: e.target.value as TriggerEventType })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-purple-500/40 text-xs text-white focus:outline-none"
                >
                  <option value="version.approved">Version Approved in Dailies Review</option>
                  <option value="shot.status_changed">Shot Status Changed (e.g. Cut update / Omit)</option>
                  <option value="task.status_changed">Task Status Changed to Completed</option>
                  <option value="delivery.created">Client Delivery Package Created</option>
                  <option value="render.failed">Deadline / Tractor Render Job Failed</option>
                  <option value="timelog.threshold_exceeded">Artist Timelog Exceeds 120% Bid</option>
                  <option value="asset.published">USD Asset Model Published to Stage</option>
                </select>
              </div>

              {/* Step 2: CONDITIONS */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">2</span>
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Conditions (AND)</h4>
                  </div>
                </div>

                {builderForm.conditions.map((cond, idx) => (
                  <div key={cond.id || idx} className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      defaultValue={cond.field}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      placeholder="Field (e.g. project_code)"
                    />
                    <select
                      defaultValue={cond.operator}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      <option value="equals">Equals</option>
                      <option value="not_equals">Not Equals</option>
                      <option value="contains">Contains</option>
                      <option value="greater_than">Greater Than</option>
                    </select>
                    <input
                      type="text"
                      defaultValue={String(cond.value)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      placeholder="Value"
                    />
                  </div>
                ))}
              </div>

              {/* Step 3: ACTIONS */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center">3</span>
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Action Chain</h4>
                  </div>
                </div>

                <div className="space-y-2">
                  {builderForm.actions.map((act, idx) => (
                    <div key={act.id || idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-purple-400 font-bold">Step {idx + 1}:</span>
                        <span className="font-semibold text-slate-200">{act.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">{act.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
              <button
                onClick={() => setBuilderModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBuilderRule}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30"
              >
                Save Automation Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: RUN INSPECTOR */}
      {runInspectorOpen && selectedRun && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Execution Run Inspector</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedRun.id} • {selectedRun.rule_name}</p>
                </div>
                <button
                  onClick={() => setRunInspectorOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Status Header */}
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase">Execution Successful</span>
                  <span className="text-xs font-mono text-slate-300">{selectedRun.duration_ms}ms</span>
                </div>
                <p className="text-xs text-slate-300">
                  Target Context: <code className="text-indigo-300">{selectedRun.context_entity.code}</code> ({selectedRun.context_entity.project_code})
                </p>
              </div>

              {/* Conditions Evaluated */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Conditions Evaluation</h4>
                <div className="space-y-1.5">
                  {selectedRun.conditions_evaluated.map((c, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between">
                      <span className="text-slate-300">{c.field} == {String(c.expected)}</span>
                      <span className="text-emerald-400 font-bold">PASSED (✓)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Steps Output */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Action Pipeline Dispatches</h4>
                <div className="space-y-2">
                  {selectedRun.action_results.map((act, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{act.action_type}</span>
                        <span className="text-emerald-400 font-mono font-bold text-[11px]">{act.duration_ms}ms</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">{act.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logs */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Diagnostic Logs</h4>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                  {selectedRun.logs.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={() => setRunInspectorOpen(false)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs"
              >
                Close Inspector
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
