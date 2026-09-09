// Settings API Services
import { ApiClient } from '@/api/client/ApiClient';
import { Setting, SettingCategory, FeatureFlag, PaginatedResponse } from '@/modules/core/types';

export class SettingsService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all settings with pagination
     */
    async getSettings(params?: {
        page?: number;
        page_size?: number;
        category?: SettingCategory;
        search?: string;
    }): Promise<PaginatedResponse<Setting>> {
        const response = await this.apiClient.get<PaginatedResponse<Setting>>('/settings/settings/', { params });
        return response;
    }

    /**
     * Get settings by category
     */
    async getSettingsByCategory(category: SettingCategory): Promise<Setting[]> {
        const response = await this.apiClient.get<{ results: Setting[] }>(`/settings/settings/?category=${category}`);
        return response.results;
    }

    /**
     * Get a single setting by key
     */
    async getSetting(key: string): Promise<Setting> {
        const response = await this.apiClient.get<Setting>(`/settings/settings/${key}/`);
        return response;
    }

    /**
     * Update a setting
     */
    async updateSetting(key: string, value: unknown): Promise<Setting> {
        const response = await this.apiClient.patch<Setting>(`/settings/settings/${key}/`, { value });
        return response;
    }

    /**
     * Update multiple settings
     */
    async bulkUpdateSettings(settings: { key: string; value: unknown }[]): Promise<{ updated: number }> {
        const response = await this.apiClient.post<{ updated: number }>('/settings/settings/bulk-update/', { settings });
        return response;
    }

    /**
     * Get feature flags
     */
    async getFeatureFlags(params?: {
        scope?: 'GLOBAL' | 'ORGANIZATION' | 'USER';
    }): Promise<FeatureFlag[]> {
        const response = await this.apiClient.get<{ results: FeatureFlag[] }>(`/settings/feature-flags/`, { params });
        return response.results;
    }

    /**
     * Get feature flag by key
     */
    async getFeatureFlag(key: string): Promise<FeatureFlag> {
        const response = await this.apiClient.get<FeatureFlag>(`/settings/feature-flags/${key}/`);
        return response;
    }

    /**
     * Enable feature flag
     */
    async enableFeatureFlag(key: string): Promise<FeatureFlag> {
        const response = await this.apiClient.post<FeatureFlag>(`/settings/feature-flags/${key}/enable/`);
        return response;
    }

    /**
     * Disable feature flag
     */
    async disableFeatureFlag(key: string): Promise<FeatureFlag> {
        const response = await this.apiClient.post<FeatureFlag>(`/settings/feature-flags/${key}/disable/`);
        return response;
    }

    /**
     * Get organization settings
     */
    async getOrganizationSettings(organizationId: string): Promise<Record<string, unknown>> {
        const response = await this.apiClient.get<Record<string, unknown>>(`/settings/organizations/${organizationId}/settings/`);
        return response;
    }

    /**
     * Update organization settings
     */
    async updateOrganizationSettings(organizationId: string, settings: Record<string, unknown>): Promise<Record<string, unknown>> {
        const response = await this.apiClient.patch<Record<string, unknown>>(`/settings/organizations/${organizationId}/settings/`, settings);
        return response;
    }

    /**
     * Get system settings (list of SettingDefinition value rows)
     */
    async getSystemSettingsList(): Promise<any[]> {
        const response = await this.apiClient.get<{ results?: any[] } | any[]>('/settings/system-settings/', {
            params: { page_size: 200 },
        });
        return Array.isArray(response) ? response : (response?.results ?? []);
    }

    /**
     * Update a system setting value by id
     */
    async updateSystemSetting(id: string, value: unknown): Promise<any> {
        const response = await this.apiClient.patch<any>(`/settings/system-settings/${id}/`, {
            value: JSON.stringify(value),
        });
        return response;
    }

    /**
     * Get system settings
     */
    async getSystemSettings(): Promise<Record<string, unknown>> {
        const response = await this.apiClient.get<Record<string, unknown>>('/settings/system/');
        return response;
    }

    /**
     * Update system settings
     */
    async updateSystemSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
        const response = await this.apiClient.patch<Record<string, unknown>>('/settings/system/', settings);
        return response;
    }
}

export const settingsService = new SettingsService();
