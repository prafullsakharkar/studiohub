import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordFormData } from '../schemas/authSchemas';
import {
  Sparkles,
  Clapperboard,
  Layers,
  Cpu,
  Mail,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
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
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-100 flex flex-col lg:flex-row antialiased selection:bg-indigo-600 selection:text-white">
      {/* LEFT PANEL: Hero & Branding */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-slate-900 relative">
        <div className="absolute top-1/4 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top: Studio Logo */}
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Sparkles className="w-5 h-5 fill-white/20" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">
              StudioHub VFX
            </h1>
            <p className="text-xs font-mono text-indigo-400 font-medium">
              Production Operating System
            </p>
          </div>
        </div>

        {/* Middle: Feature Highlights */}
        <div className="my-12 lg:my-auto max-w-xl relative z-10">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-mono font-medium tracking-wider text-indigo-400 border border-indigo-500/30 bg-indigo-950/40 uppercase mb-6 shadow-xs">
            OPENUSD & ACES 1.3 NATIVE
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-white tracking-tight leading-[1.15] mb-6">
            Enterprise VFX & Animation Production Management.
          </h2>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed mb-10">
            Manage high-volume shot iterations, asset versions, Maya/Houdini/Nuke pipeline workflows, and screening room approvals with mathematically reliable Clean Architecture.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xs">
              <Clapperboard className="w-5 h-5 text-indigo-400 mb-2.5" />
              <h3 className="text-sm font-bold text-white mb-1">
                Real-Time Shot Tracking
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Department pipeline transitions from Layout to Comp.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xs">
              <Layers className="w-5 h-5 text-indigo-400 mb-2.5" />
              <h3 className="text-sm font-bold text-white mb-1">
                OpenUSD Asset Graph
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Unified digital assets, LODs, shaders, and variant sets.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: Version & Security status */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-6 relative z-10 border-t border-slate-900/80">
          <span>Apex Digital Studios Platform v2.4</span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400/90">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Secure JWT & RBAC Active
          </span>
        </div>
      </div>

      {/* RIGHT PANEL: Reset Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 relative overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 mb-1">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Reset Pipeline Credentials
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Enter your registered studio email to receive an OpenID credential reset link.
            </p>
          </div>

          {submitted ? (
            <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-800/50 text-center space-y-4 shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-semibold text-white">Reset Instructions Dispatched</h3>
              <p className="text-xs text-slate-300">
                If an account is associated with this email, your pipeline TD has dispatched an automated recovery token.
              </p>
              <Link to="/login" className="inline-block pt-2">
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-300">
                  Studio Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="artist@studiohub.vfx"
                    {...register('email')}
                    className={`w-full pl-10 pr-4 py-3 bg-slate-900/90 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                      errors.email ? 'border-rose-500' : 'border-slate-800'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-[11px] text-rose-400 font-medium">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Dispatching...' : 'Dispatch Recovery Token'}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
