import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/AuthService';
import { useAuth } from '../hooks/useAuth';

export const ChangePasswordPage: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Backend revokes every session on change: force a fresh login.
      await authService.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirm,
      });
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Change your password</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input type="password" placeholder="Current password" value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)} className="w-full p-2 rounded bg-slate-800" />
        <input type="password" placeholder="New password" value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2 rounded bg-slate-800" />
        <input type="password" placeholder="Confirm new password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} className="w-full p-2 rounded bg-slate-800" />
        <button type="submit" disabled={submitting}
          className="w-full p-2 rounded bg-indigo-600 disabled:opacity-50">
          {submitting ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </div>
  );
};
