// Analytics API Services
import { ApiClient } from '@/api/client/ApiClient';
import {
    Dashboard,
    DashboardWidget,
    KPI,
    AnalyticsFilter,
    Report,
    ReportSchedule,
    ReportGeneration,
    PaginatedResponse,
    PageRequest,
    PlatformReportFormat,
    ExportRequest,
    ExportResponse,
} from '@/modules/platform/types';

export class AnalyticsService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    // Dashboards
    async getDashboards(params?: PageRequest & {
        is_favorited?: boolean;
        is_shared?: boolean;
        created_by?: string;
    }): Promise<PaginatedResponse<Dashboard>> {
        const response = await this.apiClient.get<PaginatedResponse<Dashboard>>('/platform/dashboards/', { params });
        return response;
    }

    async getDashboard(id: string): Promise<Dashboard> {
        const response = await this.apiClient.get<Dashboard>(`/platform/dashboards/${id}/`);
        return response;
    }

    async createDashboard(data: {
        name: string;
        description?: string;
        widgets?: DashboardWidget[];
        layout?: {
            rows: number;
            cols: number;
            grid: { widget_id: string; x: number; y: number; w: number; h: number }[];
        };
        filters?: AnalyticsFilter[];
        is_favorited?: boolean;
        is_shared?: boolean;
        shared_with?: string[];
    }): Promise<Dashboard> {
        const response = await this.apiClient.post<Dashboard>('/platform/dashboards/', data);
        return response;
    }

    async updateDashboard(id: string, data: Partial<Dashboard>): Promise<Dashboard> {
        const response = await this.apiClient.patch<Dashboard>(`/platform/dashboards/${id}/`, data);
        return response;
    }

    async duplicateDashboard(id: string): Promise<Dashboard> {
        const response = await this.apiClient.post<Dashboard>(`/platform/dashboards/${id}/duplicate/`);
        return response;
    }

    async archiveDashboard(id: string): Promise<Dashboard> {
        const response = await this.apiClient.post<Dashboard>(`/platform/dashboards/${id}/archive/`);
        return response;
    }

    async deleteDashboard(id: string): Promise<void> {
        await this.apiClient.delete(`/platform/dashboards/${id}/`);
    }

    async favoriteDashboard(id: string): Promise<Dashboard> {
        const response = await this.apiClient.post<Dashboard>(`/platform/dashboards/${id}/favorite/`);
        return response;
    }

    async unfavoriteDashboard(id: string): Promise<Dashboard> {
        const response = await this.apiClient.post<Dashboard>(`/platform/dashboards/${id}/unfavorite/`);
        return response;
    }

    async shareDashboard(id: string, data: { shared_with: string[] }): Promise<Dashboard> {
        const response = await this.apiClient.post<Dashboard>(`/platform/dashboards/${id}/share/`, data);
        return response;
    }

    // KPIs
    async getKPIs(params?: PageRequest & {
        is_active?: boolean;
        data_source?: string;
        metric?: string;
    }): Promise<PaginatedResponse<KPI>> {
        const response = await this.apiClient.get<PaginatedResponse<KPI>>('/platform/kpis/', { params });
        return response;
    }

    async getKPI(id: string): Promise<KPI> {
        const response = await this.apiClient.get<KPI>(`/platform/kpis/${id}/`);
        return response;
    }

    async createKPI(data: {
        name: string;
        description?: string;
        metric: string;
        data_source: string;
        aggregation: string;
        formula?: string;
        target?: number;
        thresholds?: { id: string; label: string; min?: number; max?: number; color: string }[];
        time_period: string;
        dimensions?: string[];
        filters?: AnalyticsFilter[];
        is_active?: boolean;
    }): Promise<KPI> {
        const response = await this.apiClient.post<KPI>('/platform/kpis/', data);
        return response;
    }

    async updateKPI(id: string, data: Partial<KPI>): Promise<KPI> {
        const response = await this.apiClient.patch<KPI>(`/platform/kpis/${id}/`, data);
        return response;
    }

    async duplicateKPI(id: string): Promise<KPI> {
        const response = await this.apiClient.post<KPI>(`/platform/kpis/${id}/duplicate/`);
        return response;
    }

    async activateKPI(id: string): Promise<KPI> {
        const response = await this.apiClient.post<KPI>(`/platform/kpis/${id}/activate/`);
        return response;
    }

    async deactivateKPI(id: string): Promise<KPI> {
        const response = await this.apiClient.post<KPI>(`/platform/kpis/${id}/deactivate/`);
        return response;
    }

    async deleteKPI(id: string): Promise<void> {
        await this.apiClient.delete(`/platform/kpis/${id}/`);
    }

    // Report Builder
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
        filters?: AnalyticsFilter[];
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

    // Analytics Export
    async exportAnalytics(data: ExportRequest): Promise<ExportResponse> {
        const response = await this.apiClient.post<ExportResponse>('/platform/analytics/export/', data);
        return response;
    }

    // Drill-down
    async getDrillDownData(
        kpiId: string,
        dimension: string,
        value: string,
        params?: PageRequest
    ): Promise<PaginatedResponse<unknown>> {
        const response = await this.apiClient.get<PaginatedResponse<unknown>>(
            `/platform/kpis/${kpiId}/drilldown/${dimension}/${value}/`,
            { params }
        );
        return response;
    }
}
