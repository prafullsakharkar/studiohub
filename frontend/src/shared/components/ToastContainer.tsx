import React from 'react';
import { useNotificationStore } from '../stores/useNotificationStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { notifications, clearNotification } = useNotificationStore();

  // Show only unread notifications as floating toasts
  const toastItems = notifications.filter((n) => !n.read).slice(0, 3);

  if (toastItems.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
      {toastItems.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto p-4 rounded-xl border shadow-xl backdrop-blur-md flex items-start gap-3 transition-all animate-in slide-in-from-bottom-3 duration-200 ${
            item.type === 'success'
              ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300'
              : item.type === 'warning'
              ? 'bg-slate-900/95 border-amber-500/40 text-amber-300'
              : item.type === 'error'
              ? 'bg-slate-900/95 border-rose-500/40 text-rose-300'
              : 'bg-slate-900/95 border-indigo-500/40 text-indigo-300'
          }`}
        >
          {item.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />}
          {item.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
          {item.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />}
          {item.type === 'info' && <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />}

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white tracking-tight">{item.title}</h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{item.message}</p>
          </div>

          <button
            onClick={() => clearNotification(item.id)}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
