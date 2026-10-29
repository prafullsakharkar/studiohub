import React, { useState } from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '../schemas/authSchemas';
import { useAuth } from '../hooks/useAuth';
import { useDemoUsers } from '../hooks/useDemoUsers';
import { DemoUser } from '@/types/identity';
import {
  Sparkles,
  Clapperboard,
  Cpu,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sliders,
  Zap,
  Building2,
  Users,
  AlertCircle,
  Film,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface CapabilityTab {
  id: string;
  label: string;
  icon: React.ElementType;
  tag: string;
  title: string;
  readiness: string;
  description: string;
}

const CAPABILITY_TABS: CapabilityTab[] = [
  {
    id: 'athlete',
    label: 'Artist',
    icon: Users,
    tag: 'DEVELOPMENT & PIPELINE',
    title: 'ARTIST WORKLOAD & BIOMETRICS',
    readiness: '99.4% Parity',
    description:
      'Shot turnaround cycles, Houdini/Maya DCC integrations, sub-frame asset caching, and artist task allocation index.',
  },
  {
    id: 'live',
    label: 'Live Dailies',
    icon: Film,
    tag: 'EDITORIAL & REVIEW',
    title: 'REAL-TIME EXR DAILIES & CUT SYNC',
    readiness: '100% Live',
    description:
      'Zero-latency review streaming, multi-facility synchronized playback, color-accurate ACES 1.3 pipelines, and instant EDL conforms.',
  },
  {
    id: 'hawk-eye',
    label: 'OpenUSD',
    icon: Zap,
    tag: 'CORE GRAPH ENGINE',
    title: 'OPENUSD STAGE & HYDRA GRAPH',
    readiness: '14 ms Latency',
    description:
      'Distributed USD composition layers, automated asset variants, LOD schema generation, and real-time viewport validation.',
  },
  {
    id: 'multi-tenant',
    label: 'Multi-Tenant',
    icon: Building2,
    tag: 'ENTERPRISE ISOLATION',
    title: 'VENDOR & CLIENT BOUNDARIES',
    readiness: 'SOC-2 Ready',
    description:
      'Cryptographically isolated vendor studios, least-privilege client screening portals, and automated data masking layers.',
  },
];

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  // REST-only: no backend demo-users endpoint exists, so the instant demo
  // workspaces section is always hidden.
  const showDemoWorkspaces = false;
  const { data: demoAccounts = [], isLoading: isLoadingDemoAccounts } = useDemoUsers();

  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeCapability, setActiveCapability] = useState<string>('athlete');
  const [fastLoggingInId, setFastLoggingInId] = useState<string | null>(null);

  const selectedCapability =
    CAPABILITY_TABS.find((c) => c.id === activeCapability) || CAPABILITY_TABS[0];

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
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
      if (err?.errors?.email?.[0]) {
        setError('email', { type: 'server', message: err.errors.email[0] });
      }
      if (err?.errors?.password?.[0]) {
        setError('password', { type: 'server', message: err.errors.password[0] });
      }
      const errorMsg =
        err?.message ||
        (typeof err === 'string' ? err : 'Login failed. Please check your email and password.');
      setApiError(errorMsg);
    }
  };

  const handleInstantDemoLogin = async (account: DemoUser) => {
    setFastLoggingInId(account.id);
    setApiError(null);
    clearErrors();
    setValue('email', account.email, { shouldValidate: true });
    setValue('password', 'password123', { shouldValidate: true });
    try {
      await login({
        email: account.email,
        password: 'password123',
        rememberMe: true,
      });
      navigate('/dashboard');
    } catch (err: any) {
      const errorMsg =
        err?.message || `Failed to sign in as ${account.name}. Please try again.`;
      setApiError(errorMsg);
    } finally {
      setFastLoggingInId(null);
    }
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden w-full bg-slate-950 text-slate-100 flex items-center justify-center p-3 sm:p-5 lg:p-6 antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-[550px] h-[550px] bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-7xl h-full max-h-[94vh] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center relative z-10">
        {/* =========================================================================
            LEFT COLUMN: BRAND, STATUS, INTELLIGENCE CAPABILITIES & TELEMETRY
            ========================================================================= */}
        <div className="hidden lg:flex lg:col-span-6 xl:col-span-6 flex-col justify-center space-y-4 py-1 max-w-xl ml-auto">
          {/* 1. Brand Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-950/40 shrink-0">
                <Clapperboard className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-serif">
                    STUDIO<span className="text-cyan-400 font-serif">HUB</span>
                  </h1>
                  <span className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                    ENTERPRISE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium tracking-tight">
                  Global Visual Effects & High-Performance Animation OS
                </p>
              </div>
            </div>

            {/* Network Status Banner */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-semibold text-slate-200">STUDIO NETWORK STATUS:</span>
              <span className="text-emerald-400 font-bold">ALL SYSTEMS LIVE</span>
              <span className="text-slate-500">• V4.8 PRODUCTION</span>
            </div>
          </div>

          {/* 2. Dynamic Intelligence Capabilities Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>INTELLIGENCE CAPABILITIES</span>
              </div>
            </div>

            <div>
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase">
                    {selectedCapability.tag}
                  </span>
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase mt-0.5">
                    {selectedCapability.title}
                  </h2>
                </div>
                <div className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-center">
                  <div className="text-[11px] font-extrabold text-emerald-400">{selectedCapability.readiness}</div>
                  <div className="text-[8px] font-mono text-emerald-500 tracking-wider uppercase">
                    READINESS INDEX
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                {selectedCapability.description}
              </p>
            </div>

            {/* 4 Interactive Capability Switchers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
              {CAPABILITY_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeCapability === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCapability(tab.id)}
                    className={`flex flex-col items-start p-2 rounded-xl text-left transition-all duration-150 border ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-xs'
                        : 'bg-slate-950/60 hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 mb-1 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className="text-[11px] font-bold leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Bottom Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-lg font-black text-white">24+</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Studio Facilities</div>
            </div>
            <div className="p-4 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-lg font-black text-white">14,800+</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Roster Shots & Assets</div>
            </div>
            <div className="p-4 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-lg font-black text-emerald-400">12 ms</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Sync & Review Latency</div>
            </div>
            <div className="p-4 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-lg font-black text-cyan-400">Tier 4</div>
              <div className="text-[11px] text-slate-400 mt-0.5">MPAA / CDSA Certified</div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: OPERATING CONSOLE & INSTANT DEMO WORKSPACES
            ========================================================================= */}
        <div className="lg:col-span-6 xl:col-span-6 flex justify-center items-center h-full max-h-[90vh]">
          <div className="w-full max-w-lg p-5 sm:p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-3.5 backdrop-blur-sm max-h-[88vh] flex flex-col justify-between overflow-y-auto scrollbar-thin">
            {/* Console Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-slate-300 uppercase">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>OPERATING CONSOLE</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                AUTH GATEWAY
              </span>
            </div>

            {/* Main Welcome Heading */}
            <div className="shrink-0">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                WELCOME TO STUDIO<span className="text-cyan-400">HUB</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Authenticate your workspace credentials to access governance and live telemetry.
              </p>
            </div>

            {/* API Error Alert */}
            {apiError && (
              <div
                id="login-api-error"
                role="alert"
                aria-live="assertive"
                className="p-3 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-start gap-2.5 shrink-0 shadow-lg shadow-rose-950/40"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-rose-300">Sign In Failed</p>
                  <p className="text-[11px] text-rose-200/90 mt-0.5 leading-normal">{apiError}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form
              noValidate
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-2.5 shrink-0"
            >
              {/* Email */}
              <div className="space-y-1">
                <label htmlFor="login-email-input" className="block text-[11px] font-semibold text-slate-300">
                  Work Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="login-email-input"
                    type="email"
                    {...register('email', {
                      onChange: () => {
                        if (apiError) setApiError(null);
                      },
                    })}
                    placeholder="name@studiohub.vfx"
                    aria-invalid={Boolean(errors.email)}
                    className={`w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all ${
                      errors.email
                        ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-950/20'
                        : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1.5 font-medium mt-1">
                    <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                    <span>{errors.email.message}</span>
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password-input" className="block text-[11px] font-semibold text-slate-300">
                    Workstation Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    {...register('password', {
                      onChange: () => {
                        if (apiError) setApiError(null);
                      },
                    })}
                    placeholder="••••••••••••"
                    aria-invalid={Boolean(errors.password)}
                    className={`w-full pl-9 pr-9 py-2 rounded-xl bg-slate-950/80 border text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all font-mono ${
                      errors.password
                        ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-950/20'
                        : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1.5 font-medium mt-1">
                    <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                    <span>{errors.password.message}</span>
                  </p>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="rememberMe"
                  {...register('rememberMe')}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-[11px] text-slate-400 font-medium cursor-pointer">
                  Keep this session authorized for 30 days
                </label>
              </div>

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all disabled:opacity-60 cursor-pointer group"
              >
                <span>{isSubmitting ? 'AUTHENTICATING...' : 'SIGN IN TO WORKSPACE'}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </button>
            </form>

            {/* INSTANT DEMO WORKSPACES (mock mode only) */}
            {showDemoWorkspaces && (
            <div className="pt-2.5 border-t border-slate-800 space-y-2 min-h-0 flex flex-col flex-1">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>INSTANT DEMO WORKSPACES</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">
                  {isLoadingDemoAccounts
                    ? 'Loading master roles from API...'
                    : `${demoAccounts.length} Master Roles • Click to Fast Login`}
                </span>
              </div>

              {/* Scrollable container for demo workspaces */}
              <div className="space-y-1.5 overflow-y-auto max-h-[190px] sm:max-h-[220px] pr-1 scrollbar-thin">
                {isLoadingDemoAccounts ? (
                  <div className="space-y-1.5 py-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/80 animate-pulse flex items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 shrink-0" />
                          <div className="space-y-1.5">
                            <div className="h-3 w-28 bg-slate-800 rounded" />
                            <div className="h-2 w-40 bg-slate-800/60 rounded" />
                          </div>
                        </div>
                        <div className="w-12 h-6 bg-slate-800 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : demoAccounts.length === 0 ? (
                  <div className="py-4 text-center text-[11px] text-slate-500">
                    No demo accounts found in database.
                  </div>
                ) : (
                  demoAccounts.map((account) => {
                    const isBusy = fastLoggingInId === account.id;
                    return (
                      <div
                        key={account.id}
                        className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-950/80 transition-all flex items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <SmartImg
                            src={account.avatarUrl}
                            alt={account.name}
                            className="w-7 h-7 rounded-lg object-cover shrink-0 border border-slate-700"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-white truncate">
                                {account.name}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${account.roleBadgeColor}`}
                              >
                                {account.roleBadge}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {account.subtitle}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isSubmitting || !!fastLoggingInId}
                          onClick={() => handleInstantDemoLogin(account)}
                          className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 text-[11px] font-bold border border-slate-700 hover:border-cyan-500 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isBusy ? '...' : 'Sign In'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            )}

            {/* Card Security Footnote */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-medium shrink-0">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                TLS 1.3 256-Bit Encrypted
              </span>
              <span>MPAA / CDSA Standard Security</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
