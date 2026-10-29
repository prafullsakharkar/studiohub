import type React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MfaEnrollmentPanel } from '../components/MfaEnrollmentPanel';
import { useAuth } from '../hooks/useAuth';

/**
 * Two-factor enrollment. Reached automatically when the backend says this account must have MFA
 * (`mfa_enrollment_required`): until it is done every other endpoint answers 403. Settings will
 * reuse the same API later for devices and recovery codes.
 */
export const MfaSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, clearRestriction, refreshUser } = useAuth();
  const finish = async () => {
    clearRestriction();
    await refreshUser().catch(() => undefined);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white uppercase">Set up two-factor authentication</h1>
            <p className="text-xs text-slate-400">Required for your account before you can continue.</p>
          </div>
        </div>

        <MfaEnrollmentPanel onFinished={finish} finishLabel="Continue to StudioHub" />

        <div className="text-center">
          <button type="button" onClick={() => void logout()} className="text-xs text-slate-500 hover:text-cyan-400 cursor-pointer">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
