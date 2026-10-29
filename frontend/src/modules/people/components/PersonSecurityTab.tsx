import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, AlertTriangle, CheckCircle2, UserX, UserCheck, ShieldAlert, Send } from 'lucide-react';
import { Person } from '@/types/masterData';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { personApi } from '@/modules/people/api/personApi';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export const PersonSecurityTab: React.FC<{
  person: Person;
  onUpdateStatus?: (status: 'Active' | 'Inactive' | 'Suspended') => void;
}> = ({ person, onUpdateStatus }) => {
  const [currentStatus, setCurrentStatus] = useState<'Active' | 'Inactive' | 'Suspended'>(
    (person.status as 'Active' | 'Inactive' | 'Suspended') || 'Active'
  );

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const { addNotification } = useNotificationStore();

  const handleAction = (status: 'Active' | 'Inactive' | 'Suspended') => {
    setCurrentStatus(status);
    if (onUpdateStatus) onUpdateStatus(status);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;

    setIsChangingPassword(true);
    try {
      const payload: { current_password?: string; new_password: string } = { new_password: newPassword.trim() };
      if (currentPassword) payload.current_password = currentPassword;
      const res = await personApi.setPersonPassword(person.id, payload);
      setPasswordFeedback(null);
      addNotification({
        type: 'success',
        title: 'Credential Updated',
        message: res?.detail || 'Password updated.',
      });
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      const msg =
        err?.message || 'Password change failed. The account may not be linked, or you lack permission.';
      setPasswordFeedback(msg);
      addNotification({ type: 'error', title: 'Credential Change Failed', message: msg });
    } finally {
      setIsChangingPassword(false);
    }
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPasswordModalOpen(true)}
              leftIcon={<Key className="w-3.5 h-3.5" />}
              title="Change this person's password (admin path) or confirm your own."
            >
              Change Password
            </Button>
          </div>
        </div>
      </div>

      {isPasswordModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsPasswordModalOpen(false)}
          title={`Change password — ${person.full_name}`}
          size="sm"
        >
          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            {passwordFeedback && (
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 flex gap-2 items-center">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{passwordFeedback}</span>
              </div>
            )}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Current / old password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required when changing your own password"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">New password *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button size="sm" variant="outline" type="button" onClick={() => setIsPasswordModalOpen(false)} disabled={isChangingPassword}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit" isLoading={isChangingPassword} disabled={!newPassword.trim()}>
                <Send className="w-3.5 h-3.5" /> Update Password
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
