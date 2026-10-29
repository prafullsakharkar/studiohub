import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Briefcase } from 'lucide-react';
import { useVendorMutations } from '@/modules/vendors/hooks/useVendorsData';
import { Button } from '@/shared/components/Button';

/**
 * Flat vendor-partner create form (POST /api/v1/vendors/ via
 * masterDataApi.createVendor). Create-only: editing lives on the
 * VendorWorkspacePage surface; there is no org dimension.
 */
export const VendorCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { createVendor } = useVendorMutations();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [specialization, setSpecialization] = useState('Roto / Prep');
  const [location, setLocation] = useState('');
  const [securityTier, setSecurityTier] = useState('MPAA Certified Tier 4');
  const [bandwidthGbps, setBandwidthGbps] = useState(10);
  const [status, setStatus] = useState<'Active' | 'Under Review' | 'Archived'>('Active');
  const [rating, setRating] = useState(4.8);
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [ndaSigned, setNdaSigned] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    createVendor.mutate(
      {
        name,
        code: code.toUpperCase(),
        specialization,
        location: location || undefined,
        security_tier: securityTier,
        bandwidth_gbps: Number(bandwidthGbps),
        status,
        rating: Number(rating),
        contact_name: contactName || undefined,
        email: email || undefined,
        nda_signed: ndaSigned,
        logo_url: logoUrl || undefined,
      },
      {
        onSuccess: (newVendor) => navigate(`/vendors/${newVendor.id}`),
      }
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to="/vendors"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Register New Vendor Partner</h1>
            <p className="text-xs text-slate-400">
              Register an outsource FX partner facility on the flat directory.
            </p>
          </div>
        </div>
        <Briefcase className="w-5 h-5 text-cyan-400" />
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-name">Vendor Name *</label>
            <input
              id="vendor-name"
              type="text"
              required
              placeholder="e.g. Apex Silhouette Labs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-code">Vendor Code *</label>
            <input
              id="vendor-code"
              type="text"
              required
              placeholder="e.g. ASL"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-specialization">Specialization</label>
            <select
              id="vendor-specialization"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-hidden"
            >
              <option value="Roto / Prep">Roto / Prep</option>
              <option value="Creature FX">Creature FX</option>
              <option value="Matchmove">Matchmove</option>
              <option value="Environments">Environments</option>
              <option value="Matte Painting">Matte Painting</option>
              <option value="Full VFX">Full VFX</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-location">Location</label>
            <input
              id="vendor-location"
              type="text"
              placeholder="e.g. Mumbai, India"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-security-tier">Security Tier</label>
            <select
              id="vendor-security-tier"
              value={securityTier}
              onChange={(e) => setSecurityTier(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-hidden"
            >
              <option value="MPAA Certified Tier 4">MPAA Certified Tier 4</option>
              <option value="CDSA High Security">CDSA High Security</option>
              <option value="TPN App and Cloud Gold">TPN App and Cloud Gold</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-bandwidth">Bandwidth (Gbps)</label>
            <input
              id="vendor-bandwidth"
              type="number"
              min="0"
              step="1"
              value={bandwidthGbps}
              onChange={(e) => setBandwidthGbps(Number(e.target.value))}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-status">Status</label>
            <select
              id="vendor-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-hidden"
            >
              <option value="Active">Active</option>
              <option value="Under Review">Under Review</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-rating">Rating</label>
            <input
              id="vendor-rating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-contact-name">Primary Contact</label>
            <input
              id="vendor-contact-name"
              type="text"
              placeholder="e.g. Sarah Reyes"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-email">Contact Email</label>
            <input
              id="vendor-email"
              type="email"
              placeholder="e.g. deliveries@vendor.studio"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-hidden"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-mono text-slate-400" htmlFor="vendor-logo-url">Logo URL</label>
            <input
              id="vendor-logo-url"
              type="url"
              placeholder="https://…"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* NDA Checkbox */}
        <div className="pt-3 border-t border-slate-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ndaSigned}
              onChange={(e) => setNdaSigned(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-600 focus:ring-cyan-500"
            />
            <div>
              <div className="text-xs font-bold text-white">NDA Executed</div>
              <div className="text-[11px] text-slate-400">
                Vendor has executed the studio non-disclosure agreement and can receive production media.
              </div>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Link to="/vendors">
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={createVendor.isPending}
            className="flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            Create Vendor Partner
          </Button>
        </div>
      </form>
    </div>
  );
};
