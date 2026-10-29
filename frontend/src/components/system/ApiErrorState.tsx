import React from 'react';
import { ApiError } from '@/api/errors/ApiError';
import { normalizeError } from '@/api/errors/errorMapper';
import {
  ShieldAlert,
  SearchX,
  WifiOff,
  ServerCrash,
  Clock,
  KeyRound,
  UserX,
  Lock,
  Layers,
  RefreshCw,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { useNavigate } from 'react-router-dom';

export interface ApiErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  onReset?: () => void;
  entityName?: string;
  isCompact?: boolean;
  className?: string;
}

export const ApiErrorState: React.FC<ApiErrorStateProps> = ({
  error,
  onRetry,
  onReset,
  entityName,
  isCompact = false,
  className = '',
}) => {
  const navigate = useNavigate();
  const apiError = error instanceof ApiError ? error : normalizeError(error);

  const getVisualConfig = () => {
    switch (apiError.type) {
      case 'NETWORK':
        return {
          icon: <WifiOff className="w-8 h-8 text-rose-400" />,
          title: 'Unable to Connect to StudioHub',
          description: 'Could not establish connection to the VFX pipeline server. Please verify your network.',
          badge: 'OFFLINE / NETWORK ERROR',
          badgeColor: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
          allowRetry: true,
        };
      case 'TIMEOUT':
        return {
          icon: <Clock className="w-8 h-8 text-amber-400" />,
          title: 'Pipeline Server Timed Out',
          description: 'The server took too long to complete your request. Please try again.',
          badge: '504 TIMEOUT',
          badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
          allowRetry: true,
        };
      case 'FORBIDDEN':
        return {
          icon: <ShieldAlert className="w-8 h-8 text-amber-400" />,
          title: 'Permission Denied',
          description: entityName
            ? `You do not have RBAC permission to access this ${entityName}.`
            : "You don't have permission to perform this action.",
          badge: '403 FORBIDDEN',
          badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
          allowRetry: false,
        };
      case 'NOT_FOUND':
        return {
          icon: <SearchX className="w-8 h-8 text-slate-400" />,
          title: entityName ? `${entityName} Not Found` : 'Resource Not Found',
          description: entityName
            ? `The requested ${entityName.toLowerCase()} could not be located or may have been archived.`
            : 'The requested studio resource could not be found.',
          badge: '404 NOT FOUND',
          badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
          allowRetry: false,
        };
      case 'CONFLICT':
        return {
          icon: <Layers className="w-8 h-8 text-amber-400" />,
          title: 'Concurrent Edit Conflict',
          description: 'This record was modified by another production user or session. Refresh to view the latest state.',
          badge: '409 CONFLICT',
          badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
          allowRetry: true,
          retryLabel: 'Refresh Record',
        };
      case 'RATE_LIMIT':
        return {
          icon: <Clock className="w-8 h-8 text-amber-400" />,
          title: 'API Rate Limit Reached',
          description: 'Too many requests were sent in a short window. Please wait a moment before trying again.',
          badge: '429 RATE LIMITED',
          badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
          allowRetry: true,
        };
      case 'ACCOUNT_DISABLED':
        return {
          icon: <UserX className="w-8 h-8 text-rose-400" />,
          title: 'Account Disabled',
          description: 'Your studio user account has been disabled. Please contact your organization administrator.',
          badge: 'ACCOUNT DISABLED',
          badgeColor: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
          allowRetry: false,
        };
      case 'ACCOUNT_LOCKED':
        return {
          icon: <Lock className="w-8 h-8 text-amber-400" />,
          title: 'Account Temporarily Locked',
          description: 'Too many invalid attempts have temporarily locked your account. Please try again later.',
          badge: 'ACCOUNT LOCKED',
          badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
          allowRetry: false,
        };
      case 'AUTHENTICATION':
      case 'SESSION_EXPIRED':
        return {
          icon: <KeyRound className="w-8 h-8 text-cyan-400" />,
          title: 'Session Expired',
          description: 'Your authentication token has expired. Please log in again to continue your work.',
          badge: '401 UNAUTHENTICATED',
          badgeColor: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60',
          allowRetry: false,
        };
      case 'BAD_GATEWAY':
      case 'SERVICE_UNAVAILABLE':
      case 'SERVER':
      default:
        return {
          icon: <ServerCrash className="w-8 h-8 text-rose-400" />,
          title: 'Pipeline Server Error',
          description: apiError.userMessage || 'An unexpected internal error occurred on the studio backend.',
          badge: `${apiError.status || 500} SERVER ERROR`,
          badgeColor: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
          allowRetry: true,
        };
    }
  };

  const config = getVisualConfig();

  if (isCompact) {
    return (
      <div
        id="api-error-state-compact"
        className={`p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 text-slate-200 flex items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center shrink-0">
            {config.icon}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white truncate">{config.title}</h4>
            <p className="text-[11px] text-slate-400 truncate">{config.description}</p>
          </div>
        </div>
        {config.allowRetry && onRetry && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            className="text-xs shrink-0"
          >
            {config.retryLabel || 'Retry'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      id="api-error-state-card"
      className={`min-h-[300px] flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900/70 border border-slate-800 text-center max-w-lg mx-auto space-y-5 shadow-xl ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center mx-auto shadow-inner">
        {config.icon}
      </div>

      <div className="space-y-2 max-w-sm">
        <span className={`inline-block text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded border ${config.badgeColor}`}>
          {config.badge}
        </span>
        <h3 className="text-lg font-bold text-white tracking-tight pt-1">{config.title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{config.description}</p>
        
        {apiError.requestId && (
          <p className="text-[10px] font-mono text-slate-500 pt-1">
            Reference ID: <span className="text-slate-400">{apiError.requestId}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="ghost"
          size="md"
          onClick={() => navigate(-1)}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Go Back
        </Button>

        {config.allowRetry && onRetry && (
          <Button
            variant="primary"
            size="md"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            {config.retryLabel || 'Try Again'}
          </Button>
        )}

        {apiError.isAuthError && (
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/login')}
          >
            Sign In Again
          </Button>
        )}
      </div>
    </div>
  );
};
