import React from 'react';
import { Award, TrendingUp, CheckCircle2, Clock, ShieldCheck, Percent, Layers, BarChart2 } from 'lucide-react';
import { Vendor } from '@/types/organization';
import { mockVendorPerformanceMap } from '@/mocks/db/organization/clientVendorDetails';
import { Badge } from '@/shared/components/Badge';

interface VendorPerformanceTabProps {
  vendor: Vendor;
}

export const VendorPerformanceTab: React.FC<VendorPerformanceTabProps> = ({ vendor }) => {
  const perf = mockVendorPerformanceMap[vendor.id] || {
    vendor_id: vendor.id,
    on_time_delivery_rate: 96.5,
    qc_first_pass_rate: 93.0,
    avg_turnaround_hours: 32,
    total_shots_completed: 420,
    rating: 4.8,
    sla_compliance_rate: 98.4,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-purple-400" />
          Partner Quality Scorecard & SLA Analytics
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Cumulative delivery punctuality, first-pass QC approval rates, and automated SLA compliance ratings.
        </p>
      </div>

      {/* Main KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">On-Time Delivery Rate</span>
            <span className="text-lg font-bold font-mono text-emerald-400">{perf.on_time_delivery_rate}%</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${perf.on_time_delivery_rate}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Based on agreed SOW milestone turnaround delivery timestamps. Target: &gt;95.0%.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">First-Pass QC Approval</span>
            <span className="text-lg font-bold font-mono text-indigo-300">{perf.qc_first_pass_rate}%</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${perf.qc_first_pass_rate}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Pass percentage on initial studio composite & alpha matte technical validation.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">SLA Security & Bandwidth</span>
            <span className="text-lg font-bold font-mono text-cyan-300">{perf.sla_compliance_rate}%</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-cyan-500 rounded-full"
              style={{ width: `${perf.sla_compliance_rate}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Pipe uptime, encrypted transfer conformance, and zero security leak violations.
          </p>
        </div>
      </div>

      {/* Deep Operational Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-slate-800">
            Historical Delivery Volume
          </h4>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Lifetime Shots Completed</span>
              <span className="font-mono font-bold text-white">{perf.total_shots_completed} Shots</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Average Turnaround Time</span>
              <span className="font-mono font-bold text-purple-300">{perf.avg_turnaround_hours} Hours / Shot</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Supervisory Partner Rating</span>
              <span className="font-mono font-bold text-amber-400">{perf.rating} / 5.0 Stars</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Audit Status</span>
              <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/30">
                MPAA Tier 4 Certified
              </Badge>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-slate-800">
            Quality Assurance Benchmarks
          </h4>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1 text-slate-300">
                <span>Alpha Edge Matte Accuracy</span>
                <span className="text-emerald-400 font-bold">98.8%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '98.8%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1 text-slate-300">
                <span>Color Space & ACEScg Conformance</span>
                <span className="text-emerald-400 font-bold">100%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1 text-slate-300">
                <span>Camera Tracking Root Mean Square Error</span>
                <span className="text-indigo-300 font-bold">0.42 px (Optimal)</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: '94%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
