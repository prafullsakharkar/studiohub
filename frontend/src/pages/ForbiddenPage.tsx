import React from 'react';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { useNavigate } from 'react-router-dom';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-rose-950/60 text-rose-300 border border-rose-800 rounded-md">
            403 FORBIDDEN
          </span>
          <h1 className="text-xl font-bold text-white pt-2">Access Denied</h1>
          <p className="text-sm text-slate-400">
            You do not have the required RBAC role or pipeline permissions to access this department module.
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          onClick={() => navigate('/dashboard')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};
