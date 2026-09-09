import React, { useState } from 'react';
import { Palette, Image as ImageIcon, Sparkles, Check, Globe, Sliders } from 'lucide-react';
import { Organization } from '@/types/organization';
import { Button } from '@/shared/components/Button';
import { useOrganizationMutations } from '../../hooks/useOrganizationMutations';
import { useOrganization } from '@/core/organization/useOrganization';

const PRESET_THEME_COLORS = [
  { name: 'Apex Indigo', hex: '#6366f1', class: 'bg-indigo-500' },
  { name: 'Cyber Emerald', hex: '#10b981', class: 'bg-emerald-500' },
  { name: 'Vanguard Amber', hex: '#f59e0b', class: 'bg-amber-500' },
  { name: 'Nebula Cyan', hex: '#06b6d4', class: 'bg-cyan-500' },
  { name: 'Crimson VFX', hex: '#ef4444', class: 'bg-rose-500' },
  { name: 'Solar Purple', hex: '#a855f7', class: 'bg-purple-500' },
];

export const BrandingTab: React.FC<{ org: Organization }> = ({ org }) => {
  const { updateOrganization, isUpdating } = useOrganizationMutations();
  const { refreshOrganizations } = useOrganization();

  const [selectedColor, setSelectedColor] = useState(PRESET_THEME_COLORS[0].hex);
  const [logoUrl, setLogoUrl] = useState(org.logo_url);
  const [bannerUrl, setBannerUrl] = useState(org.banner_url || '');
  const [watermarkText, setWatermarkText] = useState(`${org.name} • CONFIDENTIAL`);

  const handleSaveBranding = async () => {
    await updateOrganization({
      id: org.id,
      data: {
        logo_url: logoUrl,
        banner_url: bannerUrl,
      },
    });
    await refreshOrganizations();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-400" />
            Studio Brand Identity & Review Screening Room Visuals
          </h2>
          <p className="text-xs text-slate-400">
            Configure how your studio looks inside external client screening portals, daily PDF turnover packages, and review sessions.
          </p>
        </div>

        {/* Live Preview Card */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-300">Client Portal Banner Preview</span>
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden relative shadow-lg">
            <div className="h-32 w-full relative">
              {bannerUrl ? (
                <img src={bannerUrl} alt="" className="w-full h-full object-cover opacity-60" />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
            </div>

            <div className="p-4 relative -mt-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={logoUrl || org.logo_url}
                  alt=""
                  className="w-14 h-14 rounded-xl object-cover ring-2 ring-slate-800 bg-slate-900 shadow-xl"
                />
                <div>
                  <h3 className="font-bold text-sm text-white">{org.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>{org.headquarters}</span>
                    <span>•</span>
                    <span className="font-mono text-indigo-400">Secure Screening Portal</span>
                  </div>
                </div>
              </div>

              <div className="px-3 py-1 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-amber-400">
                Watermark: {watermarkText}
              </div>
            </div>
          </div>
        </div>

        {/* Asset Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Studio Logo URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Banner Backdrop URL</label>
            <input
              type="url"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">Screening Room Burn-in Watermark</label>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Theme Accent Color Swatches */}
        <div className="space-y-2 pt-4 border-t border-slate-800">
          <label className="block text-xs font-medium text-slate-300">Studio Theme Color Accent</label>
          <div className="flex items-center gap-3">
            {PRESET_THEME_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelectedColor(c.hex)}
                className={`w-8 h-8 rounded-lg ${c.class} flex items-center justify-center transition-transform hover:scale-105 ring-2 ${
                  selectedColor === c.hex ? 'ring-white' : 'ring-transparent'
                }`}
                title={c.name}
              >
                {selectedColor === c.hex && <Check className="w-4 h-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <Button variant="primary" size="sm" isLoading={isUpdating} onClick={handleSaveBranding}>
            Save Branding Assets
          </Button>
        </div>
      </div>
    </div>
  );
};
