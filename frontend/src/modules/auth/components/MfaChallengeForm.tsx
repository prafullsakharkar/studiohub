import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useServerForm } from '@/shared/forms/useServerForm';
import { mfaChallengeSchema, MfaChallengeFormData } from '../schemas/authSchemas';

interface MfaChallengeFormProps {
  /** Resolves on success; throws the API error otherwise (shown here). */
  onSubmit: (input: { code?: string; recovery_code?: string; remember_device: boolean }) => Promise<void>;
  onBack: () => void;
  /** Seconds the challenge stays valid, from the login response. */
  expiresIn: number;
}

const inputClass = (invalid: boolean) =>
  `w-full px-3 py-2 rounded-xl bg-slate-950/80 border text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all font-mono tracking-widest ${
    invalid
      ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-950/20'
      : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
  }`;

export const MfaChallengeForm: React.FC<MfaChallengeFormProps> = ({ onSubmit, onBack, expiresIn }) => {
  const [mode, setMode] = useState<'code' | 'recovery'>('code');
  const {
    register,
    setValue,
    clearErrors,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<MfaChallengeFormData>({
    resolver: zodResolver(mfaChallengeSchema),
    defaultValues: { mode: 'code', code: '', recovery_code: '', remember_device: false },
  });

  const switchMode = (next: 'code' | 'recovery') => {
    setMode(next);
    setValue('mode', next);
    clearErrors();
    clearServerError();
  };

  const handle = submit(async (values) => {
    await onSubmit({
      ...(values.mode === 'code' ? { code: values.code } : { recovery_code: values.recovery_code }),
      remember_device: values.remember_device,
    });
  });

  const fieldName = mode === 'code' ? 'code' : 'recovery_code';
  const fieldError = errors[fieldName]?.message;

  return (
    <form noValidate onSubmit={handle} className="space-y-3" aria-labelledby="mfa-heading">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <h3 id="mfa-heading" className="text-sm font-black tracking-tight text-white uppercase">
            Two-step verification
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            {mode === 'code'
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Enter one of your single-use recovery codes.'}{' '}
            This sign-in expires in {Math.round(expiresIn / 60)} minutes.
          </p>
        </div>
      </div>

      {serverError?.banner && (
        <div role="alert" className="p-3 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-normal">{serverError.banner}</p>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor={`mfa-${fieldName}`} className="block text-[11px] font-semibold text-slate-300">
          {mode === 'code' ? 'Authentication code' : 'Recovery code'}
        </label>
        {mode === 'code' ? (
          <input
            id="mfa-code"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-invalid={Boolean(errors.code)}
            {...register('code', { onChange: clearServerError })}
            className={inputClass(Boolean(errors.code))}
          />
        ) : (
          <input
            id="mfa-recovery_code"
            autoFocus
            autoComplete="off"
            placeholder="xxxx-xxxx"
            aria-invalid={Boolean(errors.recovery_code)}
            {...register('recovery_code', { onChange: clearServerError })}
            className={inputClass(Boolean(errors.recovery_code))}
          />
        )}
        {fieldError && (
          <p className="text-[11px] text-rose-400 flex items-center gap-1.5 font-medium mt-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{fieldError}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="mfa-remember"
          type="checkbox"
          {...register('remember_device')}
          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
        />
        <label htmlFor="mfa-remember" className="text-[11px] text-slate-400 font-medium cursor-pointer">
          Trust this device
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs tracking-wide disabled:opacity-60 cursor-pointer"
      >
        {isSubmitting ? 'VERIFYING...' : 'VERIFY AND SIGN IN'}
      </button>

      <div className="flex items-center justify-between text-[11px]">
        <button type="button" onClick={onBack} className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 cursor-pointer">
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </button>
        <button
          type="button"
          onClick={() => switchMode(mode === 'code' ? 'recovery' : 'code')}
          className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
        >
          <KeyRound className="w-3 h-3" />
          {mode === 'code' ? 'Use a recovery code' : 'Use authenticator code'}
        </button>
      </div>
    </form>
  );
};
