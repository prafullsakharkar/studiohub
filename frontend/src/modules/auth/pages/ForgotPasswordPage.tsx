import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordFormData } from '../schemas/authSchemas';
import { Button } from '@/shared/components/Button';
import { Mail, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ForgotPasswordPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async () => {
    // Simulated reset flow
    setSubmitted(true);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50 p-6 sm:p-8 backdrop-blur-xl transition-colors duration-200 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 mb-1">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Reset Pipeline Credentials
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Enter your registered studio email to receive an OpenID credential reset link.
        </p>
      </div>

      {submitted ? (
        <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Reset Instructions Dispatched</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            If an account is associated with this email, your pipeline TD has dispatched an automated recovery token.
          </p>
          <Link to="/login" className="inline-block pt-2">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Login
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Studio Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                id="forgot-email"
                type="email"
                placeholder="artist@studiohub.vfx"
                {...register('email')}
                className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all ${
                  errors.email ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500'
                }`}
              />
            </div>
            {errors.email && (
              <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">{errors.email.message}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full shadow-md shadow-indigo-500/20"
            isLoading={isSubmitting}
          >
            Dispatch Recovery Token
          </Button>

          <div className="text-center pt-2">
            <Link
              to="/login"
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
};
