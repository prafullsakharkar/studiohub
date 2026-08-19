import React, { useState } from 'react';
import {
  Briefcase,
  Search,
  Plus,
  Building,
  Mail,
  Phone,
  Film,
  DollarSign,
  Shield,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { useClients, useClientMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/shared/utils/cn';

export const ClientsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [studioTypeFilter, setStudioTypeFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newStudioType, setNewStudioType] = useState<
    'Major Studio' | 'Streaming Platform' | 'Indie Producer' | 'Commercial Agency' | 'Game Dev'
  >('Major Studio');
  const [newHq, setNewHq] = useState('Burbank, CA');

  const { data: clientsData, isLoading } = useClients({ search });
  const { createClient } = useClientMutations();

  const clients = clientsData?.results || [];
  const filtered = clients.filter(
    (c) => studioTypeFilter === 'ALL' || c.studio_type === studioTypeFilter
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;

    createClient.mutate(
      {
        name: newName,
        code: newCode.toUpperCase(),
        contact_name: newContact,
        email: newEmail,
        studio_type: newStudioType,
        headquarters: newHq,
        contract_tier: 'Tier 1 Strategic',
        portal_access: true,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setNewName('');
          setNewCode('');
          setNewContact('');
          setNewEmail('');
        },
      }
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Client Studios & Partners</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {clients.length} Accounts
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Studio accounts, executive producer contacts, project turnover slates, and client review portal entitlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-52"
            />
          </div>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Add Client
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['ALL', 'Major Studio', 'Streaming Platform', 'Independent Producer'].map((type) => (
          <button
            key={type}
            onClick={() => setStudioTypeFilter(type)}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              studioTypeFilter === type
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            )}
          >
            {type === 'ALL' ? 'All Client Types' : type}
          </button>
        ))}
      </div>

      {/* Clients Table / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((client) => (
          <div
            key={client.id}
            className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={client.logo_url}
                    alt={client.name}
                    className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-700 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">{client.name}</h3>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                        {client.code}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{client.studio_type} • {client.headquarters}</span>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono"
                >
                  Portal Active
                </Badge>
              </div>

              {/* Contact Information & Projects */}
              <div className="mt-4 space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400 font-medium">Executive Contact:</span>
                    <span className="font-semibold text-white">{client.contact_name}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-indigo-400" />
                      {client.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-indigo-400" />
                      {client.phone}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1 font-mono">
                    <Film className="w-3 h-3 text-indigo-400" />
                    Active Shows:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {client.active_projects.map((proj) => (
                      <span
                        key={proj}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-mono border border-slate-700"
                      >
                        {proj}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Tier & Total Billed */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-400">
                Tier: <span className="text-slate-200 font-medium">{client.contract_tier}</span>
              </span>
              <span className="font-mono text-xs font-bold text-emerald-400">
                ${(client.total_billed_usd / 1000000).toFixed(2)}M Lifetime
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Client Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                Register Client Studio
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400">Client Studio Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paramount Global VFX"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400">Studio Code (3-4 Letters)</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="e.g. PGV"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400">Studio Type</label>
                  <select
                    value={newStudioType}
                    onChange={(e) => setNewStudioType(e.target.value as any)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="Major Studio">Major Studio</option>
                    <option value="Streaming Platform">Streaming Platform</option>
                    <option value="Independent Producer">Independent Producer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Executive Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. David Vance"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">Contact Email</label>
                <input
                  type="email"
                  placeholder="contact@studio.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Register Client
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
