import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkflowService } from '../services/WorkflowService';
import {
  Workflow,
  AutomationRule,
} from '@/types/workflow';
import { QueryParams } from '@/types/drf';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export const WORKFLOW_QUERY_KEYS = {
  all: ['workflows'] as const,
  lists: () => [...WORKFLOW_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...WORKFLOW_QUERY_KEYS.lists(), params] as const,
  details: () => [...WORKFLOW_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...WORKFLOW_QUERY_KEYS.details(), id] as const,
  automations: ['automations', 'rules'] as const,
  auditLogs: ['automations', 'audit-logs'] as const,
};

export const useWorkflows = (params?: QueryParams) => {
  return useQuery({
    queryKey: WORKFLOW_QUERY_KEYS.list(params),
    queryFn: () => WorkflowService.listWorkflows(params),
  });
};

export const useWorkflowDetail = (id: string | undefined) => {
  return useQuery({
    queryKey: id ? WORKFLOW_QUERY_KEYS.detail(id) : ['workflows', 'null'],
    queryFn: () => (id ? WorkflowService.getWorkflow(id) : null),
    enabled: !!id,
  });
};

export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (data: Partial<Workflow>) => WorkflowService.createWorkflow(data),
    onSuccess: (newWf) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Workflow Created',
        message: `Workflow "${newWf.name}" (${newWf.code}) successfully created.`,
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        title: 'Creation Failed',
        message: err?.message || 'Could not create workflow.',
      });
    },
  });
};

export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Workflow> }) =>
      WorkflowService.updateWorkflow(id, data),
    onSuccess: (updatedWf) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.detail(updatedWf.id) });
      addNotification({
        type: 'success',
        title: 'Workflow Saved',
        message: `Workflow DAG configuration for "${updatedWf.name}" saved.`,
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: err?.message || 'Could not update workflow.',
      });
    },
  });
};

export const useCloneWorkflow = () => {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (id: string) => WorkflowService.cloneWorkflow(id),
    onSuccess: (cloned) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Workflow Cloned',
        message: `Cloned into new workflow "${cloned.name}" (${cloned.code}).`,
      });
    },
  });
};

export const useActivateWorkflow = () => {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (id: string) => WorkflowService.activateWorkflow(id),
    onSuccess: (wf) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Workflow Activated',
        message: `Workflow "${wf.name}" is now active in production pipelines.`,
      });
    },
  });
};

export const useDeactivateWorkflow = () => {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (id: string) => WorkflowService.deactivateWorkflow(id),
    onSuccess: (wf) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Workflow Deactivated',
        message: `Workflow "${wf.name}" has been paused.`,
      });
    },
  });
};

export const useArchiveWorkflow = () => {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (id: string) => WorkflowService.archiveWorkflow(id),
    onSuccess: (wf) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.all });
      addNotification({
        type: 'warning',
        title: 'Workflow Archived',
        message: `Workflow "${wf.name}" moved to archives.`,
      });
    },
  });
};

export const useSimulateWorkflow = () => {
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { entity_type: string; entity_code: string; trigger_event: string };
    }) => WorkflowService.simulateWorkflow(id, payload),
    onSuccess: (result) => {
      addNotification({
        type: 'success',
        title: 'Simulation Complete',
        message: `Dry-run completed with 0 errors across ${result.steps.length} nodes in ${result.total_duration_ms}ms.`,
      });
    },
  });
};

export const useAutomationRules = () => {
  return useQuery({
    queryKey: WORKFLOW_QUERY_KEYS.automations,
    queryFn: () => WorkflowService.listAutomationRules(),
  });
};

export const useCreateAutomationRule = () => {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (rule: Partial<AutomationRule>) => WorkflowService.createAutomationRule(rule),
    onSuccess: (newRule) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.automations });
      addNotification({
        type: 'success',
        title: 'Automation Rule Created',
        message: `Automation "${newRule.name}" is now armed.`,
      });
    },
  });
};

export const useAutomationAuditLogs = () => {
  return useQuery({
    queryKey: WORKFLOW_QUERY_KEYS.auditLogs,
    queryFn: () => WorkflowService.listAutomationAuditLogs(),
  });
};
