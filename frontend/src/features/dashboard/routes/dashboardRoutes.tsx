import React from 'react';
import { RouteObject } from 'react-router-dom';
import { ProjectDashboardPage } from '../pages/ProjectDashboardPage';

export const dashboardRoutes: RouteObject[] = [
  {
    path: '/dashboard',
    element: <ProjectDashboardPage />,
  },
];
