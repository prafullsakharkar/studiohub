// Identity API Services for Permissions
import { ApiClient } from '@/api/client/ApiClient';
import { Permission, PaginatedResponse } from '@/modules/core/types';

export class PermissionService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all permissions with pagination
     */
    async getPermissions(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        module?: string;
        category?: string;
    }): Promise<PaginatedResponse<Permission>> {
        const response = await this.apiClient.get<PaginatedResponse<Permission>>('/identity/permissions/', { params });
        return response;
    }

    /**
     * Get permissions by module
     */
    async getPermissionsByModule(module: string): Promise<Permission[]> {
        const response = await this.apiClient.get<{ results: Permission[] }>(`/identity/permissions/?module=${module}`);
        return response.results;
    }

    /**
     * Get permissions by category
     */
    async getPermissionsByCategory(category: string): Promise<Permission[]> {
        const response = await this.apiClient.get<{ results: Permission[] }>(`/identity/permissions/?category=${category}`);
        return response.results;
    }

    /**
     * Get all permission codes
     */
    async getPermissionCodes(): Promise<{ codes: string[] }> {
        const response = await this.apiClient.get<{ codes: string[] }>('/identity/permissions/codes/');
        return response;
    }
}

export const permissionService = new PermissionService();
