import React, { useState, useEffect } from 'react';
import {
  GitFork,
  Plus,
  Play,
  Save,
  Copy,
  Archive,
  CheckCircle2,
  AlertCircle,
  Zap,
  History,
  Sliders,
  Sparkles,
  Layers,
  Shield,
  Eye,
  RefreshCw,
  PowerOff,
  Power,
  RotateCcw,
} from 'lucide-react';
import {
  Workflow,
  WorkflowNode,
  WorkflowTransition,
  WorkflowNodeType,
  WorkflowDryRunStep,
} from '@/types/workflow';
import { Button } from '@/shared/components/Button';
import {
  useWorkflows,
  useWorkflowDetail,
  useCreateWorkflow,
  useUpdateWorkflow,
  useCloneWorkflow,
  useActivateWorkflow,
  useDeactivateWorkflow,
  useArchiveWorkflow,
  useAutomationRules,
} from '../hooks/useWorkflows';
import { WorkflowCanvas } from './canvas/WorkflowCanvas';
import { NodePalette } from './canvas/NodePalette';
import { NodeConfigDrawer } from './canvas/NodeConfigDrawer';
import { TransitionConfigModal } from './canvas/TransitionConfigModal';
import { WorkflowSimulatorModal } from './simulator/WorkflowSimulatorModal';
import { AutomationRuleBuilderModal } from './automation/AutomationRuleBuilderModal';
import { AutomationAuditLogsModal } from './automation/AutomationAuditLogsModal';
import { CreateWorkflowModal } from './CreateWorkflowModal';

interface WorkflowStudioProps {
  projectId?: string;
  projectCode?: string;
}

