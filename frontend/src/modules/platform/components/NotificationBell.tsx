// Notification Bell Component
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, XCircle, CheckCircle2, Clock, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { useUnreadCount, useNotifications, useMarkAllAsRead } from '@/modules/platform/hooks/useNotifications';
import { Notification, PlatformChannel, PlatformPriority, PlatformEventType } from '@/modules/platform/types';

interface NotificationBellProps {
    className?: string;
    showBadge?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
    className,
    showBadge = true,
    size = 'md',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const bellRef = useRef<HTMLDivElement>(null);

    const { data: unreadCount } = useUnreadCount();
    const { data: notifications, isLoading, error } = useNotifications({
        page: 1,
        page_size: 10,
        read: false,
    });

    const markAllAsReadMutation = useMarkAllAsRead();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleMarkAllAsRead = async () => {
        await markAllAsReadMutation.mutateAsync();
        setIsOpen(false);
    };

    const getChannelIcon = (channel: PlatformChannel) => {
        switch (channel) {
            case 'EMAIL':
                return <span className="text-blue-400">✉️</span>;
            case 'IN_APP':
                return <span className="text-purple-400">🔔</span>;
            case 'WEBHOOK':
                return <span className="text-green-400">🔗</span>;
            case 'SMS':
                return <span className="text-yellow-400">📱</span>;
            case 'PUSH':
                return <span className="text-orange-400">📱</span>;
            default:
                return <Bell className="w-4 h-4" />;
        }
    };

    const getPriorityColor = (priority: PlatformPriority) => {
        switch (priority) {
            case 'CRITICAL':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'HIGH':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'MEDIUM':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'LOW':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default:
                return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    const getEventTypeIcon = (type: PlatformEventType) => {
        switch (type) {
            case 'SYSTEM':
                return <Info className="w-4 h-4 text-blue-400" />;
            case 'SECURITY':
                return <AlertTriangle className="w-4 h-4 text-red-400" />;
            case 'COMPETITION':
                return <Bell className="w-4 h-4 text-purple-400" />;
            case 'MATCH':
                return <CheckCircle2 className="w-4 h-4 text-green-400" />;
            case 'PLAYER':
                return <span className="text-pink-400">👤</span>;
            case 'TEAM':
                return <span className="text-teal-400">👥</span>;
            case 'TRAINING':
                return <span className="text-indigo-400">🏋️</span>;
            case 'FINANCE':
                return <span className="text-emerald-400">💰</span>;
            case 'ADMINISTRATION':
                return <span className="text-slate-400">⚙️</span>;
            case 'WORKFLOW':
                return <span className="text-amber-400">🔄</span>;
            default:
                return <Bell className="w-4 h-4 text-slate-400" />;
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const sizeClasses: Record<string, string> = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
    };

    const iconSize: Record<string, string> = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    };

    return (
        <div className={cn('relative', className)} ref={bellRef}>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'relative transition-colors hover:bg-slate-800/50 p-0',
                    sizeClasses[size] || sizeClasses.md
                )}
            >
                <Bell className={cn(iconSize[size] || iconSize.md, 'transition-transform', isOpen && 'scale-110')} />
                {showBadge && unreadCount?.count && unreadCount.count > 0 && (
                    <Badge
                        className={cn(
                            'absolute -top-1 -right-1 flex items-center justify-center px-1 min-w-[18px] h-[18px] text-[10px] font-bold',
                            unreadCount.count > 9 ? 'px-1.5' : ''
                        )}
                    >
                        {unreadCount.count > 9 ? '9+' : unreadCount.count}
                    </Badge>
                )}
            </Button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                        <h3 className="font-semibold text-slate-200">Notifications</h3>
                        {unreadCount?.count && unreadCount.count > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleMarkAllAsRead}
                                disabled={markAllAsReadMutation.isPending}
                                className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            >
                                Mark all read
                            </Button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="max-h-[500px] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                <XCircle className="w-8 h-8 mb-2 text-red-500" />
                                <p className="text-sm">Failed to load notifications</p>
                            </div>
                        ) : notifications?.results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                <BellOff className="w-8 h-8 mb-2" />
                                <p className="text-sm">No notifications</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {notifications?.results.map((notification) => (
                                    <Link
                                        key={notification.id}
                                        to={`/platform/notifications/${notification.id}`}
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-start gap-3 p-3 hover:bg-slate-800/50 transition-colors group"
                                    >
                                        <div className="flex-shrink-0 mt-0.5">
                                            {getChannelIcon(notification.channel)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between">
                                                <p className={cn(
                                                    'text-sm font-medium truncate pr-2',
                                                    !notification.read && 'text-slate-200'
                                                )}>
                                                    {notification.title}
                                                </p>
                                                {!notification.read && (
                                                    <span className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500" />
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                                    {getEventTypeIcon(notification.type)}
                                                    {notification.type.replace('_', ' ')}
                                                </span>
                                                <span className="text-[10px] text-slate-500">•</span>
                                                <span className="text-[10px] text-slate-500">
                                                    {formatTime(notification.created_at)}
                                                </span>
                                                {notification.priority && (
                                                    <>
                                                        <span className="text-[10px] text-slate-500">•</span>
                                                        <Badge
                                                            variant="neutral"
                                                            className={cn(
                                                                'text-[10px] px-1 py-0',
                                                                getPriorityColor(notification.priority)
                                                            )}
                                                        >
                                                            {notification.priority}
                                                        </Badge>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications?.results.length && notifications.results.length > 0 && (
                        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50">
                            <Link
                                to="/platform/notifications"
                                onClick={() => setIsOpen(false)}
                                className="block w-full text-center text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded py-1 transition-colors"
                            >
                                View all notifications
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
