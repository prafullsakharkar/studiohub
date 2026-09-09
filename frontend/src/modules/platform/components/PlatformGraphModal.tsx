import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Layers,
  ArrowRight,
  Sparkles,
  Building2,
  Film,
  CheckSquare,
  History,
  PlaySquare,
  UploadCloud,
  Send,
  Users,
  Search,
  Bot,
  Zap,
  Cable,
  BookOpen,
  Activity,
  Sliders,
  ShieldCheck,
  ChevronRight,
  Database,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface PlatformGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlatformGraphModal: React.FC<PlatformGraphModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [activeFlow, setActiveFlow] = useState<'lifecycle' | 'automation' | 'intelligence' | 'architecture'>('lifecycle');

  if (!isOpen) return null;

  const handleNodeClick = (route: string) => {
    navigate(route);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">StudioHub Universal Platform Graph</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Unified VFX OS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interactive architecture, live data lineage & connected entity topology
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-800/80 bg-slate-950/40 overflow-x-auto">
          <button
            onClick={() => setActiveFlow('lifecycle')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFlow === 'lifecycle'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            VFX Production Lifecycle Flow (Client-to-Client)
          </button>
          <button
            onClick={() => setActiveFlow('automation')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFlow === 'automation'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Workflow & Automation Pipeline
          </button>
          <button
            onClick={() => setActiveFlow('intelligence')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFlow === 'intelligence'
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Intelligence & Connected Knowledge Flow
          </button>
          <button
            onClick={() => setActiveFlow('architecture')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFlow === 'architecture'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            4-Tier Platform Architecture
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-950">
          
          {/* 1. LIFECYCLE FLOW */}
          {activeFlow === 'lifecycle' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-indigo-200 text-xs flex items-center justify-between">
                <span>
                  <strong>Full Closed-Loop Lineage:</strong> Every entity in StudioHub maintains strict referential integrity with real-time audit tracing, organization isolation, and live status propagation.
                </span>
                <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  100% Synced
                </span>
              </div>

              {/* Node Chain */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { title: '1. Client', subtitle: 'Studio / Partner', route: '/clients', icon: Building2, color: 'border-blue-500/40 bg-blue-950/20 text-blue-300' },
                  { title: '2. Project', subtitle: 'VFX Show & Bids', route: '/projects', icon: Film, color: 'border-indigo-500/40 bg-indigo-950/20 text-indigo-300' },
                  { title: '3. Shot & Asset', subtitle: 'USD Hierarchy & Cut', route: '/shots', icon: Layers, color: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300' },
                  { title: '4. Task', subtitle: 'Dept Assignee & Bid', route: '/tasks', icon: CheckSquare, color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' },
                  { title: '5. Person', subtitle: 'Artist & Timelogs', route: '/people', icon: Users, color: 'border-amber-500/40 bg-amber-950/20 text-amber-300' },
                  { title: '6. Version', subtitle: 'ACEScg EXR & USD', route: '/versions', icon: History, color: 'border-purple-500/40 bg-purple-950/20 text-purple-300' },
                  { title: '7. Review', subtitle: 'Dailies & Notes', route: '/reviews', icon: PlaySquare, color: 'border-pink-500/40 bg-pink-950/20 text-pink-300' },
                  { title: '8. Publish', subtitle: 'Pipeline Validation', route: '/publishing', icon: UploadCloud, color: 'border-teal-500/40 bg-teal-950/20 text-teal-300' },
                  { title: '9. Delivery', subtitle: 'Aspera & Frame.io', route: '/deliveries', icon: Send, color: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300' },
                  { title: '10. Client Signoff', subtitle: 'Final Acceptance', route: '/clients', icon: Building2, color: 'border-blue-500/40 bg-blue-950/20 text-blue-300' },
                ].map((node, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleNodeClick(node.route)}
                    className={`p-3.5 rounded-xl border ${node.color} hover:border-white/60 hover:scale-[1.02] cursor-pointer transition-all duration-150 flex flex-col justify-between group shadow-lg`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <node.icon className="w-5 h-5 opacity-90 group-hover:text-white" />
                      <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 group-hover:text-white">{node.title}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{node.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Flow Explainer */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Universal Platform Invariants</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="font-semibold text-slate-200">Zero Data Leakage:</span> Multi-tenant isolation at database, ORM, and caching levels.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="font-semibold text-slate-200">Unified Event Bus:</span> Real-time WebSocket pub/sub syncing notifications, live review annotations, and automation webhooks.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="font-semibold text-slate-200">Immutable Audit Trail:</span> Every status transition and file mutation is cryptographically signed in the platform ledger.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. AUTOMATION & WORKFLOW FLOW */}
          {activeFlow === 'automation' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/20 text-purple-200 text-xs flex items-center justify-between">
                <span>
                  <strong>Continuous Pipeline Automation:</strong> Trigger multi-action VFX workflows upon approval, publish, delivery, or metric threshold events.
                </span>
                <button
                  onClick={() => handleNodeClick('/automations')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow"
                >
                  Open Automation Hub <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4 bg-slate-800/40 rounded-xl border border-slate-700/60">
                <div className="flex-1 p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-indigo-400">Project / Stage</span>
                  <p className="text-xs font-semibold text-slate-200 mt-1">Project Milestone</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 rotate-90 md:rotate-0" />
                <div className="flex-1 p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-purple-400">Workflow Rules</span>
                  <p className="text-xs font-semibold text-slate-200 mt-1">Dependency Canvas</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 rotate-90 md:rotate-0" />
                <div className="flex-1 p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-amber-400">Automation Hub</span>
                  <p className="text-xs font-semibold text-slate-200 mt-1">Triggers & Actions</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 rotate-90 md:rotate-0" />
                <div className="flex-1 p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Pipeline Engine</span>
                  <p className="text-xs font-semibold text-slate-200 mt-1">DCC / Farm / USD</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 rotate-90 md:rotate-0" />
                <div className="flex-1 p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-cyan-400">Publish & Delivery</span>
                  <p className="text-xs font-semibold text-slate-200 mt-1">Master Delivery</p>
                </div>
              </div>
            </div>
          )}

          {/* 3. INTELLIGENCE FLOW */}
          {activeFlow === 'intelligence' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-500/20 text-teal-200 text-xs flex items-center justify-between">
                <span>
                  <strong>Intelligence Knowledge Graph:</strong> Context-aware AI Copilot, full-text 16-entity search, real-time risk radar, and pipeline SOP integration.
                </span>
                <button
                  onClick={() => handleNodeClick('/ai')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow"
                >
                  Open AI Workspace <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div
                  onClick={() => handleNodeClick('/search')}
                  className="p-4 rounded-xl bg-slate-800/40 border border-indigo-500/30 hover:border-indigo-500 cursor-pointer transition-all"
                >
                  <Search className="w-5 h-5 text-indigo-400 mb-2" />
                  <h4 className="text-xs font-bold text-white">Global Full-Text Search</h4>
                  <p className="text-[11px] text-slate-400 mt-1">16 indexed entity domains with faceted metadata filters.</p>
                </div>
                <div
                  onClick={() => handleNodeClick('/knowledge')}
                  className="p-4 rounded-xl bg-slate-800/40 border border-emerald-500/30 hover:border-emerald-500 cursor-pointer transition-all"
                >
                  <BookOpen className="w-5 h-5 text-emerald-400 mb-2" />
                  <h4 className="text-xs font-bold text-white">Knowledge & SOPs</h4>
                  <p className="text-[11px] text-slate-400 mt-1">USD standards, delivery specs & department procedures.</p>
                </div>
                <div
                  onClick={() => handleNodeClick('/ai')}
                  className="p-4 rounded-xl bg-slate-800/40 border border-teal-500/30 hover:border-teal-500 cursor-pointer transition-all"
                >
                  <Bot className="w-5 h-5 text-teal-400 mb-2" />
                  <h4 className="text-xs font-bold text-white">AI Risk Radar</h4>
                  <p className="text-[11px] text-slate-400 mt-1">Bottleneck prediction, task rebalancing & smart mitigation.</p>
                </div>
                <div
                  onClick={() => handleNodeClick('/analytics')}
                  className="p-4 rounded-xl bg-slate-800/40 border border-cyan-500/30 hover:border-cyan-500 cursor-pointer transition-all"
                >
                  <Activity className="w-5 h-5 text-cyan-400 mb-2" />
                  <h4 className="text-xs font-bold text-white">Telemetry & Analytics</h4>
                  <p className="text-[11px] text-slate-400 mt-1">Live studio velocity, burn rates & render farm utilization.</p>
                </div>
              </div>
            </div>
          )}

          {/* 4. 4-TIER ARCHITECTURE */}
          {activeFlow === 'architecture' && (
            <div className="space-y-4">
              {/* Layer 1: PLATFORM / FOUNDATION */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">LAYER 1</span>
                    <h4 className="text-xs font-bold text-white">PLATFORM / FOUNDATION</h4>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Authentication • RBAC • Multi-Tenant • Audit Ledger</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {['Core Repository', 'Identity & SSO', 'Organization Engine', 'Settings & Config', 'Audit Ledger', 'Notifications', 'Billing & Metering', 'Reports Engine', 'Whitelabel'].map((item, i) => (
                    <span key={i} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Layer 2: BUSINESS / RELATIONS */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">LAYER 2</span>
                    <h4 className="text-xs font-bold text-white">BUSINESS / RELATIONS</h4>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Partner Studios • Human Capital • Studio Offices</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {['Clients & Contracts', 'Vendors & Partners', 'People & Profiles', 'Production Teams', 'Departments (2D/3D)', 'Global Offices', 'Rate Cards'].map((item, i) => (
                    <span key={i} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Layer 3: PRODUCTION DOMAIN */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">LAYER 3</span>
                    <h4 className="text-xs font-bold text-white">PRODUCTION DOMAIN</h4>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">VFX Entities • USD Pipeline • Review Dailies</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {['Projects (Shows)', 'USD Assets', 'Cut Shots', 'Task Hierarchy', 'Published Versions', 'Review Dailies', 'Publishing Center', 'Aspera Deliveries', 'Playlists', 'Workflow Graph', 'Resource Allocations', 'Live Timelogs', 'Gantt Scheduling', 'Media Engine'].map((item, i) => (
                    <span key={i} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Layer 4: INTELLIGENCE & AUTOMATION */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">LAYER 4</span>
                    <h4 className="text-xs font-bold text-white">INTELLIGENCE & AUTOMATION</h4>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">AI Copilot • Global Indexer • Automation Hub • External Integrations</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {['AI Copilot & Radar', '16-Domain Search', 'Knowledge Hub (SOPs)', 'Automation Engine', 'Studio Telemetry', 'DCC Pipeline', 'Integration Hub (8 Categories)'].map((item, i) => (
                    <span key={i} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950 text-xs text-slate-400">
          <span>Industrial Pixel Magic • StudioHub OS v4.20 Enterprise</span>
          <div className="flex items-center gap-4">
            <span className="font-mono text-emerald-400">● Global Multi-Tenant Active</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
            >
              Close Inspector
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
