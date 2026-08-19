// Organization API Services
import { ApiClient } from '@/api/client/ApiClient';
import { Organization, CreateOrganization, UpdateOrganization, PaginatedResponse } from '@/modules/core/types';

export class OrganizationService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all organizations (admin only)
     */
    async getOrganizations(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        ordering?: string;
        status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
    }): Promise<PaginatedResponse<Organization>> {
        const response = await this.apiClient.get<PaginatedResponse<Organization>>('/organization/organizations/', { params });
        return response;
    }

    /**
     * Get current user's organizations
     */
    async getMyOrganizations(params?: {
        page?: number;
        page_size?: number;
        is_active?: boolean;
    }): Promise<PaginatedResponse<Organization>> {
        const response = await this.apiClient.get<PaginatedResponse<Organization>>('/organization/organizations/my/', { params });
        return response;
    }

    /**
     * Get a single organization by ID
     */
    async getOrganization(id: string): Promise<Organization> {
        const response = await this.apiClient.get<Organization>(`/organization/organizations/${id}/`);
        return response;
    }

    /**
     * Create a new organization
     */
    async createOrganization(data: CreateOrganization): Promise<Organization> {
        const response = await this.apiClient.post<Organization>('/organization/organizations/', data);
        return response;
    }

    /**
     * Update an existing organization
     */
    async updateOrganization(id: string, data: UpdateOrganization): Promise<Organization> {
        const response = await this.apiClient.patch<Organization>(`/organization/organizations/${id}/`, data);
        return response;
    }

    /**
     * Delete an organization
     */
    async deleteOrganization(id: string): Promise<void> {
        await this.apiClient.delete(`/organization/organizations/${id}/`);
    }

    /**
     * Archive an organization
     */
    async archiveOrganization(id: string): Promise<Organization> {
        const response = await this.apiClient.post<Organization>(`/organization/organizations/${id}/archive/`);
        return response;
    }

    /**
     * Restore an archived organization
     */
    async restoreOrganization(id: string): Promise<Organization> {
        const response = await this.apiClient.post<Organization>(`/organization/organizations/${id}/restore/`);
        return response;
    }

    /**
     * Switch to an organization
     */
    async switchOrganization(id: string): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(`/organization/organizations/${id}/switch/`);
        return response;
    }

    /**
     * Get organization settings
     */
    async getOrganizationSettings(id: string): Promise<Record<string, unknown>> {
        const response = await this.apiClient.get<Record<string, unknown>>(`/organization/organizations/${id}/settings/`);
        return response;
    }

    /**
     * Update organization settings
     */
    async updateOrganizationSettings(id: string, settings: Record<string, unknown>): Promise<Organization> {
        const response = await this.apiClient.patch<Organization>(`/organization/organizations/${id}/settings/`, { settings });
        return response;
    }

    /**
     * Export organization data
     */
    async exportOrganization(id: string): Promise<{ download_url: string }> {
        const response = await this.apiClient.post<{ download_url: string }>(`/organization/organizations/${id}/export/`);
        return response;
    }
}

export const organizationService = new OrganizationService();
