import React, { useEffect, useState } from 'react';
import { WifiOff, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { centralErrorHandler } from '@/core/api/error-handler';
import { ApiError } from '@/api/errors/ApiError';

export const GlobalApiStatus: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [hasServerFailure, setHasServerFailure] = useState(false);
  const [lastError, setLastError] = useState<ApiError | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      centralErrorHandler.recordSuccess();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubNetwork = centralErrorHandler.onNetworkFailure((err) => {
      setLastError(err);
      if (centralErrorHandler.getConsecutiveNetworkFailures() >= 2) {
        setIsOffline(true);
      }
    });

    const unsubServer = centralErrorHandler.onServerFailure((err) => {
      setLastError(err);
      setHasServerFailure(true);
      setTimeout(() => {
        setHasServerFailure(false);
      }, 10000);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubNetwork();
      unsubServer();
    };
  }, []);

  if (!isOffline && !hasServerFailure) return null;

  return (
    <div
      id="global-api-status-banner"
      className="fixed top-0 left-0 right-0 z-50 bg-rose-950/95 border-b border-rose-500/50 text-white px-4 py-2 text-xs flex items-center justify-between backdrop-blur-md shadow-lg"
    >
      <div className="flex items-center gap-2">
        {isOffline ? (
          <WifiOff className="w-4 h-4 text-rose-400 animate-pulse" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        )}
        <span className="font-medium">
          {isOffline
            ? 'StudioHub Connection Lost — Retrying in background'
            : 'StudioHub Pipeline Degraded — API server returned error'}
        </span>
      </div>

      <button
        onClick={() => {
          setIsOffline(!navigator.onLine);
          setHasServerFailure(false);
          window.location.reload();
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-900/80 hover:bg-rose-800 text-rose-200 rounded border border-rose-700 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Reload</span>
      </button>
    </div>
  );
};
