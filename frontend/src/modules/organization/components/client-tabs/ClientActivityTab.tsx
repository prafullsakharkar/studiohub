import React, { useState } from 'react';
import { Activity, Clock, CheckCircle2, FileText, User, Filter, Search } from 'lucide-react';
import { Client, ClientActivity } from '@/types/organization';
import { mockClientActivities } from '@/mocks/db/organization/clientVendorDetails';
import { Badge } from '@/shared/components/Badge';

interface ClientActivityTabProps {
  client: Client;
}

export const ClientActivityTab: React.FC<ClientActivityTabProps> = ({ client }) => {
  const [activities, setActivities] = useState<ClientActivity[]>(() =>
    mockClientActivities.filter((a) => a.client_id === client.id)
  );
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const filtered = activities.filter(
    (a) => categoryFilter === 'ALL' || a.category === categoryFilter
  );

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Client Audit Trail & Activity Log ({activities.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable log of turnover approvals, review sign-offs, invoice issuances, and portal events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-hidden font-mono"
          >
            <option value="ALL">All Categories</option>
            <option value="Approval">Approval</option>
            <option value="Delivery">Delivery</option>
            <option value="Invoice">Invoice</option>
            <option value="Contract">Contract</option>
            <option value="Portal">Portal</option>
          </select>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No activity logs recorded.
            </div>
          ) : (
            filtered.map((act) => (
              <div key={act.id} className="relative group">
                <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-900 group-hover:scale-125 transition-transform" />
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{act.action}</span>
                      <Badge variant="outline" className="font-mono text-[9px] text-indigo-300">
                        {act.category}
                      </Badge>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(act.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    {act.description}
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-500" />
                    <span>Actor: {act.user_name}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
