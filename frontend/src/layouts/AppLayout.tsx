import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Breadcrumbs } from './Breadcrumbs';
import { InspectorDrawer } from '@/shared/components/InspectorDrawer';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased font-sans">
      {/* Structural Sidebar (Left Rail) */}
      <Sidebar />

      {/* Main Content Area (Center Canvas) */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <Breadcrumbs />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 custom-scrollbar">
          <Outlet />
        </main>
      </div>

      {/* Right-Pane Deep Dive Inspector Drawer */}
      <InspectorDrawer />
    </div>
  );
};

