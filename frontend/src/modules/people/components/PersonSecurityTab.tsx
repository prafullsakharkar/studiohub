import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, AlertTriangle, CheckCircle2, UserX, UserCheck, ShieldAlert } from 'lucide-react';
import { Person } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const PersonSecurityTab: React.FC<{
  person: Person;
  onUpdateStatus?: (status: 'Active' | 'Inactive' | 'Suspended') => void;
}> = ({ person, onUpdateStatus }) => {
  const [currentStatus, setCurrentStatus] = useState<'Active' | 'Inactive' | 'Suspended'>(
    (person.status as 'Active' | 'Inactive' | 'Suspended') || 'Active'
  );

  const handleAction = (status: 'Active' | 'Inactive' | 'Suspended') => {
    setCurrentStatus(status);
    if (onUpdateStatus) onUpdateStatus(status);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Security Clearances & Account Access Governance
          </h3>
          <p className="text-xs text-slate-400">
            Control MPAA clearance tier, biometric SSO authorization, and immediate account lifecycle actions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Security Profile */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <h4 className="text-xs font-bold font-mono uppercase text-indigo-300 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" /> Studio Authorization Details
          </h4>

          <div className="divide-y divide-slate-800/80 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Security Clearance</span>
              <span className="font-mono font-bold text-amber-400">{person.security_clearance || 'MPAA Level 4'}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Two-Factor Authentication (2FA)</span>
              <Badge variant="success" className="text-[10px] font-mono">Enforced (YubiKey / TOTP)</Badge>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Watermark Burn-In Mandatory</span>
              <span className="text-white font-mono">Enabled (UID: {person.id})</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Remote SAN Mount</span>
              <span className="text-emerald-400 font-mono">Encrypted WireGuard VPN</span>
            </div>
          </div>
        </div>

        {/* Lifecycle Actions */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <h4 className="text-xs font-bold font-mono uppercase text-indigo-300 flex items-center gap-2">
            <Key className="w-3.5 h-3.5" /> Account Access State
          </h4>

          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Current Status</span>
              <span className="text-[11px] text-slate-400">
                {currentStatus === 'Active' ? 'Full production access enabled' : currentStatus === 'Suspended' ? 'Access blocked due to security hold' : 'Account inactive'}
              </span>
            </div>
            <Badge
              variant={currentStatus === 'Active' ? 'success' : currentStatus === 'Suspended' ? 'error' : 'warning'}
              className="font-mono text-xs"
            >
              {currentStatus}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant={currentStatus === 'Active' ? 'outline' : 'primary'}
              onClick={() => handleAction('Active')}
              leftIcon={<UserCheck className="w-3.5 h-3.5" />}
            >
              Activate Account
            </Button>
            <Button
              size="sm"
              variant={currentStatus === 'Inactive' ? 'outline' : 'warning'}
              onClick={() => handleAction('Inactive')}
            >
              Deactivate
            </Button>
            <Button
              size="sm"
              variant={currentStatus === 'Suspended' ? 'outline' : 'danger'}
              onClick={() => handleAction('Suspended')}
              leftIcon={<ShieldAlert className="w-3.5 h-3.5" />}
            >
              Suspend Access
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
