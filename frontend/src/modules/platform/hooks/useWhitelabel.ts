// Whitelabel Hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WhitelabelService } from '@/modules/platform/api/WhitelabelService';
import {
    BrandingConfig,
    ThemeConfig,
    EmailBranding,
    LoginPageConfig,
    Domain,
    PaginatedResponse,
    PageRequest,
    PlatformStatus,
} from '@/modules/platform/types';

const whitelabelService = new WhitelabelService();

// Query keys
export const whitelabelQueryKeys = {
    all: ['platform', 'whitelabel'] as const,
    branding: () => [...whitelabelQueryKeys.all, 'branding'] as const,
    theme: () => [...whitelabelQueryKeys.all, 'theme'] as const,
    emailBranding: () => [...whitelabelQueryKeys.all, 'email-branding'] as const,
    loginPage: () => [...whitelabelQueryKeys.all, 'login-page'] as const,
    domains: (params?: PageRequest & { status?: PlatformStatus }) =>
        [...whitelabelQueryKeys.all, 'domains', params] as const,
    domain: (id: string) => [...whitelabelQueryKeys.all, 'domain', id] as const,
    publishingStatus: () => [...whitelabelQueryKeys.all, 'publishing-status'] as const,
};

// Branding hooks
export const useBrandingConfig = () => {
    return useQuery({
        queryKey: whitelabelQueryKeys.branding(),
        queryFn: () => whitelabelService.getBrandingConfig(),
    });
};

export const useUpdateBrandingConfig = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof whitelabelService.updateBrandingConfig>[0]) =>
            whitelabelService.updateBrandingConfig(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.branding() });
        },
    });
};

export const useUploadLogo = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (file: File) => whitelabelService.uploadLogo(file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.branding() });
        },
    });
};

export const useUploadFavicon = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (file: File) => whitelabelService.uploadFavicon(file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.branding() });
        },
    });
};

export const useUploadLoginLogo = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (file: File) => whitelabelService.uploadLoginLogo(file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.branding() });
        },
    });
};

export const useDeleteLogo = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => whitelabelService.deleteLogo(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.branding() });
        },
    });
};

export const useDeleteFavicon = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => whitelabelService.deleteFavicon(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.branding() });
        },
    });
};

export const useDeleteLoginLogo = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => whitelabelService.deleteLoginLogo(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.branding() });
        },
    });
};

// Theme hooks
export const useThemeConfig = () => {
    return useQuery({
        queryKey: whitelabelQueryKeys.theme(),
        queryFn: () => whitelabelService.getThemeConfig(),
    });
};

export const useUpdateThemeConfig = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof whitelabelService.updateThemeConfig>[0]) =>
            whitelabelService.updateThemeConfig(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.theme() });
        },
    });
};

export const usePreviewTheme = () => {
    return useMutation({
        mutationFn: (data: Parameters<typeof whitelabelService.previewTheme>[0]) =>
            whitelabelService.previewTheme(data),
    });
};

export const usePublishTheme = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => whitelabelService.publishTheme(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.theme() });
        },
    });
};

export const useUnpublishTheme = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => whitelabelService.unpublishTheme(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.theme() });
        },
    });
};

// Email branding hooks
export const useEmailBranding = () => {
    return useQuery({
        queryKey: whitelabelQueryKeys.emailBranding(),
        queryFn: () => whitelabelService.getEmailBranding(),
    });
};

export const useUpdateEmailBranding = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof whitelabelService.updateEmailBranding>[0]) =>
            whitelabelService.updateEmailBranding(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.emailBranding() });
        },
    });
};

export const usePreviewEmailBranding = () => {
    return useMutation({
        mutationFn: (data: Parameters<typeof whitelabelService.previewEmailBranding>[0]) =>
            whitelabelService.previewEmailBranding(data),
    });
};

export const usePublishEmailBranding = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => whitelabelService.publishEmailBranding(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.emailBranding() });
        },
    });
};

// Login page hooks
export const useLoginPageConfig = () => {
    return useQuery({
        queryKey: whitelabelQueryKeys.loginPage(),
        queryFn: () => whitelabelService.getLoginPageConfig(),
    });
};

export const useUpdateLoginPageConfig = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof whitelabelService.updateLoginPageConfig>[0]) =>
            whitelabelService.updateLoginPageConfig(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.loginPage() });
        },
    });
};

export const usePreviewLoginPage = () => {
    return useMutation({
        mutationFn: (data: Parameters<typeof whitelabelService.previewLoginPage>[0]) =>
            whitelabelService.previewLoginPage(data),
    });
};

export const usePublishLoginPage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => whitelabelService.publishLoginPage(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.loginPage() });
        },
    });
};

// Domain hooks
export const useDomains = (params?: PageRequest & {
    status?: PlatformStatus;
}) => {
    return useQuery({
        queryKey: whitelabelQueryKeys.domains(params),
        queryFn: () => whitelabelService.getDomains(params),
    });
};

export const useDomain = (id: string) => {
    return useQuery({
        queryKey: whitelabelQueryKeys.domain(id),
        queryFn: () => whitelabelService.getDomain(id),
        enabled: !!id,
    });
};

export const useAddDomain = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof whitelabelService.addDomain>[0]) =>
            whitelabelService.addDomain(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.domains() });
        },
    });
};

export const useVerifyDomain = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => whitelabelService.verifyDomain(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.domain(id) });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.domains() });
        },
    });
};

export const useRetryDomainVerification = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => whitelabelService.retryVerification(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.domain(id) });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.domains() });
        },
    });
};

export const useRemoveDomain = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => whitelabelService.removeDomain(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.domains() });
        },
    });
};

// Publishing hooks
export const usePublishingStatus = () => {
    return useQuery({
        queryKey: whitelabelQueryKeys.publishingStatus(),
        queryFn: () => whitelabelService.getPublishingStatus(),
    });
};

export const usePublishAll = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => whitelabelService.publishAll(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.branding() });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.theme() });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.loginPage() });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.emailBranding() });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.domains() });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.publishingStatus() });
        },
    });
};

export const useUnpublishAll = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => whitelabelService.unpublishAll(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.branding() });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.theme() });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.loginPage() });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.emailBranding() });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.domains() });
            queryClient.invalidateQueries({ queryKey: whitelabelQueryKeys.publishingStatus() });
        },
    });
};
