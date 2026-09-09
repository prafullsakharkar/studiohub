import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { OrganizationProvider } from '@/core/organization/OrganizationContext';
import { AppRoutes } from '@/routes/AppRoutes';
import { ToastContainer } from '@/shared/components/ToastContainer';

export default function App() {
  return (
    <QueryProvider>
      <ThemeProvider defaultMode="dark">
        <AuthProvider>
          <OrganizationProvider>
            <BrowserRouter>
              <AppRoutes />
              <ToastContainer />
            </BrowserRouter>
          </OrganizationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
