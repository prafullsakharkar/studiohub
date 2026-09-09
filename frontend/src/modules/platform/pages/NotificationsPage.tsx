import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  Search,
  Check,
  Film,
  HardDrive,
  Trash2,
} from 'lucide-react';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/shared/utils/cn';
import { Link } from 'react-router-dom';

export const NotificationsPage: React.FC = () => {
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const [filterCategory, setFilterCategory] = useState('ALL');

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-5 animate-in fade-in duration-200 max-w-4xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Production Alerts & Dispatch</h1>
            {unreadCount > 0 && (
              <Badge variant="outline" className="font-mono text-xs text-rose-300 border-rose-500/30 bg-rose-950/20">
                {unreadCount} Unread
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time supervisor dailies approvals, render farm queue spikes, vendor matting deliveries, and delivery milestones.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Check className="w-3.5 h-3.5" />}
            onClick={markAllAsRead}
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Notifications Roster */}
      <div className="space-y-2.5">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => markAsRead(n.id)}
            className={cn(
              'p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-4',
              !n.read
                ? 'bg-slate-900 border-indigo-500/40 shadow-sm'
                : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
            )}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {n.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400" />}
                {n.type === 'info' && <Layers className="w-4 h-4 text-sky-400" />}
                {n.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">{n.title}</h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-indigo-400 border border-slate-800">
                    {n.category || 'Production'}
                  </span>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                <span className="text-[10px] font-mono text-slate-500 block">{n.timestamp}</span>
              </div>
            </div>

            {n.link && (
              <Link
                to={n.link}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-indigo-400 shrink-0 transition-colors"
              >
                Inspect
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
