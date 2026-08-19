// Reports Hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReportsService } from '@/modules/platform/api/ReportsService';
import {
    Report,
    ReportSchedule,
    ReportGeneration,
    PaginatedResponse,
    PageRequest,
    PlatformReportFormat,
} from '@/modules/platform/types';

const reportsService = new ReportsService();

// Query keys
export const reportsQueryKeys = {
    all: ['platform', 'reports'] as const,
    catalog: (params?: PageRequest & { status?: string; report_type?: string }) =>
        [...reportsQueryKeys.all, 'catalog', params] as const,
    report: (id: string) => [...reportsQueryKeys.all, 'report', id] as const,
    schedules: (params?: PageRequest & { is_active?: boolean; report_id?: string }) =>
        [...reportsQueryKeys.all, 'schedules', params] as const,
    schedule: (id: string) => [...reportsQueryKeys.all, 'schedules', id] as const,
    generations: (params?: PageRequest & { report_id?: string; status?: string }) =>
        [...reportsQueryKeys.all, 'generations', params] as const,
    generation: (id: string) => [...reportsQueryKeys.all, 'generations', id] as const,
    history: (params?: PageRequest & { report_id?: string; status?: string }) =>
        [...reportsQueryKeys.all, 'history', params] as const,
};

// Report catalog hooks
export const useReportCatalog = (params?: PageRequest & {
    status?: string;
    report_type?: string;
}) => {
    return useQuery({
        queryKey: reportsQueryKeys.catalog(params),
        queryFn: () => reportsService.getReports(params),
    });
};

export const useReport = (id: string) => {
    return useQuery({
        queryKey: reportsQueryKeys.report(id),
        queryFn: () => reportsService.getReport(id),
        enabled: !!id,
    });
};

export const useCreateReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof reportsService.createReport>[0]) =>
            reportsService.createReport(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.catalog() });
        },
    });
};

export const useUpdateReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Report> }) =>
            reportsService.updateReport(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.report(variables.id) });
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.catalog() });
        },
    });
};

export const useDeleteReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => reportsService.deleteReport(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.catalog() });
        },
    });
};

export const useGenerateReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data?: { parameters?: Record<string, unknown>; format?: PlatformReportFormat } }) =>
            reportsService.generateReport(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.report(variables.id) });
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.catalog() });
        },
    });
};

export const useDownloadReport = () => {
    return useMutation({
        mutationFn: ({ generationId, format }: { generationId: string; format: PlatformReportFormat }) =>
            reportsService.downloadReport(generationId, format),
    });
};

// Schedule hooks
export const useReportSchedules = (params?: PageRequest & {
    is_active?: boolean;
    report_id?: string;
}) => {
    return useQuery({
        queryKey: reportsQueryKeys.schedules(params),
        queryFn: () => reportsService.getSchedules(params),
    });
};

export const useReportSchedule = (id: string) => {
    return useQuery({
        queryKey: reportsQueryKeys.schedule(id),
        queryFn: () => reportsService.getSchedule(id),
        enabled: !!id,
    });
};

export const useCreateReportSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof reportsService.createSchedule>[0]) =>
            reportsService.createSchedule(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.schedules() });
        },
    });
};

export const useUpdateReportSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<ReportSchedule> }) =>
            reportsService.updateSchedule(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.schedule(variables.id) });
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.schedules() });
        },
    });
};

export const useDeleteReportSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => reportsService.deleteSchedule(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.schedules() });
        },
    });
};

export const useActivateReportSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => reportsService.activateSchedule(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.schedule(id) });
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.schedules() });
        },
    });
};

export const useDeactivateReportSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => reportsService.deactivateSchedule(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.schedule(id) });
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.schedules() });
        },
    });
};

// Generation hooks
export const useReportGenerations = (params?: PageRequest & {
    report_id?: string;
    status?: string;
}) => {
    return useQuery({
        queryKey: reportsQueryKeys.generations(params),
        queryFn: () => reportsService.getReportHistory(params),
    });
};

export const useReportGeneration = (id: string) => {
    return useQuery({
        queryKey: reportsQueryKeys.generation(id),
        queryFn: () => reportsService.getReportGeneration(id),
        enabled: !!id,
    });
};

export const useCancelReportGeneration = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => reportsService.cancelReportGeneration(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.generation(id) });
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.generations() });
        },
    });
};

export const useRetryReportGeneration = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => reportsService.retryReportGeneration(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.generation(id) });
            queryClient.invalidateQueries({ queryKey: reportsQueryKeys.generations() });
        },
    });
};

// History hooks
export const useReportHistory = (params?: PageRequest & {
    report_id?: string;
    status?: string;
}) => {
    return useQuery({
        queryKey: reportsQueryKeys.history(params),
        queryFn: () => reportsService.getReportHistory(params),
    });
};
