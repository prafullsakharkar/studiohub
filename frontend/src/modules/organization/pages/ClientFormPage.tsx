import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building, ArrowLeft, Save, Check, Globe, DollarSign, Shield, Film, User } from 'lucide-react';
import { useClient, useClientMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

export const ClientFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const { data: existingClient, isLoading } = useClient(id || '');
  const { createClient, updateClient } = useClientMutations();

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [studioType, setStudioType] = useState('Major Studio');
  const [headquarters, setHeadquarters] = useState('Burbank, CA, USA');
  const [contractTier, setContractTier] = useState('Tier 1 Global');
  const [status, setStatus] = useState<'Active' | 'Prospective' | 'Archived'>('Active');
  const [totalBilledUsd, setTotalBilledUsd] = useState(0);
  const [activeProjectsStr, setActiveProjectsStr] = useState('NK99, DS01');
  const [portalAccess, setPortalAccess] = useState(true);

  useEffect(() => {
    if (existingClient) {
      setName(existingClient.name);
      setCode(existingClient.code);
      setStudioType(existingClient.studio_type);
      setHeadquarters(existingClient.headquarters);
      setContractTier(existingClient.contract_tier || 'Tier 1 Global');
      setStatus(existingClient.status as any);
      setTotalBilledUsd(existingClient.total_billed_usd || 0);
      setActiveProjectsStr(existingClient.active_projects?.join(', ') || '');
      setPortalAccess(existingClient.portal_access ?? true);
    }
  }, [existingClient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    const activeProjects = activeProjectsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const clientPayload = {
      name,
      code: code.toUpperCase(),
      studio_type: studioType,
      headquarters,
      contract_tier: contractTier,
      status,
      total_billed_usd: Number(totalBilledUsd),
      active_projects: activeProjects,
      portal_access: portalAccess,
    };

    if (isEditing && id) {
      updateClient.mutate(
        { id, data: clientPayload },
        {
          onSuccess: () => navigate(`/clients/${id}`),
        }
      );
    } else {
      createClient.mutate(clientPayload as any, {
        onSuccess: (newClient) => navigate(`/clients/${newClient.id}`),
      });
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xs font-mono text-slate-400">Loading client data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to={isEditing ? `/clients/${id}` : '/clients'}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">
              {isEditing ? `Edit Client Studio: ${existingClient?.name}` : 'Register New Client Studio'}
            </h1>
            <p className="text-xs text-slate-400">
              {isEditing
                ? 'Update executive client parameters, billing terms, and production slates.'
                : 'Create an organization-level business entity for production turnovers and contracts.'}
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-mono text-slate-400">Studio Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Warner Nexus Studios"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400">Studio Identifier Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. WNS"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400">Studio Category</label>
            <select
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
            <label className="text-xs font-mono text-slate-400">Headquarters Location</label>
            <input
              type="text"
              required
              placeholder="e.g. Burbank, CA, USA"
              value={headquarters}
              onChange={(e) => setHeadquarters(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400">Contract Tier</label>
            <select
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
            <label className="text-xs font-mono text-slate-400">Entity Status</label>
            <select
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
            <label className="text-xs font-mono text-slate-400">Lifetime Total Billed (USD)</label>
            <input
              type="number"
              min="0"
              step="100000"
              value={totalBilledUsd}
              onChange={(e) => setTotalBilledUsd(Number(e.target.value))}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400">
              Active Productions (Comma Separated)
            </label>
            <input
              type="text"
              placeholder="e.g. NK99, DS01, MK42"
              value={activeProjectsStr}
              onChange={(e) => setActiveProjectsStr(e.target.value)}
              className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
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
          <Link to={isEditing ? `/clients/${id}` : '/clients'}>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={createClient.isPending || updateClient.isPending}
            className="flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            {isEditing ? 'Save Client Changes' : 'Create Client Entity'}
          </Button>
        </div>
      </form>
    </div>
  );
};
