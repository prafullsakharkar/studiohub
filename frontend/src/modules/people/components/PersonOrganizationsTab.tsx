import React from 'react';
import { Building2, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Person, Organization } from '@/types/organization';
import { useOrganizationsList } from '@/modules/organization/hooks/useOrganizationData';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const PersonOrganizationsTab: React.FC<{ person: Person }> = ({ person }) => {
  const { data: orgs } = useOrganizationsList();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Studio Multi-Tenant Memberships
          </h3>
          <p className="text-xs text-slate-400">
            Tenants and multi-studio organizations where this artist holds active workspace permissions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(orgs || []).map((org) => {
          const isPrimary = org.id === person.organization_id;
          return (
            <div
              key={org.id}
              className={`rounded-xl border p-4 transition-all ${
                isPrimary
                  ? 'border-indigo-500/50 bg-indigo-950/20 shadow-sm'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={org.logo_url}
                    alt={org.name}
                    className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-700"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-white">{org.name}</h4>
                    <span className="text-[11px] font-mono text-slate-400">{org.code} • {org.tier}</span>
                  </div>
                </div>
                {isPrimary ? (
                  <Badge variant="info" className="text-[10px] font-mono">
                    Home Studio
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-mono text-slate-400">
                    Guest Contractor
                  </Badge>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[11px]">Role: {person.role}</span>
                <span className="text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 font-medium">
                  View Perms <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
