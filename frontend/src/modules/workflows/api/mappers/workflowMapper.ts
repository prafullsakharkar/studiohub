import { Workflow, WorkflowNode, WorkflowTransition, WorkflowNodeType } from '@/types/workflow';

const NODE_TITLE: Record<string, string> = {
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

/**
 * The backend stores sparse DAG JSON (nodes without positions, transitions as
 * {from,to}). Normalize into the richer frontend shape the canvas requires so
 * it can render without reading undefined fields.
 */
export function normalizeWorkflow(workflow: Workflow): Workflow {
  if (!workflow) return workflow;

  const rawNodes: any[] = Array.isArray((workflow as any).nodes) ? (workflow as any).nodes : [];
  const rawTransitions: any[] = Array.isArray((workflow as any).transitions)
    ? (workflow as any).transitions
    : [];

  const nodes: WorkflowNode[] = rawNodes.map((n, index) => {
    const type = (n.type || 'task') as WorkflowNodeType;
    return {
      id: n.id || `node-${index}`,
      workflow_id: workflow.id,
      type,
      title: n.title || NODE_TITLE[type] || 'Step',
      description: n.description,
      department: n.department,
      config: typeof n.config === 'object' && n.config ? n.config : {},
      position:
        typeof n.position === 'object' && n.position && typeof n.position.x === 'number'
          ? { x: n.position.x, y: n.position.y }
          : { x: 60 + index * 340, y: 120 },
      validation_errors: n.validation_errors,
    };
  });

  const transitions: WorkflowTransition[] = rawTransitions.map((t, index) => {
    const source_node_id = t.source_node_id ?? t.from ?? t.source;
    const target_node_id = t.target_node_id ?? t.to ?? t.target;
    return {
      id: t.id || `tr-${index}`,
      source_node_id,
      target_node_id,
      source_port: t.source_port,
      target_port: t.target_port,
      label: t.label,
      condition: t.condition,
      trigger_event: t.trigger_event,
      is_default: t.is_default,
    };
  });

  return { ...workflow, nodes, transitions };
}

export function normalizeWorkflows(list: Workflow[]): Workflow[] {
  return Array.isArray(list) ? list.map(normalizeWorkflow) : [];
}
