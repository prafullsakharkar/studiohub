import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { notify } from '@/core/notifications/notify';
import { useServerForm } from '@/shared/forms/useServerForm';
import { authService } from '../services/AuthService';

// The backend applies its password policy (12+ characters, not common, not all digits) and reports
// every failing reason; it does NOT compare `confirm_password` (verified), so that check is ours.
const schema = z
  .object({
    old_password: z.string().min(1, 'Enter your current password'),
    new_password: z.string().min(1, 'Enter a new password'),
    confirm_password: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.new_password === v.confirm_password, { path: ['confirm_password'], message: 'Passwords do not match.' });
type FormValues = z.infer<typeof schema>;

const FIELDS: Array<{ name: keyof FormValues; label: string; autoComplete: string }> = [
  { name: 'old_password', label: 'Current password', autoComplete: 'current-password' },
  { name: 'new_password', label: 'New password', autoComplete: 'new-password' },
  { name: 'confirm_password', label: 'Confirm new password', autoComplete: 'new-password' },
];

/**
 * Reached voluntarily or because the backend demands it (`password_change_required`, e.g. after an
 * administrator's reset). A successful change ends EVERY session server-side, so we only forget the
 * tokens locally and ask for a fresh sign-in: calling logout on a dead session would 401.
 */
export const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    register,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { old_password: '', new_password: '', confirm_password: '' } });

  const onSubmit = submit(async (values) => {
    await authService.changePassword(values);
    tokenStorage.clearTokens(); // the provider resets the signed-in user on this event
    notify.success('Your password was changed. Sign in with the new password.', { title: 'Password changed' });
    navigate('/login', { replace: true });
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 p-4">
      <form noValidate onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Change your password</h1>

        {(serverError?.banner || serverError?.details.length) && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-800/70 bg-rose-950/60 p-3 text-sm text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div className="space-y-1">
              {serverError?.banner && <p>{serverError.banner}</p>}
              {serverError?.details.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        )}

        {FIELDS.map(({ name, label, autoComplete }) => (
          <div key={name} className="space-y-1">
            <label htmlFor={`cp-${name}`} className="block text-xs font-semibold text-slate-300">
              {label}
            </label>
            <input
              id={`cp-${name}`}
              type="password"
              autoComplete={autoComplete}
              aria-invalid={Boolean(errors[name])}
              {...register(name, { onChange: clearServerError })}
              className="w-full p-2 rounded bg-slate-800"
            />
            {errors[name] && (
              <p role="alert" className="text-xs text-rose-400">
                {errors[name]?.message}
              </p>
            )}
          </div>
        ))}

        <button type="submit" disabled={isSubmitting} className="w-full p-2 rounded bg-indigo-600 disabled:opacity-50">
          {isSubmitting ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </div>
  );
};
