import React, { useState } from 'react';
import { X, Flame, ShieldAlert, Sliders, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { ChaosConfig } from '../../health/useApiHealth';

interface ChaosSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ChaosConfig;
  onUpdateConfig: (config: ChaosConfig) => void;
  onReset: () => void;
}

export const ChaosSimulatorModal: React.FC<ChaosSimulatorModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onReset,
}) => {
  const [localConfig, setLocalConfig] = useState<ChaosConfig>(config);

  if (!isOpen) return null;

  const handleApply = () => {
    onUpdateConfig(localConfig);
    onClose();
  };

  const handleReset = () => {
    onReset();
    setLocalConfig({
      enabled: false,
      latencySpike: false,
      simulatedErrorPercent: 0,
      degradedServiceIds: [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Synthetic Load & Chaos Simulator</h2>
              <p className="text-xs text-slate-400">Inject controlled network latency, packet jitter & faults</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Master Enable Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div>
              <span className="text-xs font-bold text-white block">Enable Chaos Experimentation</span>
              <span className="text-[11px] text-slate-400">Toggle active injection of synthetic latency & status codes</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.enabled}
                onChange={(e) => setLocalConfig({ ...localConfig, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {/* Latency Spike Toggle */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Network Latency Spike (+350ms)</span>
              <span className="text-[11px] font-mono text-cyan-400">
                {localConfig.latencySpike ? 'Active (+350ms)' : 'Normal (8-24ms)'}
              </span>
            </label>
            <button
              onClick={() => setLocalConfig({ ...localConfig, latencySpike: !localConfig.latencySpike })}
              disabled={!localConfig.enabled}
              className={`w-full p-3 rounded-xl border text-left text-xs transition-all ${
                !localConfig.enabled
                  ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800 text-slate-500'
                  : localConfig.latencySpike
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 font-semibold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              Simulate high WAN congestion / cross-region trans-Pacific latency spike to OpenUSD endpoints
            </button>
          </div>

          {/* Simulated Error Rate Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Simulated 500/503 HTTP Fault Rate</span>
              <span className="font-mono text-amber-400 font-bold">{localConfig.simulatedErrorPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              disabled={!localConfig.enabled}
              value={localConfig.simulatedErrorPercent}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  simulatedErrorPercent: parseInt(e.target.value, 10),
                })
              }
              className="w-full accent-rose-500 cursor-pointer disabled:opacity-40"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0% (Clean)</span>
              <span>15% (Jitter)</span>
              <span>30% (Severe)</span>
              <span>50% (Heavy Fault)</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleReset} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            Reset Default
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleApply}>
              Apply Chaos Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
