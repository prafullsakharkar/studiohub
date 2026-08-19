// Whitelabel API Services
import { ApiClient } from '@/api/client/ApiClient';
import {
    BrandingConfig,
    ThemeConfig,
    EmailBranding,
    LoginPageConfig,
    Domain,
    PlatformStatus,
    PaginatedResponse,
    PageRequest,
} from '@/modules/platform/types';

export class WhitelabelService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    // Branding
    async getBrandingConfig(): Promise<BrandingConfig> {
        const response = await this.apiClient.get<BrandingConfig>('/platform/whitelabel/branding/');
        return response;
    }

    async updateBrandingConfig(data: Partial<BrandingConfig>): Promise<BrandingConfig> {
        const response = await this.apiClient.patch<BrandingConfig>('/platform/whitelabel/branding/', data);
        return response;
    }

    async uploadLogo(file: File): Promise<{ url: string; file_name: string }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await this.apiClient.post<{ url: string; file_name: string }>(
            '/platform/whitelabel/branding/upload-logo/',
            formData,
            { skipAuth: false, headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response;
    }

    async uploadFavicon(file: File): Promise<{ url: string; file_name: string }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await this.apiClient.post<{ url: string; file_name: string }>(
            '/platform/whitelabel/branding/upload-favicon/',
            formData,
            { skipAuth: false, headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response;
    }

    async uploadLoginLogo(file: File): Promise<{ url: string; file_name: string }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await this.apiClient.post<{ url: string; file_name: string }>(
            '/platform/whitelabel/branding/upload-login-logo/',
            formData,
            { skipAuth: false, headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response;
    }

    async deleteLogo(): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(
            '/platform/whitelabel/branding/delete-logo/'
        );
        return response;
    }

    async deleteFavicon(): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(
            '/platform/whitelabel/branding/delete-favicon/'
        );
        return response;
    }

    async deleteLoginLogo(): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(
            '/platform/whitelabel/branding/delete-login-logo/'
        );
        return response;
    }

    // Theme Configuration
    async getThemeConfig(): Promise<ThemeConfig> {
        const response = await this.apiClient.get<ThemeConfig>('/platform/whitelabel/theme/');
        return response;
    }

    async updateThemeConfig(data: Partial<ThemeConfig>): Promise<ThemeConfig> {
        const response = await this.apiClient.patch<ThemeConfig>('/platform/whitelabel/theme/', data);
        return response;
    }

    async previewTheme(data: Partial<ThemeConfig>): Promise<ThemeConfig> {
        const response = await this.apiClient.post<ThemeConfig>(
            '/platform/whitelabel/theme/preview/',
            data
        );
        return response;
    }

    async publishTheme(): Promise<{ success: boolean; theme_config: ThemeConfig }> {
        const response = await this.apiClient.post<{ success: boolean; theme_config: ThemeConfig }>(
            '/platform/whitelabel/theme/publish/'
        );
        return response;
    }

    async unpublishTheme(): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(
            '/platform/whitelabel/theme/unpublish/'
        );
        return response;
    }

    // Login Page Customization
    async getLoginPageConfig(): Promise<LoginPageConfig> {
        const response = await this.apiClient.get<LoginPageConfig>('/platform/whitelabel/login-page/');
        return response;
    }

    async updateLoginPageConfig(data: Partial<LoginPageConfig>): Promise<LoginPageConfig> {
        const response = await this.apiClient.patch<LoginPageConfig>('/platform/whitelabel/login-page/', data);
        return response;
    }

    async previewLoginPage(data: Partial<LoginPageConfig>): Promise<LoginPageConfig> {
        const response = await this.apiClient.post<LoginPageConfig>(
            '/platform/whitelabel/login-page/preview/',
            data
        );
        return response;
    }

    async publishLoginPage(): Promise<{ success: boolean; login_page_config: LoginPageConfig }> {
        const response = await this.apiClient.post<{ success: boolean; login_page_config: LoginPageConfig }>(
            '/platform/whitelabel/login-page/publish/'
        );
        return response;
    }

    // Email Branding
    async getEmailBranding(): Promise<EmailBranding> {
        const response = await this.apiClient.get<EmailBranding>('/platform/whitelabel/email-branding/');
        return response;
    }

    async updateEmailBranding(data: Partial<EmailBranding>): Promise<EmailBranding> {
        const response = await this.apiClient.patch<EmailBranding>('/platform/whitelabel/email-branding/', data);
        return response;
    }

    async previewEmailBranding(data: Partial<EmailBranding>): Promise<EmailBranding> {
        const response = await this.apiClient.post<EmailBranding>(
            '/platform/whitelabel/email-branding/preview/',
            data
        );
        return response;
    }

    async publishEmailBranding(): Promise<{ success: boolean; email_branding: EmailBranding }> {
        const response = await this.apiClient.post<{ success: boolean; email_branding: EmailBranding }>(
            '/platform/whitelabel/email-branding/publish/'
        );
        return response;
    }

    // Domains
    async getDomains(params?: PageRequest & {
        status?: PlatformStatus;
        ssl_status?: 'VALID' | 'EXPIRED' | 'INVALID' | 'PENDING';
    }): Promise<PaginatedResponse<Domain>> {
        const response = await this.apiClient.get<PaginatedResponse<Domain>>('/platform/whitelabel/domains/', { params });
        return response;
    }

    async getDomain(id: string): Promise<Domain> {
        const response = await this.apiClient.get<Domain>(`/platform/whitelabel/domains/${id}/`);
        return response;
    }

    async addDomain(data: {
        domain_name: string;
        verification_instructions?: string;
    }): Promise<Domain> {
        const response = await this.apiClient.post<Domain>('/platform/whitelabel/domains/', data);
        return response;
    }

    async verifyDomain(id: string): Promise<{ success: boolean; domain: Domain }> {
        const response = await this.apiClient.post<{ success: boolean; domain: Domain }>(
            `/platform/whitelabel/domains/${id}/verify/`
        );
        return response;
    }

    async retryVerification(id: string): Promise<{ success: boolean; domain: Domain }> {
        const response = await this.apiClient.post<{ success: boolean; domain: Domain }>(
            `/platform/whitelabel/domains/${id}/retry-verification/`
        );
        return response;
    }

    async removeDomain(id: string): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(
            `/platform/whitelabel/domains/${id}/remove/`
        );
        return response;
    }

    // Publishing Workflow
    async getPublishingStatus(): Promise<{
        branding_status: PlatformStatus;
        theme_status: PlatformStatus;
        login_page_status: PlatformStatus;
        email_branding_status: PlatformStatus;
        domains_status: PlatformStatus;
        last_publish_at?: string;
        last_publish_by?: string;
    }> {
        const response = await this.apiClient.get<{
            branding_status: PlatformStatus;
            theme_status: PlatformStatus;
            login_page_status: PlatformStatus;
            email_branding_status: PlatformStatus;
            domains_status: PlatformStatus;
            last_publish_at?: string;
            last_publish_by?: string;
        }>('/platform/whitelabel/publishing-status/');
        return response;
    }

    async publishAll(): Promise<{ success: boolean; published_at: string }> {
        const response = await this.apiClient.post<{ success: boolean; published_at: string }>(
            '/platform/whitelabel/publish-all/'
        );
        return response;
    }

    async unpublishAll(): Promise<{ success: boolean }> {
        const response = await this.apiClient.post<{ success: boolean }>(
            '/platform/whitelabel/unpublish-all/'
        );
        return response;
    }

    async getConfigurationHistory(limit?: number): Promise<{
        history: Array<{
            id: string;
            timestamp: string;
            user: string;
            action: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'UNPUBLISH';
            changes?: Record<string, unknown>;
        }>;
        total: number;
    }> {
        const response = await this.apiClient.get<{
            history: Array<{
                id: string;
                timestamp: string;
                user: string;
                action: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'UNPUBLISH';
                changes?: Record<string, unknown>;
            }>;
            total: number;
        }>(`/platform/whitelabel/configuration-history/?limit=${limit || 10}`);
        return response;
    }

    // Feature flags
    async getWhitelabelFeatureFlags(): Promise<{
        whitelabel_enabled: boolean;
        branding_customization: boolean;
        theme_customization: boolean;
        domain_customization: boolean;
        login_page_customization: boolean;
        email_branding: boolean;
    }> {
        const response = await this.apiClient.get<{
            whitelabel_enabled: boolean;
            branding_customization: boolean;
            theme_customization: boolean;
            domain_customization: boolean;
            login_page_customization: boolean;
            email_branding: boolean;
        }>('/platform/whitelabel/feature-flags/');
        return response;
    }
}
