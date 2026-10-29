import React from 'react';
import {
  ShieldCheck,
  Film,
  Box,
  PlaySquare,
  CheckSquare,
  UploadCloud,
  Send,
  Zap,
  Cpu,
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  Server,
} from 'lucide-react';
import { ServiceHealthSummary } from '@/types/system';

interface ServiceCardProps {
  service: ServiceHealthSummary;
  onSelect?: (service: ServiceHealthSummary) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onSelect }) => {
  const getIcon = (name: string) => {
    switch (name) {
      case 'ShieldCheck':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'Film':
        return <Film className="w-4 h-4 text-indigo-400" />;
      case 'Box':
        return <Box className="w-4 h-4 text-purple-400" />;
      case 'PlaySquare':
        return <PlaySquare className="w-4 h-4 text-amber-400" />;
      case 'CheckSquare':
        return <CheckSquare className="w-4 h-4 text-cyan-400" />;
      case 'UploadCloud':
        return <UploadCloud className="w-4 h-4 text-pink-400" />;
      case 'Send':
        return <Send className="w-4 h-4 text-teal-400" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'Cpu':
        return <Cpu className="w-4 h-4 text-orange-400" />;
      case 'Database':
        return <Database className="w-4 h-4 text-blue-400" />;
      default:
        return <Server className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (service.status) {
      case 'operational':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Operational
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Degraded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Outage
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => onSelect?.(service)}
      className="p-4 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all duration-150 flex flex-col justify-between space-y-4 shadow-sm group cursor-pointer"
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl group-hover:border-slate-700 transition-colors">
              {getIcon(service.iconName)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {service.name}
                </h4>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {service.code}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{service.description}</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Telemetry Numbers */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/60">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">30D Uptime</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">{service.uptime30d}%</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Avg Latency</span>
            <span className="text-xs font-bold text-slate-200 font-mono">{service.latencyAvg}ms</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Nodes Active</span>
            <span className="text-xs font-bold text-slate-300 font-mono">
              {service.activeNodes}/{service.totalNodes}
            </span>
          </div>
        </div>
      </div>

      {/* 30-Day Uptime Grid Bars (Statuspage style) */}
      <div>
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5 font-mono">
          <span>30 days ago</span>
          <span className="text-slate-400 font-medium">{service.uptime30d}% uptime</span>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-0.5">
          {service.dailyUptime.map((day: any, idx: number) => (
            <div
              key={idx}
              title={`${day.date}: ${day.uptime}% (${day.status})`}
              className={`flex-1 h-6 rounded-xs transition-transform hover:scale-y-125 ${
                day.status === 'operational'
                  ? 'bg-emerald-500/70 hover:bg-emerald-400'
                  : day.status === 'degraded'
                  ? 'bg-amber-500 hover:bg-amber-400'
                  : 'bg-rose-500 hover:bg-rose-400'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
