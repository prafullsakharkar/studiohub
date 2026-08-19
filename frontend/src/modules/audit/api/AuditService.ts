// Audit API Services
import { ApiClient } from '@/api/client/ApiClient';
import { AuditLog, AuditAction, AuditSeverity, ActivityItem, PaginatedResponse } from '@/modules/core/types';

export class AuditService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get audit logs with pagination
     */
    async getAuditLogs(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        ordering?: string;
        action?: AuditAction;
        severity?: AuditSeverity;
        resource_type?: string;
        resource_id?: string;
        organization?: string;
        start_date?: string;
        end_date?: string;
    }): Promise<PaginatedResponse<AuditLog>> {
        const response = await this.apiClient.get<PaginatedResponse<AuditLog>>('/audit/logs/', { params });
        return response;
    }

    /**
     * Get audit logs by organization
     */
    async getOrganizationAuditLogs(organizationId: string, params?: {
        page?: number;
        page_size?: number;
        search?: string;
        action?: AuditAction;
        severity?: AuditSeverity;
        start_date?: string;
        end_date?: string;
    }): Promise<PaginatedResponse<AuditLog>> {
        const response = await this.apiClient.get<PaginatedResponse<AuditLog>>(`/audit/organizations/${organizationId}/logs/`, { params });
        return response;
    }

    /**
     * Get audit logs by user
     */
    async getUserAuditLogs(userId: string, params?: {
        page?: number;
        page_size?: number;
        search?: string;
        action?: AuditAction;
        severity?: AuditSeverity;
        start_date?: string;
        end_date?: string;
    }): Promise<PaginatedResponse<AuditLog>> {
        const response = await this.apiClient.get<PaginatedResponse<AuditLog>>(`/audit/users/${userId}/logs/`, { params });
        return response;
    }

    /**
     * Get a single audit log by ID
     */
    async getAuditLog(id: string): Promise<AuditLog> {
        const response = await this.apiClient.get<AuditLog>(`/audit/logs/${id}/`);
        return response;
    }

    /**
     * Get activity timeline
     */
    async getActivityTimeline(params?: {
        page?: number;
        page_size?: number;
        resource_type?: string;
        resource_id?: string;
        organization?: string;
        start_date?: string;
        end_date?: string;
    }): Promise<PaginatedResponse<ActivityItem>> {
        const response = await this.apiClient.get<PaginatedResponse<ActivityItem>>('/audit/activity/', { params });
        return response;
    }

    /**
     * Get activity by resource
     */
    async getResourceActivity(resourceType: string, resourceId: string, params?: {
        page?: number;
        page_size?: number;
    }): Promise<PaginatedResponse<ActivityItem>> {
        const response = await this.apiClient.get<PaginatedResponse<ActivityItem>>(`/audit/resources/${resourceType}/${resourceId}/activity/`, { params });
        return response;
    }

    /**
     * Export audit logs
     */
    async exportAuditLogs(params?: {
        action?: AuditAction;
        severity?: AuditSeverity;
        resource_type?: string;
        organization?: string;
        start_date?: string;
        end_date?: string;
    }): Promise<{ download_url: string }> {
        const response = await this.apiClient.post<{ download_url: string }>('/audit/logs/export/', { params });
        return response;
    }

    /**
     * Get audit summary
     */
    async getAuditSummary(params?: {
        organization?: string;
        start_date?: string;
        end_date?: string;
    }): Promise<{
        total_logs: number;
        by_action: Record<AuditAction, number>;
        by_severity: Record<AuditSeverity, number>;
        by_resource_type: Record<string, number>;
        recent_logs: AuditLog[];
    }> {
        const response = await this.apiClient.get<{
            total_logs: number;
            by_action: Record<AuditAction, number>;
            by_severity: Record<AuditSeverity, number>;
            by_resource_type: Record<string, number>;
            recent_logs: AuditLog[];
        }>('/audit/summary/', { params });
        return response;
    }

    /**
     * Get security events
     */
    async getSecurityEvents(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        severity?: AuditSeverity;
        start_date?: string;
        end_date?: string;
    }): Promise<PaginatedResponse<AuditLog>> {
        const response = await this.apiClient.get<PaginatedResponse<AuditLog>>('/audit/security-events/', { params });
        return response;
    }

    /**
     * Get failed login attempts
     */
    async getFailedLoginAttempts(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        start_date?: string;
        end_date?: string;
    }): Promise<PaginatedResponse<AuditLog>> {
        const response = await this.apiClient.get<PaginatedResponse<AuditLog>>('/audit/failed-logins/', { params });
        return response;
    }
}

export const auditService = new AuditService();
