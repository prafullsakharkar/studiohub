import React, { useState } from 'react';
import {
  X,
  Plus,
  GitBranch,
  Layers,
  Sparkles,
  Film,
  Box,
  Send,
  Save,
} from 'lucide-react';
import {
  Workflow,
  WorkflowNode,
  WorkflowTransition,
  WorkflowNodeType,
  WorkflowCategory,
} from '@/types/workflow';
import { Button } from '@/shared/components/Button';
import { useCreateWorkflow } from '../hooks/useWorkflows';

interface CreateWorkflowModalProps {
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (wf: Workflow) => void;
}

const templates: Array<{
  id: string;
  name: string;
  category: 'Shot Pipeline' | 'Asset Pipeline' | 'Delivery Pipeline';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  nodesCount: number;
}> = [
  {
    id: 'shot-vfx',
    name: 'VFX Shot Full Turnaround (Camera → 3D → Comp → Deliver)',
    category: 'Shot Pipeline',
    description: 'Standard film VFX pipeline with automated QC, supervisor approval gates, and client Aspera turnover.',
    icon: Film,
    nodesCount: 7,
  },
  {
    id: 'asset-usd',
    name: 'Hero Asset OpenUSD Pipeline (Concept → Model → Texture → USD Master)',
    category: 'Asset Pipeline',
    description: 'Pyblish mesh preflight, ACEScg texture baking, and automated master USD stage publishing.',
    icon: Box,
    nodesCount: 6,
  },
  {
    id: 'turnover-delivery',
    name: 'Client Master Turnover & Validation Pipeline',
    category: 'Delivery Pipeline',
    description: 'Color-managed EXR transcode, frame range checksum verification, and studio delivery creation.',
    icon: Send,
    nodesCount: 4,
  },
];

export const CreateWorkflowModal: React.FC<CreateWorkflowModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<'Shot Pipeline' | 'Asset Pipeline' | 'Delivery Pipeline'>('Shot Pipeline');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>('shot-vfx');

  const createWorkflowMutation = useCreateWorkflow();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let initialNodes: WorkflowNode[] = [
      {
        id: 'node-start',
        type: 'start',
        title: 'Project Ingest / Start',
        description: 'Initiate pipeline processing',
        position: { x: 80, y: 150 },
        config: {},
      },
      {
        id: 'node-task-1',
        type: 'task',
        title: 'Primary DCC Work',
        department: 'Modeling',
        position: { x: 440, y: 150 },
        config: { primary_dcc: 'Autodesk Maya', sla_hours: 24 },
      },
      {
        id: 'node-approval',
        type: 'approval',
        title: 'Supervisor Review Gate',
        department: 'Production',
        position: { x: 800, y: 150 },
        config: { approval_type: 'supervisor' },
      },
      {
        id: 'node-publish',
        type: 'publish',
        title: 'Master Catalog Publish',
        department: 'Pipeline TD',
        position: { x: 1160, y: 150 },
        config: { publish_target: 'comp_exr' },
      },
      {
        id: 'node-end',
        type: 'end',
        title: 'Milestone Completed',
        position: { x: 1520, y: 150 },
        config: {},
      },
    ];

    let initialTransitions: WorkflowTransition[] = [
      {
        id: 'tr-1',
        source_node_id: 'node-start',
        target_node_id: 'node-task-1',
        trigger_event: 'status_changed' as const,
        label: 'Initialize',
      },
      {
        id: 'tr-2',
        source_node_id: 'node-task-1',
        target_node_id: 'node-approval',
        trigger_event: 'status_changed' as const,
        label: 'Ready for Review',
      },
      {
        id: 'tr-3',
        source_node_id: 'node-approval',
        target_node_id: 'node-publish',
        trigger_event: 'approved' as const,
        label: 'Approved by Lead',
      },
      {
        id: 'tr-4',
        source_node_id: 'node-publish',
        target_node_id: 'node-end',
        trigger_event: 'published' as const,
        label: 'Catalog Registered',
      },
    ];

    const result = await createWorkflowMutation.mutateAsync({
      project_id: projectId,
      name: name || 'New Production Pipeline',
      code: code ? code.toUpperCase() : `WF_${Date.now().toString().slice(-4)}`,
      description,
      category,
      is_active: false,
      nodes: initialNodes,
      transitions: initialTransitions,
    });

    onCreated(result);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create New Workflow Pipeline</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Define visual DAG nodes, department transitions, and automation rules.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Presets */}
          <div>
            <label className="block text-slate-400 font-mono text-[10px] uppercase mb-2">
              Select Production Architecture Preset
            </label>
            <div className="grid grid-cols-1 gap-2">
              {templates.map((tpl) => {
                const Icon = tpl.icon;
                const isSelected = selectedTemplate === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => {
                      setSelectedTemplate(tpl.id);
                      if (!name) setName(tpl.name.split(' (')[0]);
                      setCategory(tpl.category);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">{tpl.name}</span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {tpl.nodesCount} DAG Nodes
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-slate-400 font-mono text-[10px] mb-1 uppercase">
                WORKFLOW NAME
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Episodic VFX Shot Pipeline"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-medium focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-[10px] mb-1 uppercase">
                WORKFLOW CODE
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. WF_SHOT_MAIN"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono uppercase focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-mono text-[10px] mb-1 uppercase">
              PIPELINE CATEGORY
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
            >
              <option value="Shot Pipeline">Shot Pipeline</option>
              <option value="Asset Pipeline">Asset Pipeline</option>
              <option value="Delivery Pipeline">Delivery Pipeline</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-mono text-[10px] mb-1 uppercase">
              DESCRIPTION
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe department roles, turnaround SLAs, and deliverables..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-normal focus:border-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Footer Save */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createWorkflowMutation.isPending}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {createWorkflowMutation.isPending ? 'Creating...' : 'Initialize Workflow'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
