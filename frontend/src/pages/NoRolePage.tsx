import React from 'react';
import { UserX, LogOut } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { useAuth } from '@/modules/auth';

export const NoRolePage: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <UserX className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-amber-950/60 text-amber-300 border border-amber-800 rounded-md">
            NO ROLE ASSIGNED
          </span>
          <h1 className="text-xl font-bold text-white pt-2">No access yet</h1>
          <p className="text-sm text-slate-400">
            {user?.email ? `${user.email} is` : 'Your account is'} signed in, but no role has been assigned to it.
            Ask a studio administrator to give you a role, then sign in again.
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          onClick={() => void logout()}
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
};
