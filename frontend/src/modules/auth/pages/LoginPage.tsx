import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '../schemas/authSchemas';
import { useAuth } from '../hooks/useAuth';
import {
  Sparkles,
  Clapperboard,
  Layers,
  Cpu,
  UserCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Info,
  X,
  AlertCircle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Floating notifications dismiss state
  const [showToast1, setShowToast1] = useState(true);
  const [showToast2, setShowToast2] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'supervisor@studiohub.vfx',
      password: 'password123',
      rememberMe: true,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null);
    try {
      await login(data);
      navigate('/dashboard');
    } catch (err: any) {
      setApiError(err?.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleQuickFill = (roleEmail: string) => {
    setValue('email', roleEmail);
    setValue('password', 'password123');
  };

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-100 flex flex-col lg:flex-row antialiased selection:bg-indigo-600 selection:text-white">
      {/* LEFT PANEL: Hero & Branding */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-slate-900 relative">
        {/* Subtle background ambient gradient */}
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
            {/* Feature 1 */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xs">
              <Clapperboard className="w-5 h-5 text-indigo-400 mb-2.5" />
              <h3 className="text-sm font-bold text-white mb-1">
                Real-Time Shot Tracking
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Department pipeline transitions from Layout to Comp.
              </p>
            </div>

            {/* Feature 2 */}
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

      {/* RIGHT PANEL: Sign-In Form & Notifications */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 relative overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Sign In to StudioHub
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
              Enter your studio credentials to access the production management pipeline.
            </p>
          </div>

          {/* Quick Demo Switcher */}
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-400" /> Demo Accounts (Click to Fill)
              </span>
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/20">
                password123
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleQuickFill('supervisor@studiohub.vfx')}
                className="px-3 py-2 text-left text-xs rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors truncate"
              >
                🎬 <span className="font-semibold text-white">Alex Chen</span>{' '}
                <span className="text-slate-400 text-[11px]">(Supervisor)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin@studiohub.vfx')}
                className="px-3 py-2 text-left text-xs rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors truncate"
              >
                🛡️ <span className="font-semibold text-white">Marcus Vance</span>{' '}
                <span className="text-slate-400 text-[11px]">(Admin)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('lead@studiohub.vfx')}
                className="px-3 py-2 text-left text-xs rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors truncate"
              >
                🎨 <span className="font-semibold text-white">Elena Rostova</span>{' '}
                <span className="text-slate-400 text-[11px]">(Lead)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('client@studiohub.vfx')}
                className="px-3 py-2 text-left text-xs rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors truncate"
              >
                👤 <span className="font-semibold text-white">David Miller</span>{' '}
                <span className="text-slate-400 text-[11px]">(Client)</span>
              </button>
            </div>
          </div>

          {apiError && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300">
                Studio Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  placeholder="supervisor@studiohub.vfx"
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

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  {...register('password')}
                  className={`w-full pl-10 pr-10 py-3 bg-slate-900/90 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                    errors.password ? 'border-rose-500' : 'border-slate-800'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-rose-400 font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  id="login-remember"
                  type="checkbox"
                  {...register('rememberMe')}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
                <span>Remember session on this workstation</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Authenticate & Launch</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Activity / Notification Toast Stack */}
          <div className="space-y-2.5 pt-4">
            {showToast1 && (
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-900/40 flex items-start justify-between gap-3 shadow-md">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-white">Shot Approved</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      NK_010_020 has been marked Approved by Alex Chen.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowToast1(false)}
                  className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
                  aria-label="Close notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {showToast2 && (
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-indigo-900/40 flex items-start justify-between gap-3 shadow-md">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-white">New Review Ready</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Version v003 published for NK_010_030.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowToast2(false)}
                  className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
                  aria-label="Close notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
