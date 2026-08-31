import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Organization, OrganizationSettings } from '@/types/organization';
import { mockOrganizations } from '@/mocks/db/organization/organization';
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

export const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<Organization[]>(mockOrganizations);
  
  const [favoriteOrgIds, setFavoriteOrgIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : ['org-apex-01'];
    } catch {
      return ['org-apex-01'];
    }
  });

  const [recentOrgIds, setRecentOrgIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : ['org-apex-01', 'org-vanguard-02'];
    } catch {
      return ['org-apex-01', 'org-vanguard-02'];
    }
  });

  const [currentOrgId, setCurrentOrgId] = useState<string>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const exists = mockOrganizations.some((o) => o.id === saved);
    return exists && saved ? saved : mockOrganizations[0].id;
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
        const stillExists = list.some((o) => o.id === saved || o.code.toLowerCase() === (saved || '').toLowerCase());
        if (saved && !stillExists) {
          setCurrentOrgId(list[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load organizations', e);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  const currentOrganization =
    organizations.find((o) => o.id === currentOrgId) || organizations[0] || mockOrganizations[0];

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
