import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '../schemas/authSchemas';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/shared/components/Button';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

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
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">Sign In to StudioHub</h2>
        <p className="text-xs text-slate-400">
          Enter your studio credentials to access the production management pipeline.
        </p>
      </div>

      {/* Quick Demo Switcher for Evaluation */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> Demo Accounts (Click to Fill)
          </span>
          <span className="text-[10px] font-mono text-indigo-400">password123</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => handleQuickFill('supervisor@studiohub.vfx')}
            className="px-2.5 py-1.5 text-left text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all truncate"
          >
            🎬 <span className="font-semibold">Alex Chen</span> (Supervisor)
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('admin@studiohub.vfx')}
            className="px-2.5 py-1.5 text-left text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all truncate"
          >
            🛡️ <span className="font-semibold">Marcus Vance</span> (Admin)
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('lead@studiohub.vfx')}
            className="px-2.5 py-1.5 text-left text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all truncate"
          >
            🎨 <span className="font-semibold">Elena Rostova</span> (Lead)
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('client@studiohub.vfx')}
            className="px-2.5 py-1.5 text-left text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all truncate"
          >
            👤 <span className="font-semibold">David Miller</span> (Client)
          </button>
        </div>
      </div>

      {apiError && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300">
            Studio Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500 pointer-events-none" />
            <input
              id="login-email"
              type="email"
              placeholder="artist@studiohub.vfx"
              {...register('email')}
              className={`w-full pl-9 pr-4 py-2.5 bg-slate-900 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                errors.email ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
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
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500 pointer-events-none" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('password')}
              className={`w-full pl-9 pr-10 py-2.5 bg-slate-900 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                errors.password ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
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
          <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              id="login-remember"
              type="checkbox"
              {...register('rememberMe')}
              className="w-4 h-4 rounded-md border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950"
            />
            <span>Remember session on this workstation</span>
          </label>
        </div>

        {/* Submit Button */}
        <Button
          id="login-submit-btn"
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          isLoading={isSubmitting}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Authenticate & Launch
        </Button>
      </form>
    </div>
  );
};
