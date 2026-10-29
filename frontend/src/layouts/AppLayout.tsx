import { ActiveTimerBanner } from '@/modules/tasks';
import { useAuth } from '@/modules/auth';
import React, { useEffect } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Breadcrumbs } from './Breadcrumbs';
import { useProductionStore } from '@/core/production/useProductionStore';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { ProductionContextProvider } from '@/core/production/ProductionContext';
import { usePageLayoutStore } from '@/core/layout/usePageLayoutStore';
import { cn } from '@/shared/utils/cn';
import { CoachMarkOverlay, GettingStartedBanner } from '@/shared/components/CoachMarkOverlay';
import { useThemeMode } from '@/providers/ThemeProvider';

const AppLayoutInner: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { syncWithUserPreferences } = useThemeMode();
  const { setActiveProject, setActiveShow, activeProjectId } = useProductionStore();
  const { tabs, activeTabId } = useWorkspaceStore();
  const { density, containerWidth, headerSticky } = usePageLayoutStore();

  // Keep theme accent colors synced with user's saved profile preferences
  useEffect(() => {
    if (user?.theme_preferences) {
      syncWithUserPreferences(user.theme_preferences);
    }
  }, [user?.theme_preferences, syncWithUserPreferences]);

  // Keep toolbar active project and show context synchronized with current route
  useEffect(() => {
    const pathname = location.pathname;

    // Match /shows/:showId
    const directShowMatch = pathname.match(/^\/shows\/([^/]+)/);
    if (directShowMatch) {
      const showId = directShowMatch[1];
      setActiveShow(showId);
      return;
    }

    // Match /projects/:id or /projects/:id/:tab
    const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
    if (projectMatch && projectMatch[1] && projectMatch[1] !== 'new') {
      setActiveProject(projectMatch[1]);
      return;
    }

    // Match /workspace with primaryType=project
    if (pathname.startsWith('/workspace')) {
      const primaryType = searchParams.get('primaryType');
      const primaryId = searchParams.get('primaryId');
      if (primaryType === 'project' && primaryId) {
        setActiveProject(primaryId);
        return;
      }

      // Check current active workspace tab
      const currentTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
      if (currentTab?.primary?.type === 'project' && currentTab.primary.id) {
        setActiveProject(currentTab.primary.id);
      }
    }
  }, [
    location.pathname,
    searchParams.get('primaryType'),
    searchParams.get('primaryId'),
    activeTabId,
    setActiveProject,
    setActiveShow,
  ]);

  return (
    <div 
      id="studio-app-root"
      data-layout-density={density}
      data-container-width={containerWidth}
      data-sticky-header={headerSticky ? 'true' : 'false'}
      className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased font-sans transition-colors duration-200"
    >
      {/* Structural Sidebar (Left Rail) */}
      <Sidebar />

      {/* Main Content Area (Center Canvas) */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <Breadcrumbs />
        <main
          id="main-viewport-canvas"
          data-layout-density={density}
          data-container-width={containerWidth}
          data-sticky-header={headerSticky ? 'true' : 'false'}
          className={cn(
            "flex-1 overflow-y-auto min-h-0 flex flex-col custom-scrollbar transition-colors duration-200",
            containerWidth === 'contained' && "w-full items-center",
            density === 'compact' && "density-compact",
            density === 'comfortable' && "density-comfortable",
            density === 'spacious' && "density-spacious"
          )}
        >
          <div
            className={cn(
              "w-full flex-1 flex flex-col min-h-0 transition-colors duration-200",
              containerWidth === 'contained' && "max-w-7xl mx-auto px-2 sm:px-4 lg:px-6"
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Active Timer Banner */}
      <ActiveTimerBanner />

      {/* Getting Started Non-Intrusive Banner & Coach-mark Spotlight Overlay */}
      <GettingStartedBanner />
      <CoachMarkOverlay />
    </div>
  );
};

export const AppLayout: React.FC = () => {
  return (
    <ProductionContextProvider>
      <AppLayoutInner />
    </ProductionContextProvider>
  );
};

