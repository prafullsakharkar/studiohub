import { zodResolver } from '@hookform/resolvers/zod';
import type React from 'react';
import { useState } from 'react';
import { z } from 'zod';
import type { MfaReauth } from '@/api/identity/mfa';
import { FormDialog } from '@/shared/forms/FormDialog';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Field, inputClass } from '../components/ui';

const schema = z.object({ password: z.string().min(1, 'Enter your password'), code: z.string().trim().min(1, 'Enter a code') });
type Values = z.infer<typeof schema>;

export interface ReauthDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  submitLabel: string;
  destructive?: boolean;
  onClose: () => void;
  /** Resolve to close the dialog; throw to keep it open and show the server's reason. */
  onSubmit: (reauth: MfaReauth) => Promise<void>;
}

/**
 * Sensitive MFA changes need the password AND a verification code (or a recovery code). With only the
 * password the API answers `400 "Invalid verification code."` (docs/sync captures).
 */
const ReauthForm: React.FC<Omit<ReauthDialogProps, 'isOpen'>> = ({ title, description, submitLabel, destructive, onClose, onSubmit }) => {
  const [useRecovery, setUseRecovery] = useState(false);
  const {
    register,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting, isDirty },
  } = useServerForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', code: '' } });

  const send = submit(async ({ password, code }) => {
    await onSubmit({ password, ...(useRecovery ? { recovery_code: code } : { code }) });
    onClose();
  });

  return (
    <FormDialog
      title={title}
      size="sm"
      onClose={onClose}
      onSubmit={send}
      isSubmitting={isSubmitting}
      isDirty={isDirty}
      serverError={serverError}
      submitLabel={submitLabel}
      submitVariant={destructive ? 'danger' : 'primary'}
      intro={<p className="text-xs text-slate-400">{description}</p>}
    >
      <Field id="reauth-password" label="Password *" error={errors.password?.message}>
        <input id="reauth-password" type="password" autoComplete="current-password" className={inputClass(Boolean(errors.password))} {...register('password', { onChange: clearServerError })} />
      </Field>
      <Field id="reauth-code" label={useRecovery ? 'Recovery code *' : 'Authentication code *'} error={errors.code?.message}>
        <input id="reauth-code" autoComplete="one-time-code" className={inputClass(Boolean(errors.code))} {...register('code', { onChange: clearServerError })} />
      </Field>
      <button type="button" className="text-[11px] text-cyan-300 hover:underline" onClick={() => setUseRecovery((v) => !v)}>
        {useRecovery ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
      </button>
    </FormDialog>
  );
};

/** Mounted only while open, so every open starts empty (and on the authenticator code). */
export const ReauthDialog: React.FC<ReauthDialogProps> = ({ isOpen, ...rest }) => (isOpen ? <ReauthForm {...rest} /> : null);
