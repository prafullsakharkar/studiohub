// Reports API Services
import { ApiClient } from '@/api/client/ApiClient';
import {
    Report,
    ReportSchedule,
    ReportGeneration,
    PaginatedResponse,
    PageRequest,
    PlatformReportFormat,
    ExportRequest,
    ExportResponse,
} from '@/modules/platform/types';

export class ReportsService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    // Report Catalog
    async getReports(params?: PageRequest & {
        report_type?: string;
        module?: string;
        owner?: string;
        status?: string;
        date_from?: string;
        date_to?: string;
        scheduled?: boolean;
        manual?: boolean;
    }): Promise<PaginatedResponse<Report>> {
        const response = await this.apiClient.get<PaginatedResponse<Report>>('/platform/reports/', { params });
        return response;
    }

    async getReport(id: string): Promise<Report> {
        const response = await this.apiClient.get<Report>(`/platform/reports/${id}/`);
        return response;
    }

    async createReport(data: {
        name: string;
        description?: string;
        data_source: string;
        fields?: { id: string; name: string; label: string; type: string; visible: boolean }[];
        filters?: { id: string; type: string; label: string; field: string; value: unknown; operator?: string }[];
        sorting?: { field: string; direction: 'asc' | 'desc' }[];
        grouping?: string[];
        aggregation?: string;
        calculated_fields?: { id: string; name: string; formula: string; type: string }[];
        parameters?: { id: string; name: string; label: string; type: string; required: boolean; default_value?: unknown }[];
        date_ranges?: { id: string; name: string; start_field: string; end_field: string }[];
        template?: string;
    }): Promise<Report> {
        const response = await this.apiClient.post<Report>('/platform/reports/', data);
        return response;
    }

    async updateReport(id: string, data: Partial<Report>): Promise<Report> {
        const response = await this.apiClient.patch<Report>(`/platform/reports/${id}/`, data);
        return response;
    }

    async duplicateReport(id: string): Promise<Report> {
        const response = await this.apiClient.post<Report>(`/platform/reports/${id}/duplicate/`);
        return response;
    }

    async archiveReport(id: string): Promise<Report> {
        const response = await this.apiClient.post<Report>(`/platform/reports/${id}/archive/`);
        return response;
    }

    async deleteReport(id: string): Promise<void> {
        await this.apiClient.delete(`/platform/reports/${id}/`);
    }

    // Report Generation
    async generateReport(id: string, data?: {
        parameters?: Record<string, unknown>;
        format?: PlatformReportFormat;
    }): Promise<{ success: boolean; generation_id: string }> {
        const response = await this.apiClient.post<{ success: boolean; generation_id: string }>(
            `/platform/reports/${id}/generate/`,
            data
        );
        return response;
    }

    async getReportGeneration(generationId: string): Promise<ReportGeneration> {
        const response = await this.apiClient.get<ReportGeneration>(`/platform/report-generations/${generationId}/`);
        return response;
    }

    async cancelReportGeneration(generationId: string): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(
            `/platform/report-generations/${generationId}/cancel/`
        );
        return response;
    }

    async retryReportGeneration(generationId: string): Promise<{ success: boolean; generation_id: string }> {
        const response = await this.apiClient.post<{ success: boolean; generation_id: string }>(
            `/platform/report-generations/${generationId}/retry/`
        );
        return response;
    }

    // Report Output
    async downloadReport(generationId: string, format: PlatformReportFormat): Promise<Blob> {
        const response = await this.apiClient.download(`/platform/report-generations/${generationId}/download/${format}/`);
        return response;
    }

    async shareReport(generationId: string, data: { recipients: string[]; message?: string }): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(
            `/platform/report-generations/${generationId}/share/`,
            data
        );
        return response;
    }

    // Scheduled Reports
    async getSchedules(params?: PageRequest & {
        is_active?: boolean;
        report_id?: string;
    }): Promise<PaginatedResponse<ReportSchedule>> {
        const response = await this.apiClient.get<PaginatedResponse<ReportSchedule>>('/platform/report-schedules/', { params });
        return response;
    }

    async getSchedule(id: string): Promise<ReportSchedule> {
        const response = await this.apiClient.get<ReportSchedule>(`/platform/report-schedules/${id}/`);
        return response;
    }

    async createSchedule(data: {
        report_id: string;
        schedule_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
        cron_expression?: string;
        timezone: string;
        recipients: string[];
        delivery_channel: 'EMAIL' | 'WEBHOOK' | 'STORAGE';
        parameters?: Record<string, unknown>;
        is_active?: boolean;
    }): Promise<ReportSchedule> {
        const response = await this.apiClient.post<ReportSchedule>('/platform/report-schedules/', data);
        return response;
    }

    async updateSchedule(id: string, data: Partial<ReportSchedule>): Promise<ReportSchedule> {
        const response = await this.apiClient.patch<ReportSchedule>(`/platform/report-schedules/${id}/`, data);
        return response;
    }

    async activateSchedule(id: string): Promise<ReportSchedule> {
        const response = await this.apiClient.post<ReportSchedule>(`/platform/report-schedules/${id}/activate/`);
        return response;
    }

    async deactivateSchedule(id: string): Promise<ReportSchedule> {
        const response = await this.apiClient.post<ReportSchedule>(`/platform/report-schedules/${id}/deactivate/`);
        return response;
    }

    async deleteSchedule(id: string): Promise<void> {
        await this.apiClient.delete(`/platform/report-schedules/${id}/`);
    }

    // Report History
    async getReportHistory(params?: PageRequest & {
        report_id?: string;
        status?: string;
        generated_by?: string;
        date_from?: string;
        date_to?: string;
    }): Promise<PaginatedResponse<ReportGeneration>> {
        const response = await this.apiClient.get<PaginatedResponse<ReportGeneration>>('/platform/report-history/', { params });
        return response;
    }

    // Report Builder
    async validateReportConfiguration(id: string, data: Partial<Report>): Promise<{ valid: boolean; errors?: Record<string, string[]> }> {
        const response = await this.apiClient.post<{ valid: boolean; errors?: Record<string, string[]> }>(
            `/platform/reports/${id}/validate/`,
            data
        );
        return response;
    }

    async previewReport(id: string, data?: {
        parameters?: Record<string, unknown>;
        limit?: number;
    }): Promise<{ preview_data: unknown[]; total_count: number }> {
        const response = await this.apiClient.post<{ preview_data: unknown[]; total_count: number }>(
            `/platform/reports/${id}/preview/`,
            data
        );
        return response;
    }
}
