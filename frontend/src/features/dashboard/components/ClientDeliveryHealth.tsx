import React from 'react';
import { Truck, CheckCircle2, Clock, AlertTriangle, ArrowUpRight, PackageCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardDeliveriesData } from '../types';
import { getDeliveryFigures } from '../utils/dashboardMetrics';

export interface ClientDeliveryHealthProps {
  deliveries: DashboardDeliveriesData;
  projectId: string;
}

export const ClientDeliveryHealth: React.FC<ClientDeliveryHealthProps> = ({ deliveries, projectId }) => {
  const figures = getDeliveryFigures(deliveries);
  return (
    <div id="dashboard-client-deliveries" className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Client Deliveries &amp; Packages</h2>
            <p className="text-[11px] text-slate-400">Master renders, EXR turnovers &amp; editorial conform</p>
          </div>
        </div>

        <Link
          to={`/deliveries?project=${projectId}`}
          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-mono transition-colors"
        >
          Manifest Matrix
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Metric Badges */}
      <div className="grid grid-cols-3 gap-2 text-center font-mono">
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-emerald-400 uppercase">Delivered</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5">{figures.delivered}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-indigo-400 uppercase">Queued</div>
          <div className="text-base font-bold text-indigo-300 mt-0.5">{figures.upcoming}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-rose-400 uppercase">Late</div>
          <div className={`text-base font-bold mt-0.5 ${figures.late > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
            {figures.late}
          </div>
        </div>
      </div>

      {/* Delivery Items List */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">
          Turnover Packages
        </h3>

        {deliveries.items.length === 0 ? (
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            No delivery packages registered for this project.
          </div>
        ) : (
          <div className="space-y-2 font-mono text-xs">
            {deliveries.items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-slate-200 font-medium font-sans truncate block">{item.package_name}</span>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                    <span className="text-emerald-400 font-mono">Recipient: {item.recipient}</span>
                    <span>•</span>
                    <span>Due: {item.due_date}</span>
                  </div>
                </div>

                <div className="shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] border ${
                      item.status === 'Delivered'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : item.status === 'Late'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
