// Identity API Services for Sessions
import { ApiClient } from '@/api/client/ApiClient';
import { Session, PaginatedResponse } from '@/modules/core/types';

export class SessionService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get all sessions for current user
     */
    async getUserSessions(params?: {
        page?: number;
        page_size?: number;
        is_current?: boolean;
    }): Promise<PaginatedResponse<Session>> {
        const response = await this.apiClient.get<PaginatedResponse<Session>>('/identity/sessions/', { params });
        return response;
    }

    /**
     * Get all sessions for a user (admin only)
     */
    async getUserSessionsAdmin(userId: string, params?: {
        page?: number;
        page_size?: number;
    }): Promise<PaginatedResponse<Session>> {
        const response = await this.apiClient.get<PaginatedResponse<Session>>(`/identity/sessions/admin/${userId}/`, { params });
        return response;
    }

    /**
     * Get current session
     */
    async getCurrentSession(): Promise<Session> {
        const response = await this.apiClient.get<Session>('/identity/sessions/current/');
        return response;
    }

    /**
     * Revoke a specific session
     */
    async revokeSession(sessionId: string): Promise<void> {
        await this.apiClient.post(`/identity/sessions/${sessionId}/revoke/`);
    }

    /**
     * Revoke all sessions except current
     */
    async revokeAllOtherSessions(): Promise<void> {
        await this.apiClient.post('/identity/sessions/revoke-all-other/');
    }

    /**
     * Revoke all sessions (admin only)
     */
    async revokeAllSessions(userId: string): Promise<void> {
        await this.apiClient.post(`/identity/sessions/admin/${userId}/revoke-all/`);
    }

    /**
     * Get session activity log
     */
    async getSessionActivity(sessionId: string): Promise<{ activity: Array<{ timestamp: string; action: string }> }> {
        const response = await this.apiClient.get<{ activity: Array<{ timestamp: string; action: string }> }>(`/identity/sessions/${sessionId}/activity/`);
        return response;
    }
}

export const sessionService = new SessionService();
