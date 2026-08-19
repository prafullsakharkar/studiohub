// Billing Hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BillingService } from '@/modules/platform/api/BillingService';
import {
    Subscription,
    Plan,
    Invoice,
    Payment,
    Usage,
    PaginatedResponse,
    PageRequest,
    PlatformBillingInterval,
} from '@/modules/platform/types';

const billingService = new BillingService();

// Query keys
export const billingQueryKeys = {
    all: ['platform', 'billing'] as const,
    subscription: () => [...billingQueryKeys.all, 'subscription'] as const,
    plans: (params?: PageRequest & { is_active?: boolean; billing_interval?: PlatformBillingInterval }) =>
        [...billingQueryKeys.all, 'plans', params] as const,
    plan: (id: string) => [...billingQueryKeys.all, 'plan', id] as const,
    invoices: (params?: PageRequest & { status?: string; date_from?: string; date_to?: string }) =>
        [...billingQueryKeys.all, 'invoices', params] as const,
    invoice: (id: string) => [...billingQueryKeys.all, 'invoice', id] as const,
    payments: (params?: PageRequest & { status?: string }) =>
        [...billingQueryKeys.all, 'payments', params] as const,
    payment: (id: string) => [...billingQueryKeys.all, 'payment', id] as const,
    usage: (params?: PageRequest & { resource?: string; date_from?: string; date_to?: string }) =>
        [...billingQueryKeys.all, 'usage', params] as const,
    resourceUsage: (resource: string, params?: { date_from?: string; date_to?: string }) =>
        [...billingQueryKeys.all, 'resource-usage', resource, params] as const,
    featureFlags: () => [...billingQueryKeys.all, 'feature-flags'] as const,
};

// Subscription hooks
export const useSubscription = () => {
    return useQuery({
        queryKey: billingQueryKeys.subscription(),
        queryFn: () => billingService.getSubscription(),
    });
};

export const useUpgradeSubscription = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (planId: string) => billingService.upgradeSubscription(planId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
        },
    });
};

export const useDowngradeSubscription = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (planId: string) => billingService.downgradeSubscription(planId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
        },
    });
};

export const useChangeSubscriptionPlan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (planId: string) => billingService.changeSubscriptionPlan(planId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
        },
    });
};

export const useCancelSubscription = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => billingService.cancelSubscription(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
        },
    });
};

export const useReactivateSubscription = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => billingService.reactivateSubscription(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
        },
    });
};

// Plan hooks
export const usePlans = (params?: PageRequest & {
    is_active?: boolean;
    billing_interval?: PlatformBillingInterval;
}) => {
    return useQuery({
        queryKey: billingQueryKeys.plans(params),
        queryFn: () => billingService.getPlans(params),
    });
};

export const usePlan = (id: string) => {
    return useQuery({
        queryKey: billingQueryKeys.plan(id),
        queryFn: () => billingService.getPlan(id),
        enabled: !!id,
    });
};

export const useCreatePlan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof billingService.createPlan>[0]) =>
            billingService.createPlan(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.plans() });
        },
    });
};

export const useUpdatePlan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Plan> }) =>
            billingService.updatePlan(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.plan(variables.id) });
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.plans() });
        },
    });
};

export const useDeletePlan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => billingService.deletePlan(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.plans() });
        },
    });
};

// Invoice hooks
export const useInvoices = (params?: PageRequest & {
    status?: string;
    date_from?: string;
    date_to?: string;
}) => {
    return useQuery({
        queryKey: billingQueryKeys.invoices(params),
        queryFn: () => billingService.getInvoices(params),
    });
};

export const useInvoice = (id: string) => {
    return useQuery({
        queryKey: billingQueryKeys.invoice(id),
        queryFn: () => billingService.getInvoice(id),
        enabled: !!id,
    });
};

export const useDownloadInvoice = () => {
    return useMutation({
        mutationFn: (id: string) => billingService.downloadInvoice(id),
    });
};

// Payment hooks
export const usePayments = (params?: PageRequest & {
    status?: string;
}) => {
    return useQuery({
        queryKey: billingQueryKeys.payments(params),
        queryFn: () => billingService.getPaymentHistory(params),
    });
};

export const usePayment = (id: string) => {
    return useQuery({
        queryKey: billingQueryKeys.payment(id),
        queryFn: () => billingService.getPayment(id),
        enabled: !!id,
    });
};

export const useRetryPayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => billingService.retryPayment(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.payment(id) });
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.payments() });
        },
    });
};

export const useRefundPayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, amount }: { id: string; amount?: number }) =>
            billingService.refundPayment(id, amount),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.payment(variables.id) });
            queryClient.invalidateQueries({ queryKey: billingQueryKeys.payments() });
        },
    });
};

// Usage hooks
export const useUsage = (params?: PageRequest & {
    resource?: string;
    date_from?: string;
    date_to?: string;
}) => {
    return useQuery({
        queryKey: billingQueryKeys.usage(params),
        queryFn: () => billingService.getUsage(params),
    });
};

export const useResourceUsage = (resource: string, params?: { date_from?: string; date_to?: string }) => {
    return useQuery({
        queryKey: billingQueryKeys.resourceUsage(resource, params),
        queryFn: () => billingService.getResourceUsage(resource, params),
        enabled: !!resource,
    });
};

// Feature flags hooks
export const useFeatureFlags = () => {
    return useQuery({
        queryKey: billingQueryKeys.featureFlags(),
        queryFn: () => billingService.getBillingFeatureFlags(),
    });
};
