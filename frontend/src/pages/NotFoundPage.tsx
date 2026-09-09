import React from 'react';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { useNavigate } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <Compass className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-indigo-950/60 text-indigo-300 border border-indigo-800 rounded-md">
            404 NOT FOUND
          </span>
          <h1 className="text-xl font-bold text-white pt-2">Resource Missing</h1>
          <p className="text-sm text-slate-400">
            The shot, project, or pipeline route you requested could not be located in this database partition.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          className="w-full"
          onClick={() => navigate('/dashboard')}
          leftIcon={<Home className="w-4 h-4" />}
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
};
