import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/shared/layouts/PageLayout';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { PermissionMatrix } from '@/components/permissions/PermissionMatrix';
import { LayoutSettingsSection } from '../components/LayoutSettingsSection';
import {
  Lock,
  ArrowLeft,
  Building2,
  Sliders,
  ShieldCheck,
  Layout,
  Layers,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export const RolesSecurityPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'matrix' | 'layout'>('matrix');

  return (
    <PageLayout id="roles-security-root">
      {/* Studio Header Bar matching Organization spacing and margins */}
      <PageLayout.Header>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/organizations/org-apex')}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
              title="Back to Studio Organization"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Roles & Security
                </h1>
                <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
                  RBAC Matrix
                </Badge>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Policy Engine Active
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Apex Digital Studios (org-apex)</span>
                <span>/</span>
                <span className="text-indigo-400">Security & Governance Matrix</span>
              </div>
            </div>
          </div>

          <PageLayout.Actions>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Sliders className="w-3.5 h-3.5" />}
              onClick={() => navigate('/settings')}
            >
              Pipeline & Settings
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
              onClick={() => navigate('/access')}
            >
              Access Workspace
            </Button>
          </PageLayout.Actions>
        </div>

        {/* Tab Navigation strip matching Organization tabs */}
        <PageLayout.Tabs>
          <button
            onClick={() => setActiveTab('matrix')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs',
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            )}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Security Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('layout')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs',
              activeTab === 'layout'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            )}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Default Page Layout</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Pipeline Settings</span>
          </button>

          <button
            onClick={() => navigate('/access')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Access Workspace</span>
          </button>
        </PageLayout.Tabs>
      </PageLayout.Header>

      {/* Main Workspace Body matching Organization margin & padding */}
      <PageLayout.Body>
        {activeTab === 'matrix' && <PermissionMatrix />}
        {activeTab === 'layout' && <LayoutSettingsSection />}
      </PageLayout.Body>
    </PageLayout>
  );
};
