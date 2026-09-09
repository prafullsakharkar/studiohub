// Identity API Services for Users
import { ApiClient } from '@/api/client/ApiClient';
import { User, CreateUser, UpdateUser, PaginatedResponse } from '@/modules/core/types';

export class UserService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all users with pagination, filtering, and sorting
     */
    async getUsers(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        ordering?: string;
        is_active?: boolean;
        role?: string;
        organization?: string;
    }): Promise<PaginatedResponse<User>> {
        const response = await this.apiClient.get<PaginatedResponse<User>>('/identity/users/', { params });
        return response;
    }

    /**
     * Get a single user by ID
     */
    async getUser(id: string): Promise<User> {
        const response = await this.apiClient.get<User>(`/identity/users/${id}/`);
        return response;
    }

    /**
     * Create a new user
     */
    async createUser(data: CreateUser): Promise<User> {
        const response = await this.apiClient.post<User>('/identity/users/', data);
        return response;
    }

    /**
     * Update an existing user
     */
    async updateUser(id: string, data: UpdateUser): Promise<User> {
        const response = await this.apiClient.patch<User>(`/identity/users/${id}/`, data);
        return response;
    }

    /**
     * Delete a user
     */
    async deleteUser(id: string): Promise<void> {
        await this.apiClient.delete(`/identity/users/${id}/`);
    }

    /**
     * Activate a user
     */
    async activateUser(id: string): Promise<User> {
        const response = await this.apiClient.post<User>(`/identity/users/${id}/activate/`);
        return response;
    }

    /**
     * Deactivate a user
     */
    async deactivateUser(id: string): Promise<User> {
        const response = await this.apiClient.post<User>(`/identity/users/${id}/deactivate/`);
        return response;
    }

    /**
     * Suspend a user
     */
    async suspendUser(id: string): Promise<User> {
        const response = await this.apiClient.post<User>(`/identity/users/${id}/suspend/`);
        return response;
    }

    /**
     * Unsuspend a user
     */
    async unsuspendUser(id: string): Promise<User> {
        const response = await this.apiClient.post<User>(`/identity/users/${id}/unsuspend/`);
        return response;
    }

    /**
     * Reset user's password
     */
    async resetPassword(id: string): Promise<void> {
        await this.apiClient.post(`/identity/users/${id}/reset-password/`);
    }

    /**
     * Force password change for user
     */
    async forcePasswordChange(id: string): Promise<void> {
        await this.apiClient.post(`/identity/users/${id}/force-password-change/`);
    }

    /**
     * Revoke all sessions for a user
     */
    async revokeSessions(id: string): Promise<void> {
        await this.apiClient.post(`/identity/users/${id}/revoke-sessions/`);
    }

    /**
     * Get user's roles
     */
    async getUserRoles(id: string): Promise<{ roles: string[] }> {
        const response = await this.apiClient.get<{ roles: string[] }>(`/identity/users/${id}/roles/`);
        return response;
    }

    /**
     * Update user's roles
     */
    async updateUserRoles(id: string, roles: string[]): Promise<User> {
        const response = await this.apiClient.patch<User>(`/identity/users/${id}/roles/`, { roles });
        return response;
    }
}

export const userService = new UserService();
