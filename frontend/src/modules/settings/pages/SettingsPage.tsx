import React, { useState } from 'react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
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
} from 'lucide-react';
import { mockPipelineSettings, PipelineSettings } from '@/mocks/db/settings/settings';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [settings, setSettings] = useState<PipelineSettings>(mockPipelineSettings);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Studio Pipeline & Environment Settings</h1>
          <p className="text-xs text-slate-400">
            OpenColorIO (OCIO) profiles, OpenUSD versioning, render farm connectors, and storage mounts
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          isLoading={isSaving}
          leftIcon={<Save className="w-4 h-4" />}
        >
          Save Configuration
        </Button>
      </div>

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
              <p className="text-sm font-bold text-white">{user?.first_name} {user?.last_name}</p>
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
                <label className="text-xs font-semibold text-slate-300">Default Working Color Space</label>
                <select
                  value={settings.default_color_space}
                  onChange={(e) => setSettings({ ...settings, default_color_space: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ACEScg - ACES 1.3">ACEScg (ACES 1.3 Academy Color Encoding System)</option>
                  <option value="ACES 2.0 Candidate">ACES 2.0 (Candidate Release)</option>
                  <option value="Rec.709 - ITU-R BT.709">Rec.709 / BT.709 Standard Dynamic Range</option>
                  <option value="ARRI LogC4 / Wide Gamut 4">ARRI LogC4 / Wide Gamut 4</option>
                  <option value="REDWideGamutRGB / Log3G10">REDWideGamutRGB / Log3G10</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Default Timebase / FPS</label>
                <select
                  value={settings.default_fps}
                  onChange={(e) => setSettings({ ...settings, default_fps: Number(e.target.value) })}
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
              <label className="text-xs font-semibold text-slate-300">OCIO Config File Path</label>
              <input
                type="text"
                value={settings.ocio_config_path}
                onChange={(e) => setSettings({ ...settings, ocio_config_path: e.target.value })}
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
                <label className="text-xs font-semibold text-slate-300">USD Schema Specification</label>
                <select
                  value={settings.usd_schema_version}
                  onChange={(e) => setSettings({ ...settings, usd_schema_version: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="OpenUSD v24.08">OpenUSD v24.08 (Hydra 2.0 + MaterialX 1.38)</option>
                  <option value="OpenUSD v23.11">OpenUSD v23.11 (LTS)</option>
                  <option value="OpenUSD v22.11">OpenUSD v22.11 (Legacy Compatibility)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Default Resolution Buffer</label>
                <select
                  value={settings.default_resolution}
                  onChange={(e) => setSettings({ ...settings, default_resolution: e.target.value })}
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
              <label className="text-xs font-semibold text-slate-300">Central SAN / NAS Storage Root Path</label>
              <input
                type="text"
                value={settings.storage_mount_path}
                onChange={(e) => setSettings({ ...settings, storage_mount_path: e.target.value })}
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
              <label className="text-xs font-semibold text-slate-300">Render Farm Management Engine</label>
              <select
                value={settings.farm_engine}
                onChange={(e) => setSettings({ ...settings, farm_engine: e.target.value as any })}
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
                  onChange={(e) => setSettings({ ...settings, enable_ai_denoising: e.target.checked })}
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
                  onChange={(e) => setSettings({ ...settings, enable_auto_transcode: e.target.checked })}
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
                  onChange={(e) => setSettings({ ...settings, enable_webhooks: e.target.checked })}
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
    </div>
  );
};
