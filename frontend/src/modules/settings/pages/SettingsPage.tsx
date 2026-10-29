import { useAuth } from '@/modules/auth';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { PageLayout } from '@/shared/layouts/PageLayout';
import { usePermissions } from '@/core/permissions/usePermissions';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { LayoutSettingsSection } from '../components/LayoutSettingsSection';
import { DatabaseSchemaSection } from '../components/DatabaseSchemaSection';
import { ThemeEditorSection } from '../components/ThemeEditorSection';
import {
  Sliders,
  Database,
  Layers,
  Server,
  FolderTree,
  Sparkles,
  Shield,
  Save,
  CheckCircle,
  HardDrive,
  Cpu,
  Key,
  ArrowLeft,
  Building2,
  Lock,
  Layout,
  ShieldCheck,
  ShieldAlert,
  Palette,
} from 'lucide-react';
import { PipelineSettings } from '@/types/system';
import { cn } from '@/shared/utils/cn';

const defaultPipelineSettings: PipelineSettings = {
  default_fps: 24,
  default_color_space: 'ACEScg - ACES 1.3',
  default_resolution: '4096x2160',
  usd_schema_version: 'OpenUSD v24.08',
  ocio_config_path: '/mnt/pipeline/ocio/aces_1.3/config.ocio',
  farm_engine: 'Deadline',
  storage_mount_path: '/mnt/production/storage/apex_vfx',
  enable_ai_denoising: true,
  enable_auto_transcode: true,
  enable_webhooks: true,
};

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);

  // ADR-0033: no local superuser/role-name heuristics — the canonical engine
  // applies the break-glass rule itself.
  const canViewSettings = can('settings.view') || can('page.settings');
  const canUpdateSettings = can('settings.update') || can('settings.manage');
  const canViewRbac = can('roles.manage') || can('security.manage') || can('page.permissions');
  const canViewDatabase = can('platform.admin.view');

  const [activeTab, setActiveTab] = useState<'pipeline' | 'theme' | 'layout' | 'database'>('pipeline');
  const [settings, setSettings] = useState<PipelineSettings>(defaultPipelineSettings);
  const [isSaving, setIsSaving] = useState(false);

  if (!canViewSettings) {
    return (
      <PageLayout id="pipeline-settings-root">
        <PageLayout.Header>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Pipeline & Settings</h1>
              <p className="text-xs text-slate-400">Restricted Section</p>
            </div>
          </div>
        </PageLayout.Header>
        <PageLayout.Body>
          <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-xl">
            <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h2 className="text-base font-bold text-white mb-2">Access Restricted</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Pipeline settings, color science configuration, and role simulation tools are restricted for your role. Please contact a Production Supervisor or Pipeline TD for assistance.
            </p>
            <Button variant="primary" onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        </PageLayout.Body>
      </PageLayout>
    );
  }

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canUpdateSettings) return;
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      addNotification({
        type: 'success',
        title: 'Pipeline Settings Synced',
        message: 'OpenUSD and ACES Color management configuration saved.',
      });
    }, 400);
  };

  return (
    <PageLayout id="pipeline-settings-root">
      {/* Studio Header Bar matching Organization spacing and margin */}
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
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Pipeline & Settings
                </h1>
                <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
                  OpenUSD v24.08
                </Badge>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACES 1.3 Color Science
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Apex Digital Studios (org-apex)</span>
                <span>/</span>
                <span className="text-indigo-400">Core Pipeline Engine & Layout</span>
              </div>
            </div>
          </div>

          <PageLayout.Actions>
            {activeTab === 'pipeline' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSave()}
                isLoading={isSaving}
                disabled={!canUpdateSettings}
                title={!canUpdateSettings ? 'Permission settings.update required' : undefined}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Configuration
              </Button>
            )}
          </PageLayout.Actions>
        </div>

        {/* Tab Navigation strip matching Organization tabs */}
        <PageLayout.Tabs>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs cursor-pointer',
              activeTab === 'pipeline'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            )}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Pipeline & Color Science</span>
          </button>

          <button
            id="settings-theme-tab-btn"
            onClick={() => setActiveTab('theme')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs cursor-pointer',
              activeTab === 'theme'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            )}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Theme & Accent Colors</span>
          </button>

          <button
            onClick={() => setActiveTab('layout')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs cursor-pointer',
              activeTab === 'layout'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            )}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Default Page Layout</span>
          </button>

          {canViewDatabase && (
            <button
              onClick={() => setActiveTab('database')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs cursor-pointer',
                activeTab === 'database'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              )}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Mock DB Schema & Export</span>
            </button>
          )}

          {canViewRbac && (
            <>
              <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />
              <button
                onClick={() => navigate('/access')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Access Workspace</span>
              </button>
            </>
          )}
        </PageLayout.Tabs>
      </PageLayout.Header>

      {/* Main Workspace Body matching Organization margin & padding */}
      <PageLayout.Body>
        {activeTab === 'theme' && <ThemeEditorSection />}

        {activeTab === 'database' && <DatabaseSchemaSection />}

        {activeTab === 'layout' && <LayoutSettingsSection />}

        {activeTab === 'pipeline' && (
          <form onSubmit={handleSave} className="space-y-6">
            {/* User Account Profile */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  Active Session & Role Credential
                </h3>
              </CardHeader>
              <CardBody className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-slate-400">Name</span>
                  <p className="text-sm font-bold text-white">
                    {user?.first_name} {user?.last_name}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-400">Email Address</span>
                  <p className="text-sm font-mono text-indigo-300">{user?.email}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-400">Active Role</span>
                  <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {user?.role}
                  </span>
                </div>
              </CardBody>
            </Card>

            {/* Color Management & OCIO */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  OpenColorIO (OCIO) & Color Science
                </h3>
              </CardHeader>
              <CardBody className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Default Working Color Space
                    </label>
                    <select
                      value={settings.default_color_space}
                      onChange={(e) =>
                        setSettings({ ...settings, default_color_space: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ACEScg - ACES 1.3">
                        ACEScg (ACES 1.3 Academy Color Encoding System)
                      </option>
                      <option value="ACES 2.0 Candidate">ACES 2.0 (Candidate Release)</option>
                      <option value="Rec.709 - ITU-R BT.709">
                        Rec.709 / BT.709 Standard Dynamic Range
                      </option>
                      <option value="ARRI LogC4 / Wide Gamut 4">ARRI LogC4 / Wide Gamut 4</option>
                      <option value="REDWideGamutRGB / Log3G10">REDWideGamutRGB / Log3G10</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Default Timebase / FPS
                    </label>
                    <select
                      value={settings.default_fps}
                      onChange={(e) =>
                        setSettings({ ...settings, default_fps: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={24}>24.000 FPS (Film Standard)</option>
                      <option value={23.976}>23.976 FPS (NTSC Film Standard)</option>
                      <option value={25}>25.000 FPS (PAL Broadcast)</option>
                      <option value={29.97}>29.970 FPS (NTSC Broadcast)</option>
                      <option value={60}>60.000 FPS (High Frame Rate / Game Cinematics)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    OCIO Config File Path
                  </label>
                  <input
                    type="text"
                    value={settings.ocio_config_path}
                    onChange={(e) =>
                      setSettings({ ...settings, ocio_config_path: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm font-mono text-emerald-400 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </CardBody>
            </Card>

            {/* OpenUSD & Pipeline Resolver */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  OpenUSD Architecture & Asset Resolver
                </h3>
              </CardHeader>
              <CardBody className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      USD Schema Specification
                    </label>
                    <select
                      value={settings.usd_schema_version}
                      onChange={(e) =>
                        setSettings({ ...settings, usd_schema_version: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="OpenUSD v24.08">
                        OpenUSD v24.08 (Hydra 2.0 + MaterialX 1.38)
                      </option>
                      <option value="OpenUSD v23.11">OpenUSD v23.11 (LTS)</option>
                      <option value="OpenUSD v22.11">OpenUSD v22.11 (Legacy Compatibility)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Default Resolution Buffer
                    </label>
                    <select
                      value={settings.default_resolution}
                      onChange={(e) =>
                        setSettings({ ...settings, default_resolution: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="4096x2160">4096 x 2160 (DCI 4K)</option>
                      <option value="3840x2160">3840 x 2160 (UHD 4K)</option>
                      <option value="2048x1080">2048 x 1080 (DCI 2K)</option>
                      <option value="1920x1080">1920 x 1080 (Full HD)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Central SAN / NAS Storage Root Path
                  </label>
                  <input
                    type="text"
                    value={settings.storage_mount_path}
                    onChange={(e) =>
                      setSettings({ ...settings, storage_mount_path: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm font-mono text-indigo-400 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </CardBody>
            </Card>

            {/* Compute & Automation */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  Render Farm & Automation Dispatch
                </h3>
              </CardHeader>
              <CardBody className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Render Farm Management Engine
                  </label>
                  <select
                    value={settings.farm_engine}
                    onChange={(e) =>
                      setSettings({ ...settings, farm_engine: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Deadline">AWS Thinkbox Deadline 10.3</option>
                    <option value="Tractor">Pixar Tractor 2.4</option>
                    <option value="OpenCue">ASWF OpenCue v0.14</option>
                  </select>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enable_ai_denoising}
                      onChange={(e) =>
                        setSettings({ ...settings, enable_ai_denoising: e.target.checked })
                      }
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-300">
                      Enable AI Multi-pass Deep Learning Denoising on Arnold / Karma render passes
                    </span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enable_auto_transcode}
                      onChange={(e) =>
                        setSettings({ ...settings, enable_auto_transcode: e.target.checked })
                      }
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-300">
                      Automatically generate H.264 / ProRes 422 web review proxies on EXR publish
                    </span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enable_webhooks}
                      onChange={(e) =>
                        setSettings({ ...settings, enable_webhooks: e.target.checked })
                      }
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-300">
                      Broadcast Shotgun/FTrack compatible webhooks on supervisor status changes
                    </span>
                  </label>
                </div>
              </CardBody>
            </Card>
          </form>
        )}
      </PageLayout.Body>
    </PageLayout>
  );
};
