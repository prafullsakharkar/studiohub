import React, { useState } from 'react';
import { Building, Plus, Search, DollarSign, ExternalLink, ShieldCheck } from 'lucide-react';
import { Organization, Client } from '@/types/organization';
import { mockClients } from '@/mocks/db/organization/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const ClientsTab: React.FC<{ org: Organization }> = ({ org }) => {
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [search, setSearch] = useState('');

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-400" />
            Client Production Studios & Major Broadcasters
          </h2>
          <p className="text-xs text-slate-400">
            External commissioning studios, contract tiers, and client screening portal accounts.
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
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-48"
            />
          </div>
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Register Client Studio
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((client) => (
          <div
            key={client.id}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3.5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={client.logo_url}
                  alt=""
                  className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-700 bg-slate-950 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{client.name}</h3>
                    <span className="text-[9px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                      {client.code}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{client.studio_type}</span>
                </div>
              </div>

              <Badge variant="success" className="text-[9px] font-mono uppercase">
                {client.contract_tier}
              </Badge>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Primary Producer:</span>
                <span className="text-white font-medium">{client.contact_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Headquarters:</span>
                <span className="text-slate-300">{client.headquarters}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Billed:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  ${(client.total_billed_usd / 1000000).toFixed(2)}M USD
                </span>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Commissioned Shows</span>
              <div className="flex flex-wrap gap-1">
                {client.active_projects.map((p) => (
                  <span
                    key={p}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-indigo-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Portal Access: Enabled</span>
              <span className="text-indigo-400 hover:underline cursor-pointer flex items-center gap-1">
                <span>Client Portal</span>
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
