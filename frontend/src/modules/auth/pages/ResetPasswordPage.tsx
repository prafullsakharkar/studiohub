import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Clapperboard, Eye, EyeOff, Lock } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useServerForm } from '@/shared/forms/useServerForm';
import { resetPasswordSchema, ResetPasswordFormData } from '../schemas/authSchemas';
import { authService } from '../services/AuthService';

/**
 * Landing page for the password-reset e-mail link: `/reset-password?token=…`
 * (the backend builds exactly this URL, see identity/services/password_reset.py).
 */
export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  });

  const onSubmit = submit(async (values) => {
    await authService.resetPassword({ token, ...values });
    setDone(true);
  });

  const fieldClass = (invalid: boolean) =>
    `w-full pl-9 pr-9 py-2 rounded-xl bg-slate-950/80 border text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono ${
      invalid ? 'border-rose-500' : 'border-slate-800'
    }`;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Clapperboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white uppercase">Choose a new password</h1>
            <p className="text-xs text-slate-400">StudioHub account recovery</p>
          </div>
        </div>

        {!token ? (
          <div role="alert" className="p-3 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p>
              This reset link is incomplete. Open the link from the email again, or{' '}
              <Link to="/forgot-password" className="underline">
                request a new one
              </Link>
              .
            </p>
          </div>
        ) : done ? (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
              <CheckCircle2 className="w-4 h-4" /> Password updated
            </div>
            <p className="text-xs text-slate-300">You can now sign in with your new password.</p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xs cursor-pointer"
            >
              GO TO SIGN IN
            </button>
          </div>
        ) : (
          <form noValidate onSubmit={onSubmit} className="space-y-3">
            {(serverError?.banner || serverError?.details.length) && (
              <div role="alert" className="p-3 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {serverError?.banner && <p>{serverError.banner}</p>}
                  {serverError?.details.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <p>
                    <Link to="/forgot-password" className="underline">
                      Request a new reset link
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {(['new_password', 'confirm_password'] as const).map((name) => (
              <div className="space-y-1" key={name}>
                <label htmlFor={`reset-${name}`} className="block text-[11px] font-semibold text-slate-300">
                  {name === 'new_password' ? 'New password' : 'Confirm new password'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id={`reset-${name}`}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors[name])}
                    {...register(name, { onChange: clearServerError })}
                    className={fieldClass(Boolean(errors[name]))}
                  />
                  {name === 'new_password' && (
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
                {errors[name] && <p className="text-[11px] text-rose-400">{errors[name]?.message}</p>}
              </div>
            ))}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs tracking-wide disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'UPDATING...' : 'SET NEW PASSWORD'}
            </button>
            <div className="text-center">
              <Link to="/login" className="text-xs text-slate-400 hover:text-cyan-400">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
