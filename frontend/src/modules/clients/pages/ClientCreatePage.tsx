import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Building2 } from 'lucide-react';
import { useClientMutations } from '@/modules/clients/hooks/useClientsData';
import { Button } from '@/shared/components/Button';

/**
 * Flat client-studio create form (POST /api/v1/clients/ via
 * masterDataApi.createClient). Create-only: editing lives on the
 * ClientWorkspacePage surface; there is no org dimension.
 */
export const ClientCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { createClient } = useClientMutations();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [studioType, setStudioType] = useState('Major Studio');
  const [headquarters, setHeadquarters] = useState('');
  const [contractTier, setContractTier] = useState('Tier 1 Global');
  const [status, setStatus] = useState<'Active' | 'Prospective' | 'Archived'>('Active');
  const [portalAccess, setPortalAccess] = useState(true);
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    createClient.mutate(
      {
        name,
        code: code.toUpperCase(),
        studio_type: studioType,
        headquarters: headquarters || undefined,
        contract_tier: contractTier,
        status,
        portal_access: portalAccess,
        contact_name: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
      },
      {
        onSuccess: (newClient) => navigate(`/clients/${newClient.id}`),
      }
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to="/clients"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Register New Client Studio</h1>
            <p className="text-xs text-slate-400">
              Create a production client studio on the flat directory for contracts and turnovers.
            </p>
          </div>
        </div>
        <Building2 className="w-5 h-5 text-indigo-400" />
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="studio-name">Studio Name *</label>
            <input
              id="studio-name"
              type="text"
              required
              placeholder="e.g. Warner Nexus Studios"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="studio-identifier-code">Studio Identifier Code *</label>
            <input
              id="studio-identifier-code"
              type="text"
              required
              placeholder="e.g. WNS"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="studio-category">Studio Category</label>
            <select
              id="studio-category"
              value={studioType}
              onChange={(e) => setStudioType(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="Major Studio">Major Studio</option>
              <option value="Streaming Platform">Streaming Platform</option>
              <option value="Independent Producer">Independent Producer</option>
              <option value="Game Publisher">Game Publisher</option>
              <option value="Agency">Agency</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="headquarters-location">Headquarters Location</label>
            <input
              id="headquarters-location"
              type="text"
              placeholder="e.g. Burbank, CA, USA"
              value={headquarters}
              onChange={(e) => setHeadquarters(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="contract-tier">Contract Tier</label>
            <select
              id="contract-tier"
              value={contractTier}
              onChange={(e) => setContractTier(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-hidden font-mono"
            >
              <option value="Tier 1 Global">Tier 1 Global (Enterprise MSA)</option>
              <option value="Tier 2 Standard">Tier 2 Standard</option>
              <option value="Tier 3 Boutique">Tier 3 Boutique / Pilot</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="entity-status">Entity Status</label>
            <select
              id="entity-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="Active">Active Partner</option>
              <option value="Prospective">Prospective Client</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="contact-name">Primary Contact</label>
            <input
              id="contact-name"
              type="text"
              placeholder="e.g. Alex Rivera"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="contact-email">Contact Email</label>
            <input
              id="contact-email"
              type="email"
              placeholder="e.g. producers@client.studio"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400" htmlFor="contact-phone">Contact Phone</label>
            <input
              id="contact-phone"
              type="tel"
              placeholder="e.g. +1 818 555 0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Portal Access Checkbox */}
        <div className="pt-3 border-t border-slate-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={portalAccess}
              onChange={(e) => setPortalAccess(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <div className="text-xs font-bold text-white">Enable Client Review Portal Access</div>
              <div className="text-[11px] text-slate-400">
                Grants client executive contacts secure access to watermarked 4K dailies sync rooms and playlist approvals.
              </div>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Link to="/clients">
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={createClient.isPending}
            className="flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            Create Client Entity
          </Button>
        </div>
      </form>
    </div>
  );
};
