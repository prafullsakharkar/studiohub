// Billing API Services
import { ApiClient } from '@/api/client/ApiClient';
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

export class BillingService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    // Subscription
    async getSubscription(): Promise<Subscription> {
        const response = await this.apiClient.get<Subscription>('/platform/billing/subscription/');
        return response;
    }

    async upgradeSubscription(planId: string): Promise<Subscription> {
        const response = await this.apiClient.post<Subscription>(
            '/platform/billing/subscription/upgrade/',
            { plan_id: planId }
        );
        return response;
    }

    async downgradeSubscription(planId: string): Promise<Subscription> {
        const response = await this.apiClient.post<Subscription>(
            '/platform/billing/subscription/downgrade/',
            { plan_id: planId }
        );
        return response;
    }

    async changeSubscriptionPlan(planId: string): Promise<Subscription> {
        const response = await this.apiClient.post<Subscription>(
            '/platform/billing/subscription/change-plan/',
            { plan_id: planId }
        );
        return response;
    }

    async cancelSubscription(): Promise<{ success: boolean; message: string }> {
        const response = await this.apiClient.post<{ success: boolean; message: string }>(
            '/platform/billing/subscription/cancel/'
        );
        return response;
    }

    async reactivateSubscription(): Promise<Subscription> {
        const response = await this.apiClient.post<Subscription>(
            '/platform/billing/subscription/reactivate/'
        );
        return response;
    }

    // Plans
    async getPlans(params?: PageRequest & {
        is_active?: boolean;
        is_default?: boolean;
        billing_interval?: PlatformBillingInterval;
    }): Promise<PaginatedResponse<Plan>> {
        const response = await this.apiClient.get<PaginatedResponse<Plan>>('/platform/billing/plans/', { params });
        return response;
    }

    async getPlan(id: string): Promise<Plan> {
        const response = await this.apiClient.get<Plan>(`/platform/billing/plans/${id}/`);
        return response;
    }

    async createPlan(data: {
        name: string;
        description?: string;
        price: number;
        currency: string;
        billing_interval: PlatformBillingInterval;
        features?: string[];
        usage_limits?: Record<string, number>;
        user_limits?: number;
        storage_limits?: number;
        module_availability?: string[];
        is_active?: boolean;
        is_default?: boolean;
    }): Promise<Plan> {
        const response = await this.apiClient.post<Plan>('/platform/billing/plans/', data);
        return response;
    }

    async updatePlan(id: string, data: Partial<Plan>): Promise<Plan> {
        const response = await this.apiClient.patch<Plan>(`/platform/billing/plans/${id}/`, data);
        return response;
    }

    async duplicatePlan(id: string): Promise<Plan> {
        const response = await this.apiClient.post<Plan>(`/platform/billing/plans/${id}/duplicate/`);
        return response;
    }

    async activatePlan(id: string): Promise<Plan> {
        const response = await this.apiClient.post<Plan>(`/platform/billing/plans/${id}/activate/`);
        return response;
    }

    async deactivatePlan(id: string): Promise<Plan> {
        const response = await this.apiClient.post<Plan>(`/platform/billing/plans/${id}/deactivate/`);
        return response;
    }

    async archivePlan(id: string): Promise<Plan> {
        const response = await this.apiClient.post<Plan>(`/platform/billing/plans/${id}/archive/`);
        return response;
    }

    async deletePlan(id: string): Promise<void> {
        await this.apiClient.delete(`/platform/billing/plans/${id}/`);
    }

    // Invoices
    async getInvoices(params?: PageRequest & {
        status?: string;
        payment_status?: 'PAID' | 'PENDING' | 'OVERDUE' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
        date_from?: string;
        date_to?: string;
    }): Promise<PaginatedResponse<Invoice>> {
        const response = await this.apiClient.get<PaginatedResponse<Invoice>>('/platform/billing/invoices/', { params });
        return response;
    }

    async getInvoice(id: string): Promise<Invoice> {
        const response = await this.apiClient.get<Invoice>(`/platform/billing/invoices/${id}/`);
        return response;
    }

    async downloadInvoice(id: string): Promise<Blob> {
        const response = await this.apiClient.download(`/platform/billing/invoices/${id}/download/`);
        return response;
    }

    async exportInvoices(data: {
        format: 'CSV' | 'XLSX' | 'PDF';
        filters?: {
            status?: string;
            payment_status?: string;
            date_from?: string;
            date_to?: string;
        };
    }): Promise<{ file_url: string; file_name: string; file_size: number }> {
        const response = await this.apiClient.post<{ file_url: string; file_name: string; file_size: number }>(
            '/platform/billing/invoices/export/',
            data
        );
        return response;
    }

    // Payments
    async getPaymentHistory(params?: PageRequest & {
        status?: string;
        date_from?: string;
        date_to?: string;
    }): Promise<PaginatedResponse<Payment>> {
        const response = await this.apiClient.get<PaginatedResponse<Payment>>('/platform/billing/payments/', { params });
        return response;
    }

    async getPayment(id: string): Promise<Payment> {
        const response = await this.apiClient.get<Payment>(`/platform/billing/payments/${id}/`);
        return response;
    }

    async retryPayment(id: string): Promise<{ success: boolean; payment_id?: string }> {
        const response = await this.apiClient.post<{ success: boolean; payment_id?: string }>(
            `/platform/billing/payments/${id}/retry/`
        );
        return response;
    }

    async refundPayment(id: string, amount?: number): Promise<{ success: boolean; refund_id?: string }> {
        const response = await this.apiClient.post<{ success: boolean; refund_id?: string }>(
            `/platform/billing/payments/${id}/refund/`,
            amount ? { amount } : undefined
        );
        return response;
    }

    // Usage
    async getUsage(params?: PageRequest & {
        resource?: string;
        date_from?: string;
        date_to?: string;
    }): Promise<Usage[]> {
        const response = await this.apiClient.get<Usage[]>('/platform/billing/usage/', { params });
        return response;
    }

    async getResourceUsage(resource: string, params?: {
        date_from?: string;
        date_to?: string;
    }): Promise<Usage> {
        const response = await this.apiClient.get<Usage>(`/platform/billing/usage/${resource}/`, { params });
        return response;
    }

    // Feature flags
    async getBillingFeatureFlags(): Promise<{
        billing_enabled: boolean;
        subscription_management: boolean;
        usage_tracking: boolean;
        invoice_generation: boolean;
        payment_processing: boolean;
    }> {
        const response = await this.apiClient.get<{
            billing_enabled: boolean;
            subscription_management: boolean;
            usage_tracking: boolean;
            invoice_generation: boolean;
            payment_processing: boolean;
        }>('/platform/billing/feature-flags/');
        return response;
    }
}
