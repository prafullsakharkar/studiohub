import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { WorkspaceTabs } from './WorkspaceTabs';
import { ContextBar } from './ContextBar';
import { WorkspaceHeader } from './WorkspaceHeader';
import { SplitView } from './SplitView';
import { PeekPanel } from './PeekPanel';
import { EntityDrawer } from './EntityDrawer';
import { ContextStack } from './ContextStack';
import { UniversalEntitySearchModal } from './UniversalEntitySearchModal';

interface WorkspaceProps {
  initialEntityType?: string;
  initialEntityId?: string;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  initialEntityType,
  initialEntityId,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isStackOpen, setIsStackOpen] = useState(false);

  const {
    tabs,
    activeTabId,
    syncWithUrlParams,
    openInWorkspace,
    navigateTabHistory,
    closeTab,
    openTab,
  } = useWorkspaceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Sync URL query params on initial mount
  useEffect(() => {
    const primaryType = searchParams.get('primaryType') || initialEntityType;
    const primaryId = searchParams.get('primaryId') || initialEntityId;
    const secondaryType = searchParams.get('secondaryType') || undefined;
    const secondaryId = searchParams.get('secondaryId') || undefined;
    const view = searchParams.get('view') || undefined;
    const drawerType = searchParams.get('drawerType') || undefined;
    const drawerId = searchParams.get('drawerId') || undefined;
    const drawerTab = searchParams.get('drawerTab') || undefined;

    if (primaryType && primaryId) {
      syncWithUrlParams({
        primaryType,
        primaryId,
        secondaryType,
        secondaryId,
        view,
        drawerType,
        drawerId,
        drawerTab,
      });
    }
  }, []);

  // Sync URL search params whenever active tab or split state changes
  useEffect(() => {
    if (!activeTab) return;

    const newParams = new URLSearchParams();
    newParams.set('primaryType', activeTab.primary.type);
    newParams.set('primaryId', activeTab.primary.id);

    if (activeTab.isSplit && activeTab.secondary) {
      newParams.set('view', 'split');
      newParams.set('secondaryType', activeTab.secondary.type);
      newParams.set('secondaryId', activeTab.secondary.id);
    }

    setSearchParams(newParams, { replace: true });
  }, [activeTab?.primary?.id, activeTab?.primary?.type, activeTab?.isSplit, activeTab?.secondary?.id]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K => Quick Search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }

      // Cmd/Ctrl + T => New Tab
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        openTab({
          id: 'proj-001',
          type: 'project',
          title: 'Cyberpunk 2099',
          code: 'NK99',
        });
      }

      // Cmd/Ctrl + W => Close active tab (if > 1 tab)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w' && tabs.length > 1) {
        e.preventDefault();
        closeTab(activeTabId);
      }

      // Alt + Left => Back
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateTabHistory(activeTabId, 'back');
      }

      // Alt + Right => Forward
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        navigateTabHistory(activeTabId, 'forward');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs.length, closeTab, openTab, navigateTabHistory]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 overflow-hidden font-sans select-none">
      {/* 1. Multi-Tab Navigation Bar */}
      <WorkspaceTabs onNewTabClick={() => setIsSearchOpen(true)} />

      {/* 2. Non-Linear Relational Context Trail */}
      <ContextBar
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenContextStack={() => setIsStackOpen(true)}
      />

      {/* 3. Entity Header & Mode Controllers */}
      <WorkspaceHeader onSearchClick={() => setIsSearchOpen(true)} />

      {/* 4. Main Workspace Viewport (Full or Split View) */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeTab ? (
          <SplitView tab={activeTab} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 font-mono">
            No active workspace tab selected.
          </div>
        )}
      </div>

      {/* 5. Non-Linear Peek Panel Modal */}
      <PeekPanel />

      {/* 6. Sliding Inspector Drawer */}
      <EntityDrawer />

      {/* 7. Context Stack History Visualizer */}
      <ContextStack isOpen={isStackOpen} onClose={() => setIsStackOpen(false)} />

      {/* 8. Global Universal Search Modal */}
      <UniversalEntitySearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
};
