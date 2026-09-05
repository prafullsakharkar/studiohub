import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Organization, OrganizationSettings } from '@/types/organization';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { organizationApi } from '@/modules/organization/api/organizationApi';

interface OrganizationContextValue {
  currentOrganization: Organization;
  organizations: Organization[];
  switchOrganization: (orgId: string) => void;
  isLoading: boolean;
  updateOrganizationSettings: (settings: Partial<OrganizationSettings>) => Promise<void>;
  isOrganizationAdmin: boolean;
  // Favorites & Recents
  favoriteOrgIds: string[];
  recentOrgIds: string[];
  toggleFavorite: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
}

const STORAGE_KEY = 'studiohub_active_org_id';
const FAVORITES_STORAGE_KEY = 'studiohub_favorite_org_ids';
const RECENTS_STORAGE_KEY = 'studiohub_recent_org_ids';

/**
 * Neutral placeholder rendered only while the real organization list is being
 * fetched (pre-auth / first paint). Never contains fabricated studio data.
 */
const EMPTY_ORGANIZATION: Organization = {
  id: '',
  created_at: '',
  updated_at: '',
  name: 'No Organization',
  slug: '',
  code: '',
  tier: 'Indie',
  logo_url: '',
  headquarters: '',
  offices_count: 0,
  active_projects_count: 0,
  crew_count: 0,
  storage_quota_tb: 0,
  storage_used_tb: 0,
  status: 'Onboarding',
  primary_contact_email: '',
  primary_contact_name: '',
  settings: {
    default_fps: 24,
    default_color_space: '',
    default_resolution: '',
    allow_guest_reviewers: false,
    enable_two_factor: false,
    sso_enforced: false,
    render_farm_region: '',
    usd_schema_version: '',
  },
};

export const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [favoriteOrgIds, setFavoriteOrgIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [recentOrgIds, setRecentOrgIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentOrgId, setCurrentOrgId] = useState<string>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) || '' : '';
  });

  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotificationStore();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Fetch live organizations from API once authenticated.
  const refreshOrganizations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const list = await organizationApi.getOrganizations();
      if (list && list.length > 0) {
        setOrganizations(list);
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        const stillExists = list.some(
          (o) => o.id === saved || (o.code || '').toLowerCase() === (saved || '').toLowerCase()
        );
        // Persist a real, existing org id so the ApiClient always sends a valid
        // X-Organization-Id header (keeps project queries consistently org-scoped).
        const resolvedId = stillExists ? saved : list[0].id;
        try {
          localStorage.setItem(STORAGE_KEY, resolvedId);
        } catch (e) {
          // ignore
        }
        setCurrentOrgId(resolvedId);
      }
    } catch (e) {
      console.error('Failed to load organizations', e);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  const currentOrganization =
    organizations.find((o) => o.id === currentOrgId) || organizations[0] || EMPTY_ORGANIZATION;

  const toggleFavorite = useCallback((orgId: string) => {
    setFavoriteOrgIds((prev) => {
      const exists = prev.includes(orgId);
      const next = exists ? prev.filter((id) => id !== orgId) : [...prev, orgId];
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  }, []);

  const switchOrganization = useCallback(
    (orgId: string) => {
      const target = organizations.find((o) => o.id === orgId || o.code.toLowerCase() === orgId.toLowerCase());
      if (!target) return;

      setIsLoading(true);
      setCurrentOrgId(target.id);
      
      try {
        localStorage.setItem(STORAGE_KEY, target.id);
        
        // Update recents
        setRecentOrgIds((prev) => {
          const filtered = prev.filter((id) => id !== target.id);
          const next = [target.id, ...filtered].slice(0, 5);
          localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      } catch (e) {
        // ignore
      }

      // Invalidate all TanStack Query caches to prevent tenant leakage
      queryClient.invalidateQueries();

      setTimeout(() => {
        setIsLoading(false);
        addNotification({
          type: 'info',
          title: 'Studio Context Switched',
          message: `Active organization context shifted to ${target.name} [${target.code}]. Multi-tenant boundaries and permissions updated.`,
        });
      }, 150);
    },
    [organizations, queryClient, addNotification]
  );

  const updateOrganizationSettings = async (newSettings: Partial<OrganizationSettings>) => {
    try {
      await organizationApi.updateOrganization(currentOrganization.id, {
        settings: { ...currentOrganization.settings, ...newSettings },
      });
      await refreshOrganizations();
      addNotification({
        type: 'success',
        title: 'Studio Settings Saved',
        message: 'Global pipeline, OCIO, and tenancy configurations have been updated.',
      });
    } catch (e: any) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: e.message || 'Could not update organization settings.',
      });
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        switchOrganization,
        isLoading,
        updateOrganizationSettings,
        isOrganizationAdmin: true,
        favoriteOrgIds,
        recentOrgIds,
        toggleFavorite,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextValue => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
