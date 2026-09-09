import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';

// Foundation Apps Pages
import { UsersPage } from '@/modules/identity/pages/UsersPage';
import { RolesPage } from '@/modules/identity/pages/RolesPage';
import { OrganizationsPage } from '@/modules/organization/pages/OrganizationsPage';
import { SettingsPage } from '@/modules/settings/pages/SettingsPage';
import { AuditLogsPage } from '@/modules/audit/pages/AuditLogsPage';

export const FoundationRoutes: React.FC = () => {
    return (
        <Routes>
            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    <Route path="/foundation/users" element={<UsersPage />} />
                    <Route path="/foundation/roles" element={<RolesPage />} />
                    <Route path="/foundation/organizations" element={<OrganizationsPage />} />
                    <Route path="/foundation/settings" element={<SettingsPage />} />
                    <Route path="/foundation/audit" element={<AuditLogsPage />} />
                </Route>
            </Route>
        </Routes>
    );
};
