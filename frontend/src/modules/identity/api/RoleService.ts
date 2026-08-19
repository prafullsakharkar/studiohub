// Identity API Services for Roles
import { ApiClient } from '@/api/client/ApiClient';
import { Role, CreateRole, UpdateRole, PaginatedResponse } from '@/modules/core/types';

export class RoleService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all roles with pagination
     */
    async getRoles(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        ordering?: string;
        is_system?: boolean;
    }): Promise<PaginatedResponse<Role>> {
        const response = await this.apiClient.get<PaginatedResponse<Role>>('/identity/roles/', { params });
        return response;
    }

    /**
     * Get a single role by ID
     */
    async getRole(id: string): Promise<Role> {
        const response = await this.apiClient.get<Role>(`/identity/roles/${id}/`);
        return response;
    }

    /**
     * Create a new role
     */
    async createRole(data: CreateRole): Promise<Role> {
        const response = await this.apiClient.post<Role>('/identity/roles/', data);
        return response;
    }

    /**
     * Update an existing role
     */
    async updateRole(id: string, data: UpdateRole): Promise<Role> {
        const response = await this.apiClient.patch<Role>(`/identity/roles/${id}/`, data);
        return response;
    }

    /**
     * Delete a role
     */
    async deleteRole(id: string): Promise<void> {
        await this.apiClient.delete(`/identity/roles/${id}/`);
    }

    /**
     * Clone a role
     */
    async cloneRole(id: string, name: string): Promise<Role> {
        const response = await this.apiClient.post<Role>(`/identity/roles/${id}/clone/`, { name });
        return response;
    }

    /**
     * Get role permissions
     */
    async getRolePermissions(id: string): Promise<{ permissions: string[] }> {
        const response = await this.apiClient.get<{ permissions: string[] }>(`/identity/roles/${id}/permissions/`);
        return response;
    }

    /**
     * Update role permissions
     */
    async updateRolePermissions(id: string, permissions: string[]): Promise<Role> {
        const response = await this.apiClient.patch<Role>(`/identity/roles/${id}/permissions/`, { permissions });
        return response;
    }

    /**
     * Add permission to role
     */
    async addPermissionToRole(id: string, permission: string): Promise<Role> {
        const response = await this.apiClient.post<Role>(`/identity/roles/${id}/permissions/add/`, { permission });
        return response;
    }

    /**
     * Remove permission from role
     */
    async removePermissionFromRole(id: string, permission: string): Promise<Role> {
        const response = await this.apiClient.post<Role>(`/identity/roles/${id}/permissions/remove/`, { permission });
        return response;
    }
}

export const roleService = new RoleService();
