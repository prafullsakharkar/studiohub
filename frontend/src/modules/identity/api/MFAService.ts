// Identity API Services for MFA
import { ApiClient } from '@/api/client/ApiClient';
import { MFAConfig, MFATOTPSetup, MFASMSVerify, MFAEmailVerify } from '@/modules/core/types';

export class MFAService {
    private apiClient: ApiClient;

    constructor() {
        this.apiClient = new ApiClient('/api/v1');
    }

    /**
     * Get current user's MFA configuration
     */
    async getMFAConfig(): Promise<MFAConfig> {
        const response = await this.apiClient.get<MFAConfig>('/identity/mfa/config/');
        return response;
    }

    /**
     * Enable TOTP for MFA
     */
    async enableTOTP(secret: string, code: string): Promise<MFAConfig> {
        const response = await this.apiClient.post<MFAConfig>('/identity/mfa/totp/enable/', { secret, code });
        return response;
    }

    /**
     * Get TOTP setup information
     */
    async getTOTPSetup(): Promise<MFATOTPSetup> {
        const response = await this.apiClient.get<MFATOTPSetup>('/identity/mfa/totp/setup/');
        return response;
    }

    /**
     * Verify TOTP code
     */
    async verifyTOTP(code: string): Promise<{ valid: boolean }> {
        const response = await this.apiClient.post<{ valid: boolean }>('/identity/mfa/totp/verify/', { code });
        return response;
    }

    /**
     * Disable TOTP
     */
    async disableTOTP(code: string): Promise<void> {
        await this.apiClient.post('/identity/mfa/totp/disable/', { code });
    }

    /**
     * Enable SMS for MFA
     */
    async enableSMS(phoneNumber: string): Promise<MFASMSVerify> {
        const response = await this.apiClient.post<MFASMSVerify>('/identity/mfa/sms/enable/', { phone_number: phoneNumber });
        return response;
    }

    /**
     * Verify SMS code
     */
    async verifySMS(code: string): Promise<{ verified: boolean }> {
        const response = await this.apiClient.post<{ verified: boolean }>('/identity/mfa/sms/verify/', { code });
        return response;
    }

    /**
     * Disable SMS
     */
    async disableSMS(): Promise<void> {
        await this.apiClient.post('/identity/mfa/sms/disable/');
    }

    /**
     * Enable email for MFA
     */
    async enableEmail(email: string): Promise<MFAEmailVerify> {
        const response = await this.apiClient.post<MFAEmailVerify>('/identity/mfa/email/enable/', { email });
        return response;
    }

    /**
     * Verify email code
     */
    async verifyEmail(code: string): Promise<{ verified: boolean }> {
        const response = await this.apiClient.post<{ verified: boolean }>('/identity/mfa/email/verify/', { code });
        return response;
    }

    /**
     * Disable email
     */
    async disableEmail(): Promise<void> {
        await this.apiClient.post('/identity/mfa/email/disable/');
    }

    /**
     * Get recovery codes
     */
    async getRecoveryCodes(): Promise<{ codes: string[] }> {
        const response = await this.apiClient.get<{ codes: string[] }>('/identity/mfa/recovery-codes/');
        return response;
    }

    /**
     * Regenerate recovery codes
     */
    async regenerateRecoveryCodes(): Promise<{ codes: string[] }> {
        const response = await this.apiClient.post<{ codes: string[] }>('/identity/mfa/recovery-codes/regenerate/');
        return response;
    }

    /**
     * Admin: Reset MFA for user
     */
    async adminResetMFA(userId: string): Promise<void> {
        await this.apiClient.post(`/identity/mfa/admin/reset/${userId}/`);
    }
}

export const mfaService = new MFAService();
