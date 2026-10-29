import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
  // No length rule here: the backend applies its password policy when a password is *set*,
  // never when one is presented to sign in.
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/** Second login step: a 6-digit authenticator code or a recovery code (never both). */
export const mfaChallengeSchema = z
  .object({
    mode: z.enum(['code', 'recovery']),
    code: z.string().trim().max(10),
    recovery_code: z.string().trim().max(32),
    remember_device: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'code' && !/^\d{6}$/.test(value.code)) {
      ctx.addIssue({ code: 'custom', path: ['code'], message: 'Enter the 6-digit code from your authenticator app' });
    }
    if (value.mode === 'recovery' && value.recovery_code.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['recovery_code'], message: 'Enter one of your recovery codes' });
    }
  });

export type MfaChallengeFormData = z.infer<typeof mfaChallengeSchema>;

export const resetPasswordSchema = z
  .object({
    new_password: z.string().min(1, 'New password is required'),
    confirm_password: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
