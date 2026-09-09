// Organization API Services for Departments
import { ApiClient } from '@/api/client/ApiClient';
import { Department, CreateDepartment, UpdateDepartment, PaginatedResponse } from '@/modules/core/types';

export class DepartmentService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all departments with pagination
     */
    async getDepartments(params?: {
        page?: number;
        page_size?: number;
        search?: string;
        ordering?: string;
        organization?: string;
        status?: 'ACTIVE' | 'ARCHIVED';
    }): Promise<PaginatedResponse<Department>> {
        const response = await this.apiClient.get<PaginatedResponse<Department>>('/organization/departments/', { params });
        return response;
    }

    /**
     * Get departments by organization
     */
    async getOrganizationDepartments(organizationId: string): Promise<Department[]> {
        const response = await this.apiClient.get<{ results: Department[] }>(`/organization/departments/?organization=${organizationId}`);
        return response.results;
    }

    /**
     * Get a single department by ID
     */
    async getDepartment(id: string): Promise<Department> {
        const response = await this.apiClient.get<Department>(`/organization/departments/${id}/`);
        return response;
    }

    /**
     * Create a new department
     */
    async createDepartment(data: CreateDepartment): Promise<Department> {
        const response = await this.apiClient.post<Department>('/organization/departments/', data);
        return response;
    }

    /**
     * Update an existing department
     */
    async updateDepartment(id: string, data: UpdateDepartment): Promise<Department> {
        const response = await this.apiClient.patch<Department>(`/organization/departments/${id}/`, data);
        return response;
    }

    /**
     * Delete a department
     */
    async deleteDepartment(id: string): Promise<void> {
        await this.apiClient.delete(`/organization/departments/${id}/`);
    }

    /**
     * Archive a department
     */
    async archiveDepartment(id: string): Promise<Department> {
        const response = await this.apiClient.post<Department>(`/organization/departments/${id}/archive/`);
        return response;
    }

    /**
     * Get department members
     */
    async getDepartmentMembers(id: string, params?: {
        page?: number;
        page_size?: number;
        search?: string;
    }): Promise<PaginatedResponse<{ user: string; user_email: string; role: string }>> {
        const response = await this.apiClient.get<PaginatedResponse<{ user: string; user_email: string; role: string }>>(`/organization/departments/${id}/members/`, { params });
        return response;
    }
}

export const departmentService = new DepartmentService();
