import React from 'react';
import { ShieldAlert, ArrowLeft, Film } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { useNavigate, Link } from 'react-router-dom';

interface NoProjectAccessPageProps {
  projectId?: string;
  projectName?: string;
}

export const NoProjectAccessPage: React.FC<NoProjectAccessPageProps> = ({
  projectId,
  projectName,
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-amber-950/60 text-amber-300 border border-amber-800/80 rounded-md">
            PROJECT ACCESS RESTRICTED
          </span>
          <h1 className="text-xl font-bold text-white pt-2">Project Access Denied</h1>
          <p className="text-sm text-slate-400">
            You do not have an active membership or permission to access this project container. Contact your Production Supervisor or Studio Administrator.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="secondary"
            size="md"
            className="w-full"
            onClick={() => navigate('/projects')}
            leftIcon={<Film className="w-4 h-4" />}
          >
            All Projects
          </Button>
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => navigate('/dashboard')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};
