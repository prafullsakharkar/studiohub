import React from 'react';
import {
  Play,
  CheckSquare,
  ShieldCheck,
  PlaySquare,
  UploadCloud,
  Send,
  GitBranch,
  Zap,
  CheckCircle2,
  Clock,
  Trash2,
  Settings2,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { WorkflowNode, WorkflowNodeType } from '@/types/workflow';

interface NodeCardProps {
  node: WorkflowNode;
  isSelected: boolean;
  isSimulating?: boolean;
  simulationStatus?: 'executed' | 'skipped' | 'failed' | 'pending';
  onSelect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onEdit: (node: WorkflowNode) => void;
  onStartConnection: (nodeId: string, port: 'out' | 'true' | 'false' | 'default') => void;
  onEndConnection: (nodeId: string) => void;
  isConnecting?: boolean;
}

const nodeTypeThemes: Record<
  WorkflowNodeType,
  {
    bg: string;
    border: string;
    headerBg: string;
    iconColor: string;
    tagBg: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  start: {
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-500/40 hover:border-emerald-400',
    headerBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    iconColor: 'text-emerald-400',
    tagBg: 'bg-emerald-500/20 text-emerald-300',
    icon: Play,
    label: 'START EVENT',
  },
  task: {
    bg: 'bg-indigo-950/40',
    border: 'border-indigo-500/40 hover:border-indigo-400',
    headerBg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    iconColor: 'text-indigo-400',
    tagBg: 'bg-indigo-500/20 text-indigo-300',
    icon: CheckSquare,
    label: 'TASK STEP',
  },
  approval: {
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/40 hover:border-amber-400',
    headerBg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    iconColor: 'text-amber-400',
    tagBg: 'bg-amber-500/20 text-amber-300',
    icon: ShieldCheck,
    label: 'APPROVAL GATE',
  },
  review: {
    bg: 'bg-purple-950/40',
    border: 'border-purple-500/40 hover:border-purple-400',
    headerBg: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    iconColor: 'text-purple-400',
    tagBg: 'bg-purple-500/20 text-purple-300',
    icon: PlaySquare,
    label: 'REVIEW SESSION',
  },
  publish: {
    bg: 'bg-cyan-950/40',
    border: 'border-cyan-500/40 hover:border-cyan-400',
    headerBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    iconColor: 'text-cyan-400',
    tagBg: 'bg-cyan-500/20 text-cyan-300',
    icon: UploadCloud,
    label: 'STUDIO PUBLISH',
  },
  delivery: {
    bg: 'bg-teal-950/40',
    border: 'border-teal-500/40 hover:border-teal-400',
    headerBg: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    iconColor: 'text-teal-400',
    tagBg: 'bg-teal-500/20 text-teal-300',
    icon: Send,
    label: 'CLIENT DELIVERY',
  },
  condition: {
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/50 hover:border-amber-400',
    headerBg: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    iconColor: 'text-amber-400',
    tagBg: 'bg-amber-500/20 text-amber-300',
    icon: GitBranch,
    label: 'CONDITION BRANCH',
  },
  automation: {
    bg: 'bg-fuchsia-950/40',
    border: 'border-fuchsia-500/40 hover:border-fuchsia-400',
    headerBg: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20',
    iconColor: 'text-fuchsia-400',
    tagBg: 'bg-fuchsia-500/20 text-fuchsia-300',
    icon: Zap,
    label: 'AUTOMATION CASCADE',
  },
  end: {
    bg: 'bg-slate-900/60',
    border: 'border-slate-700 hover:border-slate-500',
    headerBg: 'bg-slate-800 text-slate-300 border-slate-700',
    iconColor: 'text-slate-400',
    tagBg: 'bg-slate-800 text-slate-300',
    icon: CheckCircle2,
    label: 'END / ARCHIVE',
  },
};

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  isSelected,
  isSimulating,
  simulationStatus,
  onSelect,
  onDelete,
  onEdit,
  onStartConnection,
  onEndConnection,
  isConnecting,
}) => {
  const theme = nodeTypeThemes[node.type] || nodeTypeThemes.task;
  const Icon = theme.icon;

  let simulationRing = '';
  if (isSimulating) {
    if (simulationStatus === 'executed') {
      simulationRing = 'ring-4 ring-emerald-500 ring-offset-2 ring-offset-slate-950 shadow-lg shadow-emerald-500/30 scale-[1.03] transition-all duration-300';
    } else if (simulationStatus === 'failed') {
      simulationRing = 'ring-4 ring-rose-500 ring-offset-2 ring-offset-slate-950 shadow-lg shadow-rose-500/30';
    } else if (simulationStatus === 'pending') {
      simulationRing = 'ring-4 ring-indigo-500/60 animate-pulse ring-offset-2 ring-offset-slate-950';
    }
  }

  return (
    <div
      id={`node-${node.id}`}
      style={{
        transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`,
        position: 'absolute',
        left: 0,
        top: 0,
      }}
      className={`w-72 select-none cursor-pointer rounded-2xl border ${theme.bg} ${theme.border} backdrop-blur-md transition-shadow duration-200 shadow-xl ${
        isSelected ? 'ring-2 ring-indigo-400 border-indigo-400 shadow-indigo-500/20' : ''
      } ${simulationRing}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
    >
      {/* Input Connector Port */}
      {node.type !== 'start' && (
        <div
          title="Connect input port"
          onClick={(e) => {
            e.stopPropagation();
            if (isConnecting) {
              onEndConnection(node.id);
            }
          }}
          className={`absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900 border-2 ${
            isConnecting ? 'border-indigo-400 animate-bounce bg-indigo-950' : 'border-slate-600 hover:border-indigo-400 hover:bg-slate-800'
          } flex items-center justify-center transition-all z-20 shadow-md cursor-crosshair`}
        >
          <div className="w-2 h-2 rounded-full bg-indigo-400" />
        </div>
      )}

      {/* Header */}
      <div className={`px-3.5 py-2.5 rounded-t-2xl border-b ${theme.headerBg} flex items-center justify-between`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1 rounded-lg bg-slate-950/60 ${theme.iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase truncate">
            {theme.label}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {node.config.sla_hours && (
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-0.5 bg-slate-950/50 px-1.5 py-0.5 rounded">
              <Clock className="w-2.5 h-2.5" /> {node.config.sla_hours}h
            </span>
          )}
          <button
            type="button"
            title="Edit node properties"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(node);
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800/80 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Delete node"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800/80 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-3.5 space-y-2.5">
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight leading-snug">{node.title}</h4>
          {node.description && (
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {node.description}
            </p>
          )}
        </div>

        {/* Dynamic Node Attributes */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/60 text-[10px] font-mono">
          {node.department && (
            <span className="px-2 py-0.5 rounded bg-slate-900/90 text-slate-300 border border-slate-800">
              {node.department}
            </span>
          )}

          {node.config.primary_dcc && (
            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {node.config.primary_dcc}
            </span>
          )}

          {node.config.approval_type && (
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Signoff: {node.config.approval_type}
            </span>
          )}

          {node.config.publish_target && (
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Target: {node.config.publish_target}
            </span>
          )}

          {node.config.delivery_protocol && (
            <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
              Protocol: {node.config.delivery_protocol}
            </span>
          )}

          {node.type === 'condition' && node.config.condition_field && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
              {node.config.condition_field} == {node.config.condition_value || 'true'}
            </span>
          )}
        </div>

        {/* Validation Errors warning if any */}
        {node.validation_errors && node.validation_errors.length > 0 && (
          <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="truncate">{node.validation_errors[0]}</span>
          </div>
        )}
      </div>

      {/* Output Connector Ports */}
      {node.type === 'condition' ? (
        <>
          {/* True Port */}
          <div
            title="Condition True Port (Drag to connect)"
            onClick={(e) => {
              e.stopPropagation();
              onStartConnection(node.id, 'true');
            }}
            className="absolute -right-3.5 top-1/3 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900 border-2 border-emerald-500 hover:scale-110 flex items-center justify-center transition-all z-20 shadow-md cursor-crosshair group"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 group-hover:w-3 group-hover:h-3 transition-all" />
            <span className="absolute -top-4 right-0 text-[9px] font-mono font-bold text-emerald-400 bg-slate-950 px-1 rounded border border-emerald-500/30">
              TRUE
            </span>
          </div>

          {/* False Port */}
          <div
            title="Condition False Port (Drag to connect)"
            onClick={(e) => {
              e.stopPropagation();
              onStartConnection(node.id, 'false');
            }}
            className="absolute -right-3.5 top-2/3 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900 border-2 border-rose-500 hover:scale-110 flex items-center justify-center transition-all z-20 shadow-md cursor-crosshair group"
          >
            <div className="w-2 h-2 rounded-full bg-rose-400 group-hover:w-3 group-hover:h-3 transition-all" />
            <span className="absolute -bottom-4 right-0 text-[9px] font-mono font-bold text-rose-400 bg-slate-950 px-1 rounded border border-rose-500/30">
              FALSE
            </span>
          </div>
        </>
      ) : node.type !== 'end' ? (
        <div
          title="Connect output port (Click or drag to target node)"
          onClick={(e) => {
            e.stopPropagation();
            onStartConnection(node.id, 'out');
          }}
          className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900 border-2 border-slate-600 hover:border-indigo-400 hover:bg-slate-800 flex items-center justify-center transition-all z-20 shadow-md cursor-crosshair group"
        >
          <div className="w-2 h-2 rounded-full bg-indigo-400 group-hover:scale-125 transition-transform" />
        </div>
      ) : null}
    </div>
  );
};
