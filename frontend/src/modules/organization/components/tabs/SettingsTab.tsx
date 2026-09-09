import React, { useState } from 'react';
import { Sliders, ShieldCheck, HardDrive, Cpu, Save, AlertTriangle } from 'lucide-react';
import { Organization } from '@/types/organization';
import { Button } from '@/shared/components/Button';
import { useOrganizationMutations } from '../../hooks/useOrganizationMutations';
import { useOrganization } from '@/core/organization/useOrganization';

export const SettingsTab: React.FC<{ org: Organization }> = ({ org }) => {
  const { updateOrganization, isUpdating } = useOrganizationMutations();
  const { refreshOrganizations } = useOrganization();

  const [settings, setSettings] = useState({
    default_fps: org.settings?.default_fps ?? 24,
    default_color_space: org.settings?.default_color_space ?? 'ACEScg / ACES 1.3',
    default_resolution: org.settings?.default_resolution ?? '3840x2160 (UHD)',
    usd_schema_version: org.settings?.usd_schema_version ?? 'OpenUSD 24.08',
    render_farm_region: org.settings?.render_farm_region ?? 'us-west-2 (AWS Farm)',
    allow_guest_reviewers: org.settings?.allow_guest_reviewers ?? true,
    enable_two_factor: org.settings?.enable_two_factor ?? true,
    sso_enforced: org.settings?.sso_enforced ?? true,
  });

  const handleSave = async () => {
    await updateOrganization({
      id: org.id,
      data: {
        settings,
      },
    });
    await refreshOrganizations();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            Studio Pipeline & Security Defaults
          </h2>
          <p className="text-xs text-slate-400">
            Global configurations automatically applied across all production shows and render dispatchers for this tenant.
          </p>
        </div>

        {/* Form Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Default Production FPS</label>
            <select
              value={settings.default_fps}
              onChange={(e) => setSettings({ ...settings, default_fps: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value={24}>24 FPS (Film / Streaming Master)</option>
              <option value={23.976}>23.976 FPS (NTSC Broadcast)</option>
              <option value={25}>25 FPS (PAL / Europe)</option>
              <option value={29.97}>29.97 FPS (Commercials)</option>
              <option value={60}>60 FPS (HFR Cinematics)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">OCIO Color Transform Target</label>
            <select
              value={settings.default_color_space}
              onChange={(e) => setSettings({ ...settings, default_color_space: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ACEScg / ACES 1.3">ACEScg / ACES 1.3 (Recommended VFX)</option>
              <option value="ACES2065-1">ACES2065-1 (Archival Linear)</option>
              <option value="DCI-P3 D65">DCI-P3 D65 (Theatrical Reference)</option>
              <option value="Rec.709 / sRGB">Rec.709 / sRGB</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Default Resolution Raster</label>
            <select
              value={settings.default_resolution}
              onChange={(e) => setSettings({ ...settings, default_resolution: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="4096x2160 (4K DCI)">4096x2160 (4K DCI Container)</option>
              <option value="3840x2160 (UHD)">3840x2160 (UHD 16:9)</option>
              <option value="2048x1080 (2K DCI)">2048x1080 (2K DCI)</option>
              <option value="1920x1080 (HD)">1920x1080 (1080p HD)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">OpenUSD Hydra Schema</label>
            <select
              value={settings.usd_schema_version}
              onChange={(e) => setSettings({ ...settings, usd_schema_version: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="OpenUSD 24.08">OpenUSD 24.08 (Latest Hydra 2.0)</option>
              <option value="OpenUSD 24.05">OpenUSD 24.05 (ASWF 2024 Reference)</option>
              <option value="OpenUSD 23.11">OpenUSD 23.11 (Legacy 2023)</option>
            </select>
          </div>
        </div>

        {/* Security Checkboxes */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-white">Enforce Two-Factor Authentication (2FA)</div>
              <div className="text-[11px] text-slate-400">Requires all crew accounts to pass TOTP verification.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.enable_two_factor}
              onChange={(e) => setSettings({ ...settings, enable_two_factor: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-white">Enterprise SAML 2.0 / Okta SSO Required</div>
              <div className="text-[11px] text-slate-400">Enforce corporate identity provider for login.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.sso_enforced}
              onChange={(e) => setSettings({ ...settings, sso_enforced: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-white">Guest Client Dailies Access</div>
              <div className="text-[11px] text-slate-400">Allow studio-approved client links with dynamic burn-in.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.allow_guest_reviewers}
              onChange={(e) => setSettings({ ...settings, allow_guest_reviewers: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
            />
          </label>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <Button variant="primary" size="sm" isLoading={isUpdating} onClick={handleSave} leftIcon={<Save className="w-4 h-4" />}>
            Save Pipeline Settings
          </Button>
        </div>
      </div>
    </div>
  );
};
