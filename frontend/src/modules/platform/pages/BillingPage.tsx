import React from 'react';
import {
  CreditCard,
  HardDrive,
  Cpu,
  Users,
  CheckCircle2,
  Calendar,
  DollarSign,
  Download,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useStudioBilling } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

export const BillingPage: React.FC = () => {
  const { data: billing, isLoading } = useStudioBilling();

  if (!billing) return null;

  const creditsPercent = Math.round((billing.farm_credits_used / billing.farm_credits_total) * 100);
  const storagePercent = Math.round((billing.storage_used_tb / billing.storage_quota_tb) * 100);
  const seatsPercent = Math.round((billing.active_seats_count / billing.max_seats_count) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Studio Billing & Compute Quota</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {billing.tier}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dedicated multi-tenant cloud render node credits, high-throughput EXR storage pools, and crew seat allocation.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          leftIcon={<Download className="w-3.5 h-3.5" />}
          onClick={() => alert('Downloading corporate VAT invoice PDF...')}
        >
          Export Statement
        </Button>
      </div>

      {/* Overview Cards Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Farm Compute Credits */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Render Farm Core Credits
            </span>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-500/30">
              Monthly
            </span>
          </div>

          <div>
            <div className="text-2xl font-black text-white font-mono">
              {billing.farm_credits_remaining.toLocaleString()}
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Core Hours Remaining / {billing.farm_credits_total.toLocaleString()} Total
            </span>
          </div>

          <div className="space-y-1">
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full"
                style={{ width: `${creditsPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-500 block text-right">
              {creditsPercent}% used ({billing.farm_credits_used.toLocaleString()} hrs)
            </span>
          </div>
        </div>

        {/* Global VFX Storage */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-sky-400" />
              NVMe EXR / USD Storage
            </span>
            <span className="text-[10px] font-mono text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-500/30">
              Hot Tier
            </span>
          </div>

          <div>
            <div className="text-2xl font-black text-white font-mono">
              {billing.storage_used_tb} TB
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Occupied out of {billing.storage_quota_tb} TB Allocated
            </span>
          </div>

          <div className="space-y-1">
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-500 block text-right">
              {storagePercent}% storage utilization
            </span>
          </div>
        </div>

        {/* Active Crew Seats */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-400" />
              Active Studio Seats
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30">
              Multi-Site
            </span>
          </div>

          <div>
            <div className="text-2xl font-black text-white font-mono">
              {billing.active_seats_count} / {billing.max_seats_count}
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Crew licenses active across 4 global sites
            </span>
          </div>

          <div className="space-y-1">
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                style={{ width: `${seatsPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-500 block text-right">
              {billing.max_seats_count - billing.active_seats_count} Seats available
            </span>
          </div>
        </div>
      </div>

      {/* Plan & Payment Details Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="font-bold text-sm text-white">Corporate Enterprise Agreement</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Base Monthly License: ${billing.monthly_base_fee_usd.toLocaleString()} USD / month
            </p>
          </div>
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-mono"
          >
            Auto-Renew Active
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px]">Payment Method</span>
            <span className="text-white font-semibold block">{billing.payment_method}</span>
            <span className="text-slate-400 text-[11px] block">Corporate ACH Direct Debit</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px]">Next Billing Cycle</span>
            <span className="text-indigo-400 font-semibold block flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {billing.next_billing_date}
            </span>
            <span className="text-slate-400 text-[11px] block">Includes automatic burst compute reconciliation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
