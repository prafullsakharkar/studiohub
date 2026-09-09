// Organization API Services for Invitations
import { ApiClient } from '@/api/client/ApiClient';
import { Invitation, CreateInvitation, UpdateInvitation, PaginatedResponse } from '@/modules/core/types';

export class InvitationService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all invitations with pagination
     */
    async getInvitations(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        ordering?: string;
        organization?: string;
        status?: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
    }): Promise<PaginatedResponse<Invitation>> {
        const response = await this.apiClient.get<PaginatedResponse<Invitation>>('/organization/invitations/', { params });
        return response;
    }

    /**
     * Get invitations by organization
     */
    async getOrganizationInvitations(organizationId: string): Promise<Invitation[]> {
        const response = await this.apiClient.get<{ results: Invitation[] }>(`/organization/invitations/?organization=${organizationId}`);
        return response.results;
    }

    /**
     * Get a single invitation by ID
     */
    async getInvitation(id: string): Promise<Invitation> {
        const response = await this.apiClient.get<Invitation>(`/organization/invitations/${id}/`);
        return response;
    }

    /**
     * Create a new invitation
     */
    async createInvitation(data: CreateInvitation): Promise<Invitation> {
        const response = await this.apiClient.post<Invitation>('/organization/invitations/', data);
        return response;
    }

    /**
     * Update an existing invitation
     */
    async updateInvitation(id: string, data: UpdateInvitation): Promise<Invitation> {
        const response = await this.apiClient.patch<Invitation>(`/organization/invitations/${id}/`, data);
        return response;
    }

    /**
     * Delete (revoke) an invitation
     */
    async deleteInvitation(id: string): Promise<void> {
        await this.apiClient.delete(`/organization/invitations/${id}/`);
    }

    /**
     * Resend invitation
     */
    async resendInvitation(id: string): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(`/organization/invitations/${id}/resend/`);
        return response;
    }

    /**
     * Accept invitation
     */
    async acceptInvitation(id: string): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(`/organization/invitations/${id}/accept/`);
        return response;
    }

    /**
     * Decline invitation
     */
    async declineInvitation(id: string): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(`/organization/invitations/${id}/decline/`);
        return response;
    }
}

export const invitationService = new InvitationService();
