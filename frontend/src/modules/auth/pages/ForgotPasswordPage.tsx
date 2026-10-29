import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordFormData } from '../schemas/authSchemas';
import {
  Sparkles,
  Clapperboard,
  Cpu,
  Mail,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Lock,
  Zap,
  Globe,
  Film,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ForgotPasswordPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSubmittedEmail(data.email);
    setSubmitted(true);
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden w-full bg-slate-950 text-slate-100 flex items-center justify-center p-3 sm:p-5 lg:p-6 antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-[550px] h-[550px] bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-[550px] h-[550px] bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-7xl h-full max-h-[94vh] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center relative z-10">
        {/* =========================================================================
            LEFT COLUMN: BRAND, STATUS, RECOVERY PROTOCOLS & TELEMETRY
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
              <span>STUDIO CLUSTER ONLINE &bull; 99.99% UPTIME &bull; SECURE RECOVERY GATEWAY</span>
            </div>
          </div>

          {/* 2. Security & Credentials Recovery Protocols Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>CREDENTIAL GOVERNANCE & SECURITY</span>
              </div>
            </div>

            <div>
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase">
                    ZERO-TRUST ID PROTOCOL
                  </span>
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase mt-0.5">
                    SECURE IDENTITY RESTORATION
                  </h2>
                </div>
                <div className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-center">
                  <div className="text-[11px] font-extrabold text-emerald-400">SOC-2 TYPE II</div>
                  <div className="text-[8px] font-mono text-emerald-500 tracking-wider uppercase">
                    COMPLIANCE VERIFIED
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                StudioHub identity services enforce cryptographic single-use reset tokens with strict multi-tenant project boundary isolation and hardware key verification.
              </p>
            </div>

            {/* Protocol Badges */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="flex flex-col items-start p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                <Lock className="w-3.5 h-3.5 mb-1 text-cyan-400" />
                <span className="text-[11px] font-bold text-slate-200">15-Min TTL</span>
                <span className="text-[10px] text-slate-500">Expiring Tokens</span>
              </div>
              <div className="flex flex-col items-start p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                <Zap className="w-3.5 h-3.5 mb-1 text-emerald-400" />
                <span className="text-[11px] font-bold text-slate-200">Instant Sync</span>
                <span className="text-[10px] text-slate-500">LDAP & SSO Bridged</span>
              </div>
              <div className="flex flex-col items-start p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                <Globe className="w-3.5 h-3.5 mb-1 text-blue-400" />
                <span className="text-[11px] font-bold text-slate-200">Audit Logged</span>
                <span className="text-[10px] text-slate-500">Full Pipeline Trace</span>
              </div>
            </div>
          </div>

          {/* 3. Bottom Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-lg font-black text-white">24+</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Studio Facilities</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-lg font-black text-white">14,800+</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Roster Shots & Assets</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-lg font-black text-emerald-400">12 ms</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Sync & Review Latency</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-lg font-black text-cyan-400">Tier 4</div>
              <div className="text-[11px] text-slate-400 mt-0.5">MPAA / CDSA Certified</div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: RECOVERY CONSOLE
            ========================================================================= */}
        <div className="lg:col-span-6 xl:col-span-6 flex justify-center items-center h-full max-h-[90vh]">
          <div className="w-full max-w-lg p-5 sm:p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-3.5 backdrop-blur-sm max-h-[88vh] flex flex-col justify-between overflow-hidden">
            {/* Console Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-slate-300 uppercase">
                <KeyRound className="w-4 h-4 text-cyan-400" />
                <span>RECOVERY CONSOLE</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                ID RESTORATION
              </span>
            </div>

            {/* Main Welcome / Heading */}
            <div className="shrink-0">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                RESET PIPELINE <span className="text-cyan-400">CREDENTIALS</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Enter your registered studio email to receive an OpenID cryptographic recovery token.
              </p>
            </div>

            {submitted ? (
              <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-800/50 space-y-3 shadow-lg shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                      Reset Instructions Dispatched
                    </h3>
                    <p className="text-[11px] text-emerald-400/90 font-mono mt-0.5">
                      {submittedEmail || 'email sent'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  If an active workspace profile is associated with this email, your pipeline TD has dispatched an automated single-use recovery token.
                </p>

                <div className="pt-2">
                  <Link
                    to="/login"
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer group"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                    <span>RETURN TO SIGN IN</span>
                  </Link>
                </div>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 shrink-0">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Registered Studio Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="email"
                      placeholder="artist@studiohub.vfx"
                      {...register('email')}
                      className={`w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all ${
                        errors.email ? 'border-rose-500' : 'border-slate-800'
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-[11px] text-rose-400">{errors.email.message}</p>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all disabled:opacity-60 cursor-pointer group"
                  >
                    <span>{isSubmitting ? 'DISPATCHING TOKEN...' : 'DISPATCH RECOVERY TOKEN'}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>

                <div className="pt-1 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors font-medium cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Workspace Sign In</span>
                  </Link>
                </div>
              </form>
            )}

            {/* Quick Helper / Pipeline Admin Note */}
            <div className="pt-2.5 border-t border-slate-800 space-y-2 shrink-0">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                <Cpu className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  <span className="text-slate-200 font-semibold">Immediate Emergency Access:</span>{' '}
                  Contact your Lead Systems Engineer or Lead VFX Producer via studio internal Slack or mattermost channel.
                </div>
              </div>
            </div>

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
