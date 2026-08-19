// Organization API Services for Offices
import { ApiClient } from '@/api/client/ApiClient';
import { Office, CreateOffice, UpdateOffice, PaginatedResponse } from '@/modules/core/types';

export class OfficeService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all offices with pagination
     */
    async getOffices(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        ordering?: string;
        organization?: string;
        status?: 'ACTIVE' | 'ARCHIVED';
    }): Promise<PaginatedResponse<Office>> {
        const response = await this.apiClient.get<PaginatedResponse<Office>>('/organization/offices/', { params });
        return response;
    }

    /**
     * Get offices by organization
     */
    async getOrganizationOffices(organizationId: string): Promise<Office[]> {
        const response = await this.apiClient.get<{ results: Office[] }>(`/organization/offices/?organization=${organizationId}`);
        return response.results;
    }

    /**
     * Get a single office by ID
     */
    async getOffice(id: string): Promise<Office> {
        const response = await this.apiClient.get<Office>(`/organization/offices/${id}/`);
        return response;
    }

    /**
     * Create a new office
     */
    async createOffice(data: CreateOffice): Promise<Office> {
        const response = await this.apiClient.post<Office>('/organization/offices/', data);
        return response;
    }

    /**
     * Update an existing office
     */
    async updateOffice(id: string, data: UpdateOffice): Promise<Office> {
        const response = await this.apiClient.patch<Office>(`/organization/offices/${id}/`, data);
        return response;
    }

    /**
     * Delete an office
     */
    async deleteOffice(id: string): Promise<void> {
        await this.apiClient.delete(`/organization/offices/${id}/`);
    }

    /**
     * Archive an office
     */
    async archiveOffice(id: string): Promise<Office> {
        const response = await this.apiClient.post<Office>(`/organization/offices/${id}/archive/`);
        return response;
    }
}

export const officeService = new OfficeService();
