import React, { useState } from 'react';
import {
  Building2,
  ArrowLeft,
  ShieldCheck,
  HardDrive,
  Cpu,
  Globe,
  Sliders,
  Palette,
  Sparkles,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrganizationMutations } from '../hooks/useOrganizationMutations';
import { useOrganization } from '@/core/organization/useOrganization';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { OrganizationTier, StudioStatus } from '@/types/organization';

export const CreateOrganizationPage: React.FC = () => {
  const navigate = useNavigate();
  const { createOrganization, isCreating } = useOrganizationMutations();
  const { refreshOrganizations, switchOrganization } = useOrganization();

  const [activeSection, setActiveSection] = useState<'general' | 'branding' | 'pipeline' | 'security'>('general');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    slug: '',
    tier: 'Enterprise Vanguard' as OrganizationTier,
    status: 'Active' as StudioStatus,
    headquarters: 'Vancouver, BC, Canada',
    primary_contact_name: '',
    primary_contact_email: '',
    crew_count: 50,
    offices_count: 1,
    storage_quota_tb: 250,
    logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    banner_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80',
    // Pipeline settings
    default_fps: 24,
    default_color_space: 'ACEScg / ACES 1.3',
    default_resolution: '3840x2160 (UHD)',
    usd_schema_version: 'OpenUSD 24.08',
    render_farm_region: 'us-west-2 (AWS Farm)',
    allow_guest_reviewers: true,
    enable_two_factor: true,
    sso_enforced: true,
  });

  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const code = name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);

    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') ? slug : prev.slug,
      code: prev.code === '' || prev.code.length <= 4 ? code : prev.code,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) return;

    const created = await createOrganization({
      name: formData.name,
      code: formData.code.toUpperCase(),
      slug: formData.slug,
      tier: formData.tier,
      status: formData.status,
      headquarters: formData.headquarters,
      primary_contact_name: formData.primary_contact_name || 'Studio Administrator',
      primary_contact_email: formData.primary_contact_email || 'admin@studio.vfx',
      crew_count: Number(formData.crew_count),
      offices_count: Number(formData.offices_count),
      storage_quota_tb: Number(formData.storage_quota_tb),
      storage_used_tb: 0,
      active_projects_count: 0,
      logo_url: formData.logo_url,
      banner_url: formData.banner_url,
      settings: {
        default_fps: Number(formData.default_fps),
        default_color_space: formData.default_color_space,
        default_resolution: formData.default_resolution,
        usd_schema_version: formData.usd_schema_version,
        render_farm_region: formData.render_farm_region,
        allow_guest_reviewers: formData.allow_guest_reviewers,
        enable_two_factor: formData.enable_two_factor,
        sso_enforced: formData.sso_enforced,
      },
    });

    await refreshOrganizations();
    if (created && created.id) {
      switchOrganization(created.id);
      navigate(`/organizations/${created.id}`);
    } else {
      navigate('/organizations');
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-6 animate-in fade-in duration-200">
      {/* Navigation Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link to="/organizations">
            <Button size="xs" variant="outline" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back to Organizations
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Initialize Studio Organization</h1>
              <Badge variant="outline" className="text-indigo-400 border-indigo-500/30 font-mono text-[10px]">
                New Tenancy
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Provision a new isolated studio tenant with dedicated pipeline schema, storage quota, and security rules.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          isLoading={isCreating}
          onClick={handleSubmit}
          leftIcon={<Save className="w-4 h-4" />}
        >
          Create Studio
        </Button>
      </div>

      {/* Navigation Pill Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
        <button
          type="button"
          onClick={() => setActiveSection('general')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'general'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>General & Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('branding')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'branding'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Branding & Visuals</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('pipeline')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'pipeline'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Pipeline & OCIO</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('security')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
            activeSection === 'security'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Security & SSO</span>
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: GENERAL & PROFILE */}
        {activeSection === 'general' && (
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                Studio Profile & Legal Entity
              </h2>
              <p className="text-xs text-slate-400">
                General identifying information used across shot turnover packages, invoices, and client portals.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Studio Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Industrial Lightworks VFX"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Unique Studio Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. ILW"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-indigo-300 focus:outline-hidden focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500">Short 2-5 letter prefix used in sequence naming.</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">URL Identifier (Slug)</label>
                <input
                  type="text"
                  placeholder="industrial-lightworks"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-400 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subscription Tier</label>
                <select
                  value={formData.tier}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value as OrganizationTier })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="Enterprise Vanguard">Enterprise Vanguard (Multi-Site + Dedicated SAN)</option>
                  <option value="Global Multi-Site">Global Multi-Site (Up to 10 Hubs)</option>
                  <option value="Studio Pro">Studio Pro (Up to 3 Facilities)</option>
                  <option value="Indie">Indie (Single Facility Hub)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Headquarters Location</label>
                <input
                  type="text"
                  placeholder="e.g. Vancouver, BC, Canada"
                  value={formData.headquarters}
                  onChange={(e) => setFormData({ ...formData, headquarters: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Primary Supervisor / Contact</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Chen"
                  value={formData.primary_contact_name}
                  onChange={(e) => setFormData({ ...formData, primary_contact_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contact Email</label>
                <input
                  type="email"
                  placeholder="supervisor@studio.vfx"
                  value={formData.primary_contact_email}
                  onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Initial Crew Count</label>
                <input
                  type="number"
                  min={1}
                  value={formData.crew_count}
                  onChange={(e) => setFormData({ ...formData, crew_count: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Initial Offices Count</label>
                <input
                  type="number"
                  min={1}
                  value={formData.offices_count}
                  onChange={(e) => setFormData({ ...formData, offices_count: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Storage Quota (TB)</label>
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={formData.storage_quota_tb}
                  onChange={(e) => setFormData({ ...formData, storage_quota_tb: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: BRANDING */}
        {activeSection === 'branding' && (
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                Studio Visual Branding & Assets
              </h2>
              <p className="text-xs text-slate-400">
                Custom iconography, preview banners, and screening room watermarks.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Studio Logo URL</label>
                <div className="flex items-center gap-3">
                  <img
                    src={formData.logo_url}
                    alt="Logo Preview"
                    className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-700 bg-slate-950 shrink-0"
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Workspace Banner URL</label>
                <div className="space-y-2">
                  <div className="h-24 w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                    <img src={formData.banner_url} alt="Banner Preview" className="w-full h-full object-cover opacity-60" />
                  </div>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.banner_url}
                    onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: PIPELINE & OCIO */}
        {activeSection === 'pipeline' && (
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Pipeline, OpenUSD & OCIO Defaults
              </h2>
              <p className="text-xs text-slate-400">
                Default configurations enforced across newly spawned shows, sequences, and screening review sessions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Default Production FPS</label>
                <select
                  value={formData.default_fps}
                  onChange={(e) => setFormData({ ...formData, default_fps: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  <option value={24}>24 FPS (Feature Film / Streaming Standard)</option>
                  <option value={23.976}>23.976 FPS (Broadcast NTSC)</option>
                  <option value={25}>25 FPS (PAL / European Broadcast)</option>
                  <option value={29.97}>29.97 FPS (Commercials)</option>
                  <option value={48}>48 FPS (HFR Film)</option>
                  <option value={60}>60 FPS (Game Cinematics / VR)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Default OCIO Color Space</label>
                <select
                  value={formData.default_color_space}
                  onChange={(e) => setFormData({ ...formData, default_color_space: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  <option value="ACEScg / ACES 1.3">ACEScg / ACES 1.3 (Recommended VFX Working Space)</option>
                  <option value="ACES2065-1">ACES2065-1 (Archival Linear)</option>
                  <option value="DCI-P3 D65">DCI-P3 D65 (Theatrical Reference)</option>
                  <option value="Rec.709 / sRGB">Rec.709 / sRGB (Commercial Broadcast)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Default Project Resolution</label>
                <select
                  value={formData.default_resolution}
                  onChange={(e) => setFormData({ ...formData, default_resolution: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  <option value="4096x2160 (4K DCI)">4096x2160 (4K DCI Full Container)</option>
                  <option value="3840x2160 (UHD)">3840x2160 (UHD 16:9)</option>
                  <option value="2048x1080 (2K DCI)">2048x1080 (2K DCI)</option>
                  <option value="1920x1080 (HD)">1920x1080 (1080p HD)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">OpenUSD Schema Target</label>
                <select
                  value={formData.usd_schema_version}
                  onChange={(e) => setFormData({ ...formData, usd_schema_version: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  <option value="OpenUSD 24.08">OpenUSD 24.08 (Latest Hydra 2.0)</option>
                  <option value="OpenUSD 24.05">OpenUSD 24.05 (ASWF VFX Reference Platform 2024)</option>
                  <option value="OpenUSD 23.11">OpenUSD 23.11 (Legacy ASWF 2023)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Render Farm Compute Cluster</label>
                <input
                  type="text"
                  value={formData.render_farm_region}
                  onChange={(e) => setFormData({ ...formData, render_farm_region: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: SECURITY */}
        {activeSection === 'security' && (
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Security, SSO & Tenancy Governance
              </h2>
              <p className="text-xs text-slate-400">
                MPAA and CDSA studio security accreditation controls for this organization.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer hover:bg-slate-950/90">
                <div>
                  <div className="text-xs font-bold text-white">Enforce Two-Factor Authentication (2FA)</div>
                  <div className="text-[11px] text-slate-400">
                    Mandate hardware keys or authenticator TOTP apps for all crew and supervisor accounts.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.enable_two_factor}
                  onChange={(e) => setFormData({ ...formData, enable_two_factor: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer hover:bg-slate-950/90">
                <div>
                  <div className="text-xs font-bold text-white">SAML 2.0 / Okta Enterprise SSO Enforcement</div>
                  <div className="text-[11px] text-slate-400">
                    Require corporate SSO sign-on; disables password logins for studio employees.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.sso_enforced}
                  onChange={(e) => setFormData({ ...formData, sso_enforced: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer hover:bg-slate-950/90">
                <div>
                  <div className="text-xs font-bold text-white">Allow Secure Guest Screening Reviewers</div>
                  <div className="text-[11px] text-slate-400">
                    Permit external client studio executives to review dailies with expiring watermarked access tokens.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.allow_guest_reviewers}
                  onChange={(e) => setFormData({ ...formData, allow_guest_reviewers: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
              </label>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Link to="/organizations">
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isCreating}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Confirm & Initialize Studio
          </Button>
        </div>
      </form>
    </div>
  );
};
