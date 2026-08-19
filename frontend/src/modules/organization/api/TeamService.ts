// Organization API Services for Teams
import { ApiClient } from '@/api/client/ApiClient';
import { Team, CreateTeam, UpdateTeam, PaginatedResponse } from '@/modules/core/types';

export class TeamService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all teams with pagination
     */
    async getTeams(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        ordering?: string;
        organization?: string;
        department?: string;
        type?: 'PRODUCTION' | 'TECHNICAL' | 'ADMINISTRATIVE' | 'ARTISTIC';
        status?: 'ACTIVE' | 'ARCHIVED';
    }): Promise<PaginatedResponse<Team>> {
        const response = await this.apiClient.get<PaginatedResponse<Team>>('/organization/teams/', { params });
        return response;
    }

    /**
     * Get teams by organization
     */
    async getOrganizationTeams(organizationId: string): Promise<Team[]> {
        const response = await this.apiClient.get<{ results: Team[] }>(`/organization/teams/?organization=${organizationId}`);
        return response.results;
    }

    /**
     * Get teams by department
     */
    async getDepartmentTeams(departmentId: string): Promise<Team[]> {
        const response = await this.apiClient.get<{ results: Team[] }>(`/organization/teams/?department=${departmentId}`);
        return response.results;
    }

    /**
     * Get a single team by ID
     */
    async getTeam(id: string): Promise<Team> {
        const response = await this.apiClient.get<Team>(`/organization/teams/${id}/`);
        return response;
    }

    /**
     * Create a new team
     */
    async createTeam(data: CreateTeam): Promise<Team> {
        const response = await this.apiClient.post<Team>('/organization/teams/', data);
        return response;
    }

    /**
     * Update an existing team
     */
    async updateTeam(id: string, data: UpdateTeam): Promise<Team> {
        const response = await this.apiClient.patch<Team>(`/organization/teams/${id}/`, data);
        return response;
    }

    /**
     * Delete a team
     */
    async deleteTeam(id: string): Promise<void> {
        await this.apiClient.delete(`/organization/teams/${id}/`);
    }

    /**
     * Archive a team
     */
    async archiveTeam(id: string): Promise<Team> {
        const response = await this.apiClient.post<Team>(`/organization/teams/${id}/archive/`);
        return response;
    }

    /**
     * Transfer team ownership
     */
    async transferOwnership(teamId: string, userId: string): Promise<Team> {
        const response = await this.apiClient.post<Team>(`/organization/teams/${teamId}/transfer-ownership/`, { user: userId });
        return response;
    }

    /**
     * Get team members
     */
    async getTeamMembers(id: string, params?: {
        page?: number;
        page_size?: number;
        search?: string;
    }): Promise<PaginatedResponse<{ user: string; user_email: string; role: string }>> {
        const response = await this.apiClient.get<PaginatedResponse<{ user: string; user_email: string; role: string }>>(`/organization/teams/${id}/members/`, { params });
        return response;
    }

    /**
     * Add member to team
     */
    async addMember(teamId: string, userId: string, role: string): Promise<Team> {
        const response = await this.apiClient.post<Team>(`/organization/teams/${teamId}/members/add/`, { user: userId, role });
        return response;
    }

    /**
     * Remove member from team
     */
    async removeMember(teamId: string, userId: string): Promise<Team> {
        const response = await this.apiClient.post<Team>(`/organization/teams/${teamId}/members/remove/`, { user: userId });
        return response;
    }
}

export const teamService = new TeamService();
