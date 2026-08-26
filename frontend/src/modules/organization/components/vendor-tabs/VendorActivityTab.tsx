import React from 'react';
import { Activity, Clock, ShieldCheck, CheckCircle2, FileText, ArrowRight, User } from 'lucide-react';
import { Vendor } from '@/types/organization';
import { mockVendorActivities } from '@/mocks/db/organization/clientVendorDetails';
import { Badge } from '@/shared/components/Badge';

interface VendorActivityTabProps {
  vendor: Vendor;
}

export const VendorActivityTab: React.FC<VendorActivityTabProps> = ({ vendor }) => {
  const activities = mockVendorActivities.filter((a) => a.vendor_id === vendor.id);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          Vendor Audit Trail & Activity Timeline ({activities.length})
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Immutable logging of delivery submissions, QC verifications, squad assignments, and security compliance renewals.
        </p>
      </div>

      {/* Timeline List */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {activities.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/80">
            No logged activity for this vendor yet.
          </div>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="relative group">
              {/* Dot */}
              <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-slate-950" />

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-1.5 hover:border-slate-700 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="font-bold text-xs text-white">{act.action}</span>
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(act.timestamp).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{act.description}</p>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-purple-400" />
                    Logged by: <strong className="text-slate-300">{act.user_name}</strong>
                  </span>
                  <Badge variant="outline" className="text-[9px] text-purple-300 border-purple-500/30">
                    Audit Log
                  </Badge>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
