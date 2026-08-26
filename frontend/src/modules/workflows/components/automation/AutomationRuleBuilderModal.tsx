import React, { useState } from 'react';
import {
  X,
  Zap,
  Plus,
  Trash2,
  Save,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import {
  AutomationRule,
  AutomationTriggerEventType,
  AutomationActionType,
  AutomationConditionRule,
  AutomationActionRule,
} from '@/types/workflow';
import { Button } from '@/shared/components/Button';
import { useCreateAutomationRule } from '../../hooks/useWorkflows';

interface AutomationRuleBuilderModalProps {
  workflowId: string;
  isOpen: boolean;
  onClose: () => void;
}

const triggerOptions: Array<{ id: AutomationTriggerEventType; label: string; entity: 'Version' | 'Task' | 'Asset' | 'Delivery' | 'Review' }> = [
  { id: 'version.approved', label: 'Version Approved (Supervisor Signoff)', entity: 'Version' },
  { id: 'version.published', label: 'Version Published to USD Catalog', entity: 'Version' },
  { id: 'task.status_changed', label: 'Task Status Changed', entity: 'Task' },
  { id: 'task.blocked', label: 'Task Blocked / Impediment Flagged', entity: 'Task' },
  { id: 'qc.passed', label: 'QC Preflight Validation Passed', entity: 'Asset' },
  { id: 'qc.failed', label: 'QC Failed / Geometry Error', entity: 'Asset' },
  { id: 'delivery.created', label: 'Delivery Package Created', entity: 'Delivery' },
  { id: 'delivery.accepted', label: 'Client Delivery Accepted', entity: 'Delivery' },
];

const actionOptions: Array<{ type: AutomationActionType; label: string; desc: string }> = [
  { type: 'publish_version', label: 'Publish to Catalog', desc: 'Register USD/EXR master catalog entry' },
  { type: 'notify_producer', label: 'Notify Producer & Leads', desc: 'Dispatch Slack, in-app and email alert' },
  { type: 'create_delivery', label: 'Create Client Delivery', desc: 'Assemble Aspera turnover package' },
  { type: 'update_project_status', label: 'Update Project Status', desc: 'Advance milestone to next delivery state' },
  { type: 'update_task_status', label: 'Update Task Status', desc: 'Advance downstream task lifecycle' },
  { type: 'assign_artist', label: 'Assign Artist / Lead', desc: 'Auto-assign team member by rotation' },
  { type: 'create_review_session', label: 'Create Review Session', desc: 'Add version to Screening Room playlist' },
  { type: 'dispatch_render_farm', label: 'Dispatch Farm Job', desc: 'Queue Turntable or Sim bake on render blades' },
];

export const AutomationRuleBuilderModal: React.FC<AutomationRuleBuilderModalProps> = ({
  workflowId,
  isOpen,
  onClose,
}) => {
  const [name, setName] = useState<string>('Version Approved Auto-Turnover Cascade');
  const [description, setDescription] = useState<string>(
    'When supervisor approves version, automatically publish OpenEXR, notify producer, assemble delivery package and update project status.'
  );
  const [triggerEvent, setTriggerEvent] = useState<AutomationTriggerEventType>('version.approved');
  const [requiredRole, setRequiredRole] = useState<'Admin' | 'Supervisor' | 'Lead' | 'Artist' | 'Pipeline TD'>('Supervisor');
  const [isActive, setIsActive] = useState<boolean>(true);

  // Conditions list
  const [conditions, setConditions] = useState<AutomationConditionRule[]>([
    { id: 'c-1', field: 'status', operator: 'equals', value: 'Approved' },
    { id: 'c-2', field: 'validation_score', operator: 'greater_than', value: '90' },
  ]);

  // Actions chain
  const [actions, setActions] = useState<AutomationActionRule[]>([
    {
      id: 'a-1',
      type: 'publish_version',
      label: 'Publish to ACEScg Master Catalog',
      order: 1,
      parameters: { color_space: 'ACEScg', target: 'comp_exr' },
    },
    {
      id: 'a-2',
      type: 'notify_producer',
      label: 'Notify VFX Producer & Coordinators',
      order: 2,
      parameters: { channels: ['slack', 'in_app'], priority: 'high' },
    },
    {
      id: 'a-3',
      type: 'create_delivery',
      label: 'Create Client Aspera Turnover Package',
      order: 3,
      parameters: { protocol: 'Aspera', client: 'Warner Discovery' },
    },
    {
      id: 'a-4',
      type: 'update_project_status',
      label: 'Update Project Milestone to Client Review Ready',
      order: 4,
      parameters: { new_status: 'Client Review Ready' },
    },
  ]);

  const createRuleMutation = useCreateAutomationRule();

  if (!isOpen) return null;

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      {
        id: `c-${Date.now()}`,
        field: 'status',
        operator: 'equals',
        value: 'Ready',
      },
    ]);
  };

  const handleRemoveCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const handleAddAction = (actionType: AutomationActionType) => {
    const opt = actionOptions.find((a) => a.type === actionType);
    setActions([
      ...actions,
      {
        id: `a-${Date.now()}`,
        type: actionType,
        label: opt?.label || 'Execute Action',
        order: actions.length + 1,
        parameters: {},
      },
    ]);
  };

  const handleRemoveAction = (id: string) => {
    setActions(actions.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedTrigger = triggerOptions.find((t) => t.id === triggerEvent);

    await createRuleMutation.mutateAsync({
      workflow_id: workflowId,
      name,
      description,
      trigger: {
        event: triggerEvent,
        entity_type: selectedTrigger?.entity || 'Version',
      },
      conditions,
      actions,
      is_active: isActive,
      required_role: requiredRole,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Reusable Automation Rule Engine (Trigger → Condition → Action)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Permission-aware cascades and auditable event hooks.
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* Metadata */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">RULE NAME</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-medium focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">DESCRIPTION</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-normal focus:border-indigo-500 focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1">
                  REQUIRED PERMISSION ROLE (RBAC)
                </label>
                <select
                  value={requiredRole}
                  onChange={(e) => setRequiredRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Admin">Admin</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Lead">Lead</option>
                  <option value="Pipeline TD">Pipeline TD</option>
                  <option value="Artist">Artist</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 mt-4">
                <div>
                  <span className="text-white font-medium block">Active Automation</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Arm this trigger rule in active project queues
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Step 1: Trigger */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 font-mono uppercase flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px]">
                  1
                </span>
                EVENT TRIGGER
              </span>
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-[10px] mb-1">
                WHEN THIS EVENT OCCURS:
              </label>
              <select
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value as AutomationTriggerEventType)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                {triggerOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    [{opt.entity}] {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2: Conditions */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 font-mono uppercase flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                  2
                </span>
                CONDITIONAL FILTERING (ALL MUST MATCH)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCondition}
                className="gap-1 text-[10px]"
              >
                <Plus className="w-3 h-3" /> Add Condition
              </Button>
            </div>

            <div className="space-y-2">
              {conditions.map((cond, idx) => (
                <div key={cond.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <input
                      type="text"
                      value={cond.field}
                      onChange={(e) => {
                        const updated = [...conditions];
                        updated[idx].field = e.target.value;
                        setConditions(updated);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white font-mono"
                      placeholder="field"
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      value={cond.operator}
                      onChange={(e) => {
                        const updated = [...conditions];
                        updated[idx].operator = e.target.value as any;
                        setConditions(updated);
                      }}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white font-mono"
                    >
                      <option value="equals">equals</option>
                      <option value="not_equals">not equals</option>
                      <option value="greater_than">&gt; greater</option>
                      <option value="less_than">&lt; less</option>
                      <option value="contains">contains</option>
                    </select>
                  </div>
                  <div className="col-span-4">
                    <input
                      type="text"
                      value={cond.value}
                      onChange={(e) => {
                        const updated = [...conditions];
                        updated[idx].value = e.target.value;
                        setConditions(updated);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white font-mono"
                      placeholder="value"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(cond.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Cascading Actions */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-fuchsia-400 font-mono uppercase flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center text-[10px]">
                  3
                </span>
                CASCADING ACTION PIPELINE
              </span>
            </div>

            <div className="space-y-2">
              {actions.map((act, index) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                      0{index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-xs">{act.label}</strong>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-950 text-slate-400">
                          {act.type}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                        {JSON.stringify(act.parameters)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveAction(act.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add action dropdown */}
            <div className="pt-2 flex items-center gap-2">
              <select
                id="add-action-select"
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddAction(e.target.value as AutomationActionType);
                    e.target.value = '';
                  }
                }}
              >
                <option value="" disabled>
                  + Add Next Cascading Action...
                </option>
                {actionOptions.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    {opt.label} — ({opt.desc})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Save */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-mono">
              Action executions are cryptographically recorded to the production audit ledger.
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={createRuleMutation.isPending}
                className="gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
              >
                <Save className="w-3.5 h-3.5" />
                {createRuleMutation.isPending ? 'Arming Rule...' : 'Arm Automation Rule'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
