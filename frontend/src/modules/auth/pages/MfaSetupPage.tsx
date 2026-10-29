import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { mfaApi } from '@/api/identity/mfa';
import type { TotpEnabled } from '@/api/identity/mfa';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Button } from '@/shared/components/Button';
import { useAuth } from '../hooks/useAuth';

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app') });
type FormValues = z.infer<typeof schema>;

/**
 * Two-factor enrollment. Reached automatically when the backend says this account must have MFA
 * (`mfa_enrollment_required`): until it is done every other endpoint answers 403. Settings will
 * reuse the same API later for devices and recovery codes.
 */
export const MfaSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, clearRestriction, refreshUser } = useAuth();
  const [enabled, setEnabled] = useState<TotpEnabled | null>(null);
  const [saved, setSaved] = useState(false);

  // One pending secret per visit; it is only returned by this call.
  const setup = useQuery({ queryKey: ['mfa', 'totp-setup'], queryFn: () => mfaApi.setup(), staleTime: Infinity, gcTime: 0, retry: false });

  const {
    register,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { code: '' } });

  const onSubmit = submit(async ({ code }) => {
    setEnabled(await mfaApi.enable(code));
  });

  const finish = async () => {
    clearRestriction();
    await refreshUser().catch(() => undefined);
    navigate('/dashboard', { replace: true });
  };

  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => undefined);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white uppercase">Set up two-factor authentication</h1>
            <p className="text-xs text-slate-400">Required for your account before you can continue.</p>
          </div>
        </div>

        {enabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
              <CheckCircle2 className="w-4 h-4" /> Two-factor authentication is on
            </div>
            <p className="text-xs text-slate-300">
              Save these recovery codes somewhere safe. Each works once if you lose your authenticator. They are shown only now.
            </p>
            <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-2 font-mono text-xs">
              {enabled.recovery_codes.map((code, index) => (
                <li key={`${index}-${code}`} className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-center">
                  {code}
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" leftIcon={<Copy className="w-3.5 h-3.5" />} onClick={() => copy(enabled.recovery_codes.join('\n'))}>
              Copy codes
            </Button>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have saved my recovery codes
            </label>
            <Button variant="primary" size="sm" disabled={!saved} onClick={() => void finish()} className="w-full">
              Continue to StudioHub
            </Button>
          </div>
        ) : (
          <QueryBoundary isLoading={setup.isLoading} error={setup.error} onRetry={() => void setup.refetch()} entityName="two-factor setup">
            {setup.data && (
              <form noValidate onSubmit={onSubmit} className="space-y-3">
                <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
                  <li>Scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy…).</li>
                  <li>Enter the 6-digit code the app shows.</li>
                </ol>
                <img src={setup.data.qr_code} alt="QR code for your authenticator app" className="mx-auto h-44 w-44 rounded bg-white p-2" />
                <div className="text-center">
                  <p className="text-[11px] text-slate-500">Or enter this key manually</p>
                  <code className="text-xs font-mono text-cyan-300 break-all">{setup.data.secret}</code>
                </div>

                {serverError?.banner && (
                  <div role="alert" className="p-3 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <p>{serverError.banner}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="mfa-setup-code" className="block text-[11px] font-semibold text-slate-300">
                    Authentication code
                  </label>
                  <input
                    id="mfa-setup-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    aria-invalid={Boolean(errors.code)}
                    {...register('code', { onChange: clearServerError })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-sm font-mono tracking-widest text-slate-100 focus:outline-hidden focus:border-cyan-500"
                  />
                  {errors.code && <p className="text-[11px] text-rose-400">{errors.code.message}</p>}
                </div>
                <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} leftIcon={<KeyRound className="w-3.5 h-3.5" />} className="w-full">
                  Turn on two-factor authentication
                </Button>
              </form>
            )}
          </QueryBoundary>
        )}

        <div className="text-center">
          <button type="button" onClick={() => void logout()} className="text-xs text-slate-500 hover:text-cyan-400 cursor-pointer">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
