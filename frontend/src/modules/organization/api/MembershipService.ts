// Organization API Services for Memberships
import { ApiClient } from '@/api/client/ApiClient';
import { Membership, CreateMembership, UpdateMembership, PaginatedResponse } from '@/modules/core/types';

export class MembershipService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all memberships with pagination
     */
    async getMemberships(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        ordering?: string;
        organization?: string;
        user?: string;
        status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    }): Promise<PaginatedResponse<Membership>> {
        const response = await this.apiClient.get<PaginatedResponse<Membership>>('/organization/memberships/', { params });
        return response;
    }

    /**
     * Get memberships by organization
     */
    async getOrganizationMemberships(organizationId: string): Promise<Membership[]> {
        const response = await this.apiClient.get<{ results: Membership[] }>(`/organization/memberships/?organization=${organizationId}`);
        return response.results;
    }

    /**
     * Get memberships by user
     */
    async getUserMemberships(userId: string): Promise<Membership[]> {
        const response = await this.apiClient.get<{ results: Membership[] }>(`/organization/memberships/?user=${userId}`);
        return response.results;
    }

    /**
     * Get a single membership by ID
     */
    async getMembership(id: string): Promise<Membership> {
        const response = await this.apiClient.get<Membership>(`/organization/memberships/${id}/`);
        return response;
    }

    /**
     * Create a new membership
     */
    async createMembership(data: CreateMembership): Promise<Membership> {
        const response = await this.apiClient.post<Membership>('/organization/memberships/', data);
        return response;
    }

    /**
     * Update an existing membership
     */
    async updateMembership(id: string, data: UpdateMembership): Promise<Membership> {
        const response = await this.apiClient.patch<Membership>(`/organization/memberships/${id}/`, data);
        return response;
    }

    /**
     * Delete a membership
     */
    async deleteMembership(id: string): Promise<void> {
        await this.apiClient.delete(`/organization/memberships/${id}/`);
    }

    /**
     * Bulk update memberships
     */
    async bulkUpdateMemberships(memberships: { id: string; data: UpdateMembership }[]): Promise<{ updated: number }> {
        const response = await this.apiClient.post<{ updated: number }>('/organization/memberships/bulk-update/', { memberships });
        return response;
    }
}

export const membershipService = new MembershipService();