export const WorkflowStudio: React.FC<WorkflowStudioProps> = ({
  projectId,
  projectCode,
}) => {
  const { data: workflowsData, isLoading: isListLoading } = useWorkflows();
  const workflows = workflowsData?.results || [];

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  // Auto-select first workflow when loaded
  useEffect(() => {
    if (workflows.length > 0 && !selectedWorkflowId) {
      // Prefer project match if any
      const match = workflows.find(
        (w) => w.project_id === projectId || (projectCode && w.code.includes(projectCode))
      );
      setSelectedWorkflowId(match ? match.id : workflows[0].id);
    }
  }, [workflows, selectedWorkflowId, projectId, projectCode]);

  const { data: activeWorkflow, isLoading: isDetailLoading } = useWorkflowDetail(
    selectedWorkflowId || undefined
  );

  // Local state for interactive editing on canvas before saving
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Drawer / Modals state
  const [selectedNodeForConfig, setSelectedNodeForConfig] = useState<WorkflowNode | null>(null);
  const [isNodeDrawerOpen, setIsNodeDrawerOpen] = useState<boolean>(false);

  const [selectedTransitionForConfig, setSelectedTransitionForConfig] = useState<WorkflowTransition | null>(null);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState<boolean>(false);

  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [activeSimStep, setActiveSimStep] = useState<WorkflowDryRunStep | null>(null);
  const [activeSimIndex, setActiveSimIndex] = useState<number>(-1);

  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState<boolean>(false);
  const [isAuditLogsModalOpen, setIsAuditLogsModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // Mutations
  const updateWorkflowMutation = useUpdateWorkflow();
  const cloneWorkflowMutation = useCloneWorkflow();
  const activateWorkflowMutation = useActivateWorkflow();
  const deactivateWorkflowMutation = useDeactivateWorkflow();
  const archiveWorkflowMutation = useArchiveWorkflow();

  const { data: automationRules } = useAutomationRules();

  // Sync loaded workflow into local canvas state
  useEffect(() => {
    if (activeWorkflow) {
      setNodes(activeWorkflow.nodes || []);
      setTransitions(activeWorkflow.transitions || []);
      setHasUnsavedChanges(false);
    }
  }, [activeWorkflow]);

  // Handle local state updates from canvas
  const handleNodesChange = (newNodes: WorkflowNode[]) => {
    setNodes(newNodes);
    setHasUnsavedChanges(true);
  };

  const handleTransitionsChange = (newTransitions: WorkflowTransition[]) => {
    setTransitions(newTransitions);
    setHasUnsavedChanges(true);
  };

  // Add node from palette
  const handleAddNode = (type: WorkflowNodeType) => {
    if (!activeWorkflow) return;

    const nodeTypeNames: Record<WorkflowNodeType, string> = {
      start: 'Project Ingest Start',
      task: 'DCC Work Step',
      approval: 'Supervisor Signoff Gate',
      review: 'Screening Dailies Session',
      publish: 'Studio Master Publish',
      delivery: 'Client Turnover Delivery',
      condition: 'Approval Decision Branch',
      automation: 'Multi-Action Event Hook',
      end: 'Milestone Archived / End',
    };

    // Calculate nice position offset
    const existingCount = nodes.length;
    const posX = 100 + (existingCount % 4) * 320;
    const posY = 120 + Math.floor(existingCount / 4) * 220;

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      workflow_id: activeWorkflow.id,
      type,
      title: nodeTypeNames[type],
      description: `Configured ${type} pipeline stage`,
      department:
        type === 'task' ? 'Modeling' : type === 'publish' ? 'Pipeline TD' : undefined,
      position: { x: posX, y: posY },
      config:
        type === 'task'
          ? { primary_dcc: 'Autodesk Maya', sla_hours: 16 }
          : type === 'approval'
          ? { approval_type: 'supervisor' }
          : type === 'publish'
          ? { publish_target: 'comp_exr' }
          : type === 'delivery'
          ? { delivery_protocol: 'aspera' }
          : type === 'condition'
          ? { condition_field: 'status', condition_operator: 'equals', condition_value: 'Approved' }
          : {},
    };

    handleNodesChange([...nodes, newNode]);
  };

  // Node & Transition config handlers
  const handleSelectNode = (node: WorkflowNode) => {
    setSelectedNodeForConfig(node);
    setIsNodeDrawerOpen(true);
  };

  const handleSaveNodeConfig = (updatedNode: WorkflowNode) => {
    handleNodesChange(nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
  };

  const handleSelectTransition = (transition: WorkflowTransition) => {
    setSelectedTransitionForConfig(transition);
    setIsTransitionModalOpen(true);
  };

  const handleSaveTransitionConfig = (updatedTransition: WorkflowTransition) => {
    handleTransitionsChange(
      transitions.map((t) => (t.id === updatedTransition.id ? updatedTransition : t))
    );
  };

  const handleDeleteTransition = (id: string) => {
    handleTransitionsChange(transitions.filter((t) => t.id !== id));
  };

  // Save changes to backend
  const handleSaveWorkflowDAG = async () => {
    if (!activeWorkflow) return;
    await updateWorkflowMutation.mutateAsync({
      id: activeWorkflow.id,
      data: {
        nodes,
        transitions,
      },
    });
    setHasUnsavedChanges(false);
  };

  // Lifecycle actions
  const handleClone = async () => {
    if (!activeWorkflow) return;
    const cloned = await cloneWorkflowMutation.mutateAsync(activeWorkflow.id);
    setSelectedWorkflowId(cloned.id);
  };

  const handleToggleActive = async () => {
    if (!activeWorkflow) return;
    if (activeWorkflow.is_active) {
      await deactivateWorkflowMutation.mutateAsync(activeWorkflow.id);
    } else {
      await activateWorkflowMutation.mutateAsync(activeWorkflow.id);
    }
  };

  const handleArchive = async () => {
    if (!activeWorkflow) return;
    await archiveWorkflowMutation.mutateAsync(activeWorkflow.id);
  };

  if (isListLoading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs">
        Loading workflow graph specifications...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3">
      {/* Top Workflow Studio Toolbar */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-xl shrink-0">
        {/* Left: Workflow Selection & Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
            <GitFork className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <select
                value={selectedWorkflowId || ''}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
              >
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    [{wf.code}] {wf.name} ({wf.nodes?.length || 0} Nodes)
                  </option>
                ))}
              </select>

              {activeWorkflow && (
                <>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border font-bold uppercase ${
                      activeWorkflow.is_active
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {activeWorkflow.is_active ? 'Active in Prod' : 'Draft / Inactive'}
                  </span>

                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {activeWorkflow.category}
                  </span>
                </>
              )}
            </div>
            {activeWorkflow?.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-xl truncate">
                {activeWorkflow.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions & Operations */}
        <div className="flex items-center gap-2 flex-wrap">
          {hasUnsavedChanges && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveWorkflowDAG}
              disabled={updateWorkflowMutation.isPending}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white animate-pulse"
            >
              <Save className="w-3.5 h-3.5" />
              Save DAG Changes
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSimulatorOpen(true)}
            className="gap-1.5 text-emerald-300 hover:text-emerald-200 border-emerald-500/30 hover:bg-emerald-950/40"
            title="Dry-run simulator with sample entities"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            Test / Simulate
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAutomationModalOpen(true)}
            className="gap-1.5 text-fuchsia-300 hover:text-fuchsia-200 border-fuchsia-500/30 hover:bg-fuchsia-950/40"
            title="Configure Reusable Triggers, Conditions & Actions"
          >
            <Zap className="w-3.5 h-3.5 text-fuchsia-400" />
            Automation Rules
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAuditLogsModalOpen(true)}
            className="gap-1.5 text-slate-300 hover:text-white"
            title="View permission-aware execution logs"
          >
            <History className="w-3.5 h-3.5" />
            Audit Logs
          </Button>

          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          {activeWorkflow && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleActive}
              title={activeWorkflow.is_active ? 'Deactivate workflow' : 'Activate workflow'}
              className={activeWorkflow.is_active ? 'text-amber-300' : 'text-emerald-300'}
            >
              {activeWorkflow.is_active ? (
                <>
                  <PowerOff className="w-3.5 h-3.5 mr-1" /> Pause
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5 mr-1" /> Activate
                </>
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClone}
            title="Clone into new workflow"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleArchive}
            title="Archive workflow"
            className="text-slate-500 hover:text-rose-400"
          >
            <Archive className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> New Pipeline
          </Button>
        </div>
      </div>

      {/* Active Automation Rules Summary Banner */}
      {automationRules && automationRules.length > 0 && (
        <div className="px-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto min-w-0">
            <span className="text-[10px] font-mono font-bold text-fuchsia-400 uppercase shrink-0 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Armed Automation:
            </span>
            <span className="text-slate-300 font-mono text-[11px] truncate">
              {automationRules[0].name} ({automationRules[0].actions.length} action cascade)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAutomationModalOpen(true)}
            className="text-[10px] font-mono text-indigo-400 hover:underline shrink-0"
          >
            Manage Rules ({automationRules.length}) →
          </button>
        </div>
      )}

      {/* Main Workflow Visual Canvas Workspace */}
      <div className="flex-1 min-h-[540px] rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex shadow-2xl relative">
        {/* Left Side Node Palette */}
        <NodePalette onAddNode={handleAddNode} />

        {/* Center Interactive Graph Canvas */}
        <WorkflowCanvas
          nodes={nodes}
          transitions={transitions}
          onNodesChange={handleNodesChange}
          onTransitionsChange={handleTransitionsChange}
          onSelectNode={handleSelectNode}
          onSelectTransition={handleSelectTransition}
          isSimulating={isSimulatorOpen}
          activeSimulationStep={activeSimStep}
          activeSimulationIndex={activeSimIndex}
        />

        {/* Right Slide-over Node Config Drawer */}
        <NodeConfigDrawer
          node={selectedNodeForConfig}
          isOpen={isNodeDrawerOpen}
          onClose={() => setIsNodeDrawerOpen(false)}
          onSave={handleSaveNodeConfig}
        />
      </div>

      {/* Transition / Edge Config Modal */}
      <TransitionConfigModal
        transition={selectedTransitionForConfig}
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        onSave={handleSaveTransitionConfig}
        onDelete={handleDeleteTransition}
      />

      {/* Simulator Modal */}
      {activeWorkflow && (
        <WorkflowSimulatorModal
          workflow={activeWorkflow}
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
          onStepChange={(step, idx) => {
            setActiveSimStep(step);
            setActiveSimIndex(idx);
          }}
        />
      )}

      {/* Reusable Automation Rule Builder */}
      {activeWorkflow && (
        <AutomationRuleBuilderModal
          workflowId={activeWorkflow.id}
          isOpen={isAutomationModalOpen}
          onClose={() => setIsAutomationModalOpen(false)}
        />
      )}

      {/* Audit Logs Modal */}
      <AutomationAuditLogsModal
        isOpen={isAuditLogsModalOpen}
        onClose={() => setIsAuditLogsModalOpen(false)}
      />

      {/* Create Workflow Modal */}
      <CreateWorkflowModal
        projectId={projectId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(wf) => setSelectedWorkflowId(wf.id)}
      />
    </div>
  );
};
