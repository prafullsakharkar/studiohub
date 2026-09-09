import React, { useState, useEffect, useRef } from 'react';
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
import { settingsService } from '@/modules/settings/api/SettingsService';

type FarmEngine = 'Deadline' | 'Tractor' | 'OpenCue';

interface PipelineSettings {
  default_fps: number;
  default_color_space: string;
  default_resolution: string;
  usd_schema_version: string;
  ocio_config_path: string;
  farm_engine: FarmEngine;
  storage_mount_path: string;
  enable_ai_denoising: boolean;
  enable_auto_transcode: boolean;
  enable_webhooks: boolean;
}

const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
  default_fps: 24,
  default_color_space: 'ACEScg - ACES 1.3',
  default_resolution: '4096x2160',
  usd_schema_version: 'OpenUSD v24.08',
  ocio_config_path: '/opt/studiohub/ocio/aces_1.3/config.ocio',
  farm_engine: 'Deadline',
  storage_mount_path: '/mnt/studiohub/shows',
  enable_ai_denoising: true,
  enable_auto_transcode: true,
  enable_webhooks: false,
};

function parseStoredValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function buildSettings(rows: any[]): PipelineSettings {
  const next = { ...DEFAULT_PIPELINE_SETTINGS };
  for (const row of rows) {
    const code = row.setting_code ?? '';
    const key = code.replace(/^pipeline\./, '');
    let parsed = parseStoredValue(row.value);
    if (row.setting_data_type === 'boolean') {
      parsed = parsed === true || parsed === 'true';
    }
    if (key in next && parsed !== null && parsed !== undefined) {
      (next as any)[key] = parsed;
    }
  }
  return next;
}

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [settings, setSettings] = useState<PipelineSettings>(DEFAULT_PIPELINE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const settingMetaRef = useRef<Record<string, { id: string; value: unknown }>>({});

  useEffect(() => {
    let mounted = true;
    settingsService
      .getSystemSettingsList()
      .then((rows) => {
        if (!mounted) return;
        const meta: Record<string, { id: string; value: unknown }> = {};
        for (const row of rows) {
          const code = row.setting_code ?? '';
          const key = code.replace(/^pipeline\./, '');
          meta[key] = { id: row.id ?? row.uuid, value: parseStoredValue(row.value) };
        }
        settingMetaRef.current = meta;
        setSettings(buildSettings(rows));
      })
      .catch((err) => {
        console.error('[SettingsPage] Failed to load settings:', err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const meta = settingMetaRef.current;
    const updates = Object.entries(meta)
      .filter(([key]) => key in settings)
      .map(([key, entry]) => ({
        id: entry.id,
        key,
        value: (settings as any)[key],
        changed: entry.value !== (settings as any)[key],
      }))
      .filter((u) => u.changed);
    try {
      await Promise.all(updates.map((u) => settingsService.updateSystemSetting(u.id, u.value)));
      addNotification({
        type: 'success',
        title: 'Pipeline Settings Synced',
        message: updates.length
          ? `${updates.length} pipeline setting${updates.length > 1 ? 's' : ''} saved.`
          : 'No changes to save.',
      });
    } catch (err) {
      console.error('[SettingsPage] Failed to save settings:', err);
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: 'Could not sync pipeline settings.',
      });
    } finally {
      setIsSaving(false);
    }
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

      {isLoading && <div className="text-sm text-slate-400">Loading pipeline settings…</div>}

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
