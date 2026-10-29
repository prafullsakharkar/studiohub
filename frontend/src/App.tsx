import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { AppRoutes } from '@/routes/AppRoutes';
import { ToastContainer } from '@/shared/components/ToastContainer';
import { ErrorBoundary } from '@/core/errors/ErrorBoundary';
import { GlobalApiStatus } from '@/components/system/GlobalApiStatus';

export default function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ThemeProvider defaultMode="dark">
          <AuthProvider>
            <BrowserRouter>
              <GlobalApiStatus />
              <AppRoutes />
              <ToastContainer />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
