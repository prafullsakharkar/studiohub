import { apiClient } from '@/api/client/ApiClient';
import {
  Workflow,
  AutomationRule,
  AutomationAuditLog,
  WorkflowDryRunResult,
} from '@/types/workflow';
import { PaginatedResponse, QueryParams } from '@/types/drf';
import { workflowRepository } from '../repositories/WorkflowRepository';

export class WorkflowService {
  static async listWorkflows(params?: QueryParams): Promise<PaginatedResponse<Workflow>> {
    return workflowRepository.findAll(params);
  }

  static async getWorkflow(id: string): Promise<Workflow> {
    return workflowRepository.findById(id);
  }

  static async createWorkflow(data: Partial<Workflow>): Promise<Workflow> {
    return workflowRepository.create(data);
  }

  static async updateWorkflow(id: string, data: Partial<Workflow>): Promise<Workflow> {
    return workflowRepository.patch(id, data);
  }

  static async deleteWorkflow(id: string): Promise<void> {
    return workflowRepository.delete(id);
  }

  static async cloneWorkflow(id: string): Promise<Workflow> {
    return apiClient.post<Workflow>(`/api/v1/workflows/${id}/clone/`, {});
  }

  static async activateWorkflow(id: string): Promise<Workflow> {
    return apiClient.post<Workflow>(`/api/v1/workflows/${id}/activate/`, {});
  }

  static async deactivateWorkflow(id: string): Promise<Workflow> {
    return apiClient.post<Workflow>(`/api/v1/workflows/${id}/deactivate/`, {});
  }

  static async archiveWorkflow(id: string): Promise<Workflow> {
    return apiClient.post<Workflow>(`/api/v1/workflows/${id}/archive/`, {});
  }

  static async simulateWorkflow(
    id: string,
    payload: { entity_type: string; entity_code: string; trigger_event: string }
  ): Promise<WorkflowDryRunResult> {
    return apiClient.post<WorkflowDryRunResult>(`/api/v1/workflows/${id}/simulate/`, payload);
  }

  // Automation Rules
  static async listAutomationRules(): Promise<AutomationRule[]> {
    return apiClient.get<AutomationRule[]>('/api/v1/automations/rules/');
  }

  static async createAutomationRule(rule: Partial<AutomationRule>): Promise<AutomationRule> {
    return apiClient.post<AutomationRule>('/api/v1/automations/rules/', rule);
  }

  static async updateAutomationRule(id: string, rule: Partial<AutomationRule>): Promise<AutomationRule> {
    return apiClient.patch<AutomationRule>(`/api/v1/automations/rules/${id}/`, rule);
  }

  static async deleteAutomationRule(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/automations/rules/${id}/`);
  }

  // Audit Logs
  static async listAutomationAuditLogs(): Promise<AutomationAuditLog[]> {
    return apiClient.get<AutomationAuditLog[]>('/api/v1/automations/audit-logs/');
  }
}
