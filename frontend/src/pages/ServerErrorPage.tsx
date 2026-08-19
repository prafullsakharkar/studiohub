import React from 'react';
import { ServerCrash, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/components/Button';

export const ServerErrorPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <ServerCrash className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-rose-950/60 text-rose-300 border border-rose-800 rounded-md">
            500 INTERNAL PIPELINE FAULT
          </span>
          <h1 className="text-xl font-bold text-white pt-2">Server Error</h1>
          <p className="text-sm text-slate-400">
            A production database or OpenUSD service crashed during request resolution. Check logs for stack traces.
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          onClick={() => window.location.reload()}
          leftIcon={<RotateCcw className="w-4 h-4" />}
        >
          Retry Connection
        </Button>
      </div>
    </div>
  );
};
