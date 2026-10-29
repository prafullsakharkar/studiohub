import { zodResolver } from '@hookform/resolvers/zod';
import type React from 'react';
import { z } from 'zod';
import { notify } from '@/core/notifications/notify';
import { useAuth } from '@/modules/auth';
import { Button } from '@/shared/components/Button';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Field, FormBanner, inputClass } from '../components/ui';

// Only first/last name are both writable AND returned by /auth/me/ (timezone, language, phone and bio are
// accepted by PATCH but never read back, docs/sync Q-11), so they are not offered here.
const schema = z.object({ first_name: z.string().trim().max(150), last_name: z.string().trim().max(150) });
type Values = z.infer<typeof schema>;

export const ProfilePage: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const {
    register,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useServerForm<Values>({ resolver: zodResolver(schema), defaultValues: { first_name: user?.first_name ?? '', last_name: user?.last_name ?? '' } });

  const onSubmit = submit(async (values) => {
    const updated = await updateUserProfile(values);
    reset({ first_name: updated.first_name ?? '', last_name: updated.last_name ?? '' });
    notify.success('Your profile was saved.');
  });

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-md space-y-4">
      <FormBanner error={serverError} />
      <div>
        <p className="text-xs font-mono text-slate-400">Email</p>
        <p className="text-sm text-slate-200">{user?.email}</p>
        <p className="text-[11px] text-slate-500">Your email is your sign-in name; an administrator changes it.</p>
      </div>
      <Field id="profile-first" label="First name" error={errors.first_name?.message}>
        <input id="profile-first" autoComplete="given-name" className={inputClass(Boolean(errors.first_name))} {...register('first_name', { onChange: clearServerError })} />
      </Field>
      <Field id="profile-last" label="Last name" error={errors.last_name?.message}>
        <input id="profile-last" autoComplete="family-name" className={inputClass(Boolean(errors.last_name))} {...register('last_name', { onChange: clearServerError })} />
      </Field>
      <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} disabled={!isDirty}>
        Save profile
      </Button>
    </form>
  );
};
