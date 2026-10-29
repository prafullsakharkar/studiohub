import React, { useState } from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Play,
  Clock,
  HardDrive,
  Globe,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';
import { EndpointMetric } from '@/types/system';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface EndpointDetailModalProps {
  endpoint: EndpointMetric | null;
  isOpen: boolean;
  onClose: () => void;
  onProbe: (id: string) => Promise<void> | void;
}

export const EndpointDetailModal: React.FC<EndpointDetailModalProps> = ({
  endpoint,
  isOpen,
  onClose,
  onProbe,
}) => {
  const [copied, setCopied] = useState(false);
  const [isProbing, setIsProbing] = useState(false);

  if (!isOpen || !endpoint) return null;

  const handleCopyCurl = () => {
    const curlCmd = `curl -X ${endpoint.method} "https://studiohub.internal${endpoint.path}" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json"`;
    navigator.clipboard.writeText(curlCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualProbe = async () => {
    setIsProbing(true);
    try {
      await onProbe(endpoint.id);
    } finally {
      setTimeout(() => setIsProbing(false), 400);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Operational
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Degraded Latency
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Incident / Outage
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`px-2.5 py-1 rounded font-mono text-xs font-bold shrink-0 ${
                endpoint.method === 'GET'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : endpoint.method === 'POST'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              }`}
            >
              {endpoint.method}
            </span>
            <div className="truncate">
              <h2 className="text-base font-bold text-white truncate">{endpoint.name}</h2>
              <p className="text-xs font-mono text-slate-400 truncate">{endpoint.path}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(endpoint.status)}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Real-time KPI summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Response Latency
              </div>
              <div className="text-lg font-bold text-white font-mono mt-1">
                {endpoint.latencyMs} <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                24h Uptime
              </div>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                {endpoint.uptime24h}%
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                P95 Latency
              </div>
              <div className="text-lg font-bold text-slate-200 font-mono mt-1">
                {endpoint.p95LatencyMs} <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                Payload Size
              </div>
              <div className="text-lg font-bold text-slate-200 font-mono mt-1">
                {endpoint.details.payloadSizeKb} <span className="text-xs font-normal text-slate-400">KB</span>
              </div>
            </div>
          </div>

          {/* Network Timings Breakdown */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Network Timing Waterfall</span>
              <span className="font-mono text-cyan-400 text-xs">Total: {endpoint.latencyMs}ms</span>
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">DNS Resolution</span>
                <span className="font-mono text-slate-200">{endpoint.details.dnsMs}ms</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, (endpoint.details.dnsMs / endpoint.latencyMs) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">TLS Handshake (TLS 1.3)</span>
                <span className="font-mono text-slate-200">{endpoint.details.tlsMs}ms</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, (endpoint.details.tlsMs / endpoint.latencyMs) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Time to First Byte (TTFB)</span>
                <span className="font-mono text-cyan-400">{endpoint.details.ttfbMs}ms</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, (endpoint.details.ttfbMs / endpoint.latencyMs) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Content Download & JSON Parsing</span>
                <span className="font-mono text-emerald-400">{endpoint.details.downloadMs}ms</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, (endpoint.details.downloadMs / endpoint.latencyMs) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Infrastructure Specs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-1.5">
              <span className="text-slate-500 uppercase tracking-wider font-mono text-[10px]">Server Node & Location</span>
              <p className="text-slate-200 font-medium flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                {endpoint.details.serverLocation}
              </p>
            </div>
            <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-1.5">
              <span className="text-slate-500 uppercase tracking-wider font-mono text-[10px]">Protocol & Version</span>
              <p className="text-slate-200 font-medium flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                {endpoint.details.version}
              </p>
            </div>
          </div>

          {/* cURL Snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Terminal Test Command</span>
              <button
                onClick={handleCopyCurl}
                className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy cURL'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto">
              curl -X {endpoint.method} "https://studiohub.internal{endpoint.path}" \
  -H "Authorization: Bearer &lt;TOKEN&gt;"
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-500">Last probed: {endpoint.lastChecked}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleManualProbe}
              disabled={isProbing}
              leftIcon={<Play className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />}
            >
              {isProbing ? 'Probing...' : 'Send Live Probe'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
