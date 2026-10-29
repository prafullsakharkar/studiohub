import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useProductionStore } from '@/core/production/useProductionStore';
import { Show } from '@/types/production';
import { useQueryClient } from '@tanstack/react-query';
import { Film, FolderKanban, Loader2 } from 'lucide-react';

export interface ProductionContextValue {
  projectId: string | null;
  showId: string | null;
  show: Show | null;
  hasShowContext: boolean;
  isTransitioning: boolean;
  selectShow: (id: string | null) => void;
  clearShow: () => void;
}

const ProductionContext = createContext<ProductionContextValue | undefined>(undefined);

export const ProductionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeProjectId, activeShowId, setActiveShow, clearShow } = useProductionStore();
  const queryClient = useQueryClient();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const projectId = activeProjectId || null;

  // Authoritative show object referring directly to toolbar selection.
  // REST-only: project ids are backend UUIDs. Synthesize a lightweight show
  // context so production pages load; the backend scopes by project.
  const show = useMemo<Show | null>(() => {
    if (!projectId) return null;

    const now = new Date().toISOString();
    return {
      id: activeShowId || `show-${projectId}-main`,
      project_id: projectId,
      organization_id: '',
      name: '',
      code: '',
      type: 'Feature Film',
      description: '',
      status: 'In Progress',
      total_shots: 0,
      approved_shots: 0,
      in_progress_shots: 0,
      total_assets: 0,
      created_at: now,
      updated_at: now,
    };
  }, [projectId, activeShowId]);

  // Keep activeShowId synced with authoritative show in production store
  useEffect(() => {
    if (show && show.id !== activeShowId) {
      setActiveShow(show.id);
    }
  }, [show?.id, activeShowId, setActiveShow]);

  const hasShowContext = Boolean(projectId && show);

  const handleSelectShow = (newShowId: string | null) => {
    if (newShowId === activeShowId) return;

    setIsTransitioning(true);

    // Invalidate old show queries to prevent stale data leakage
    if (projectId && activeShowId) {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'shows', activeShowId],
      });
    }

    setActiveShow(newShowId);

    // Brief transition delay to allow cache invalidation & clean state reset
    setTimeout(() => {
      setIsTransitioning(false);
    }, 150);
  };

  const handleClearShow = () => {
    setIsTransitioning(true);
    clearShow();
    setTimeout(() => {
      setIsTransitioning(false);
    }, 100);
  };

  const value = useMemo<ProductionContextValue>(
    () => ({
      projectId,
      showId: show ? show.id : null,
      show,
      hasShowContext,
      isTransitioning,
      selectShow: handleSelectShow,
      clearShow: handleClearShow,
    }),
    [projectId, show, hasShowContext, isTransitioning, activeShowId]
  );

  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>;
};

export const useProductionContext = (): ProductionContextValue => {
  const ctx = useContext(ProductionContext);
  if (!ctx) {
    // Fallback if rendered outside provider — REST-only, derive from ids.
    const { activeProjectId, activeShowId, setActiveShow, clearShow } = useProductionStore.getState();
    const showId = activeShowId || (activeProjectId ? `show-${activeProjectId}-main` : null);
    const now = new Date().toISOString();
    const show = activeProjectId
      ? ({
          id: showId,
          project_id: activeProjectId,
          organization_id: '',
          name: '',
          code: '',
          type: 'Feature Film',
          description: '',
          status: 'In Progress',
          total_shots: 0,
          approved_shots: 0,
          in_progress_shots: 0,
          total_assets: 0,
          created_at: now,
          updated_at: now,
        } as Show)
      : null;
    return {
      projectId: activeProjectId || null,
      showId,
      show,
      hasShowContext: Boolean(activeProjectId),
      isTransitioning: false,
      selectShow: setActiveShow,
      clearShow,
    };
  }
  return ctx;
};

export interface ProductionContextGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProductionContextGuard: React.FC<ProductionContextGuardProps> = ({ children, fallback }) => {
  const { projectId, show, hasShowContext, isTransitioning } = useProductionContext();

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-500/5">
          <FolderKanban className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">No Project Selected</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Please select a project from the toolbar project switcher to begin accessing production entity data.
        </p>
      </div>
    );
  }

  if (isTransitioning) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 animate-pulse">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-1">Switching Show Context...</h3>
        <p className="text-xs text-slate-500">Clearing stale data &amp; initializing show context.</p>
      </div>
    );
  }

  if (!hasShowContext || !show) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 shadow-xl shadow-cyan-500/5">
          <Film className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono mb-3">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          Production Context Required
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">No Show Selected</h2>
        <p className="text-sm text-slate-400 max-w-md mb-2 leading-relaxed">
          Production entities (shots, assets, tasks, sequences, versions, reviews) are isolated by show context.
          Please select a show from the toolbar above to load production page data.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
