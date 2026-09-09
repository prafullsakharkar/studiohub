// Analytics Hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnalyticsService } from '@/modules/platform/api/AnalyticsService';
import {
    Dashboard,
    KPI,
    Report,
    ReportSchedule,
    ReportGeneration,
    PaginatedResponse,
    PageRequest,
    PlatformEventType,
    PlatformReportFormat,
} from '@/modules/platform/types';

const analyticsService = new AnalyticsService();

// Query keys
export const analyticsQueryKeys = {
    all: ['platform', 'analytics'] as const,
    dashboards: (params?: PageRequest & { is_favorited?: boolean; is_shared?: boolean }) =>
        [...analyticsQueryKeys.all, 'dashboards', params] as const,
    dashboard: (id: string) => [...analyticsQueryKeys.all, 'dashboard', id] as const,
    kpis: (params?: PageRequest & { is_active?: boolean; data_source?: string; metric?: string }) =>
        [...analyticsQueryKeys.all, 'kpis', params] as const,
    kpi: (id: string) => [...analyticsQueryKeys.all, 'kpis', id] as const,
    reports: (params?: PageRequest & { status?: string; report_type?: string }) =>
        [...analyticsQueryKeys.all, 'reports', params] as const,
    report: (id: string) => [...analyticsQueryKeys.all, 'report', id] as const,
    schedules: (params?: PageRequest & { is_active?: boolean; report_id?: string }) =>
        [...analyticsQueryKeys.all, 'schedules', params] as const,
    schedule: (id: string) => [...analyticsQueryKeys.all, 'schedules', id] as const,
    generations: (params?: PageRequest & { report_id?: string; status?: string }) =>
        [...analyticsQueryKeys.all, 'generations', params] as const,
    generation: (id: string) => [...analyticsQueryKeys.all, 'generations', id] as const,
};

// Dashboard hooks
export const useDashboards = (params?: PageRequest & {
    is_favorited?: boolean;
    is_shared?: boolean;
}) => {
    return useQuery({
        queryKey: analyticsQueryKeys.dashboards(params),
        queryFn: () => analyticsService.getDashboards(params),
    });
};

export const useDashboard = (id: string) => {
    return useQuery({
        queryKey: analyticsQueryKeys.dashboard(id),
        queryFn: () => analyticsService.getDashboard(id),
        enabled: !!id,
    });
};

export const useCreateDashboard = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof analyticsService.createDashboard>[0]) =>
            analyticsService.createDashboard(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.dashboards() });
        },
    });
};

export const useUpdateDashboard = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Dashboard> }) =>
            analyticsService.updateDashboard(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.dashboard(variables.id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.dashboards() });
        },
    });
};

export const useDeleteDashboard = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => analyticsService.deleteDashboard(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.dashboards() });
        },
    });
};

export const useFavoriteDashboard = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => analyticsService.favoriteDashboard(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.dashboard(id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.dashboards() });
        },
    });
};

export const useUnfavoriteDashboard = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => analyticsService.unfavoriteDashboard(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.dashboard(id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.dashboards() });
        },
    });
};

export const useShareDashboard = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { shared_with: string[] } }) =>
            analyticsService.shareDashboard(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.dashboard(variables.id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.dashboards() });
        },
    });
};

// KPI hooks
export const useKPIs = (params?: PageRequest & {
    is_active?: boolean;
    data_source?: string;
    metric?: string;
}) => {
    return useQuery({
        queryKey: analyticsQueryKeys.kpis(params),
        queryFn: () => analyticsService.getKPIs(params),
    });
};

export const useKPI = (id: string) => {
    return useQuery({
        queryKey: analyticsQueryKeys.kpi(id),
        queryFn: () => analyticsService.getKPI(id),
        enabled: !!id,
    });
};

export const useCreateKPI = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof analyticsService.createKPI>[0]) =>
            analyticsService.createKPI(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.kpis() });
        },
    });
};

export const useUpdateKPI = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<KPI> }) =>
            analyticsService.updateKPI(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.kpi(variables.id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.kpis() });
        },
    });
};

export const useDeleteKPI = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => analyticsService.deleteKPI(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.kpis() });
        },
    });
};

// Report hooks
export const useReports = (params?: PageRequest & {
    status?: string;
    report_type?: string;
}) => {
    return useQuery({
        queryKey: analyticsQueryKeys.reports(params),
        queryFn: () => analyticsService.getReports(params),
    });
};

export const useReport = (id: string) => {
    return useQuery({
        queryKey: analyticsQueryKeys.report(id),
        queryFn: () => analyticsService.getReport(id),
        enabled: !!id,
    });
};

export const useCreateReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof analyticsService.createReport>[0]) =>
            analyticsService.createReport(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.reports() });
        },
    });
};

export const useUpdateReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Report> }) =>
            analyticsService.updateReport(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.report(variables.id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.reports() });
        },
    });
};

export const useDeleteReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => analyticsService.deleteReport(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.reports() });
        },
    });
};

export const useGenerateReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data?: { parameters?: Record<string, unknown>; format?: PlatformReportFormat } }) =>
            analyticsService.generateReport(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.report(variables.id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.reports() });
        },
    });
};

export const useDownloadReport = () => {
    return useMutation({
        mutationFn: ({ generationId, format }: { generationId: string; format: string }) =>
            analyticsService.downloadReport(generationId, format as 'PDF' | 'CSV' | 'JSON'),
    });
};

// Schedule hooks
export const useReportSchedules = (params?: PageRequest & {
    is_active?: boolean;
    report_id?: string;
}) => {
    return useQuery({
        queryKey: analyticsQueryKeys.schedules(params),
        queryFn: () => analyticsService.getSchedules(params),
    });
};

export const useReportSchedule = (id: string) => {
    return useQuery({
        queryKey: analyticsQueryKeys.schedule(id),
        queryFn: () => analyticsService.getSchedule(id),
        enabled: !!id,
    });
};

export const useCreateReportSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof analyticsService.createSchedule>[0]) =>
            analyticsService.createSchedule(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.schedules() });
        },
    });
};

export const useUpdateReportSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<ReportSchedule> }) =>
            analyticsService.updateSchedule(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.schedule(variables.id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.schedules() });
        },
    });
};

export const useDeleteReportSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => analyticsService.deleteSchedule(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.schedules() });
        },
    });
};

export const useActivateReportSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => analyticsService.activateSchedule(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.schedule(id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.schedules() });
        },
    });
};

export const useDeactivateReportSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => analyticsService.deactivateSchedule(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.schedule(id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.schedules() });
        },
    });
};

// Generation hooks
export const useReportGenerations = (params?: PageRequest & {
    report_id?: string;
    status?: string;
}) => {
    return useQuery({
        queryKey: analyticsQueryKeys.generations(params),
        queryFn: () => analyticsService.getReportHistory(params),
    });
};

export const useReportGeneration = (id: string) => {
    return useQuery({
        queryKey: analyticsQueryKeys.generation(id),
        queryFn: () => analyticsService.getReportGeneration(id),
        enabled: !!id,
    });
};

export const useCancelReportGeneration = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => analyticsService.cancelReportGeneration(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.generation(id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.generations() });
        },
    });
};

export const useRetryReportGeneration = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => analyticsService.retryReportGeneration(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.generation(id) });
            queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.generations() });
        },
    });
};
