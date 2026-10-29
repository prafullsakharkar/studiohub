import React from 'react';
import { ProjectDashboardPage } from '@/features/dashboard';

/**
 * Project Context-Aware VFX Production Command Center.
 * Scoped strictly to the active project in useProductionStore.
 */
export const DashboardPage: React.FC = () => {
  return <ProjectDashboardPage />;
};

export default DashboardPage;
