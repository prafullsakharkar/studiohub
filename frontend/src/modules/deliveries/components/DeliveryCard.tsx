import React from 'react';
import { DeliveryPackage } from '@/types/deliveries';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCcw,
  Check,
  Ban,
  Calendar,
  Building,
  HardDrive,
  FileCheck,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface DeliveryCardProps {
  delivery: DeliveryPackage;
  onOpenWorkspace: (id: string) => void;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRetry: (id: string) => void;
  onPrepare: (id: string) => void;
}

export const DeliveryCard: React.FC<DeliveryCardProps> = ({
  delivery,
  onOpenWorkspace,
  onSubmit,
  onApprove,
  onReject,
  onRetry,
  onPrepare,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> {status}
          </span>
        );
      case 'Submitted':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> Submitted
          </span>
        );
      case 'Ready':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5" /> Ready for Submit
          </span>
        );
      case 'Preparing':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Packaging...
          </span>
        );
      case 'Rejected':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case 'Cancelled':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Draft
          </span>
        );
    }
  };

  const isDueSoon = new Date(delivery.due_date).getTime() - Date.now() < 3 * 86400000;

  return (
    <Card
      id={`delivery-card-${delivery.id}`}
      className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all duration-200 overflow-hidden flex flex-col justify-between group shadow-sm"
    >
      <div>
        {/* Card Header with thumbnail & preview */}
        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden border-b border-slate-800/80">
          <img
            src={delivery.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600'}
            alt={delivery.package_code}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-85 group-hover:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/50 pointer-events-none" />

          {/* Top badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-auto">
            <span className="px-2 py-0.5 rounded bg-black/80 text-indigo-300 font-mono text-[11px] font-bold border border-slate-700">
              {delivery.package_code}
            </span>
            <div>{getStatusBadge(delivery.status)}</div>
          </div>

          {/* Bottom stats overlay */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span className="bg-black/80 px-2 py-0.5 rounded border border-slate-800 text-emerald-400">
              {delivery.total_shots_count || delivery.versions?.length || 0} Shots / Cuts
            </span>
            <span className="bg-black/80 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
              {delivery.total_size_formatted || '40.00 GB'}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3">
          <div>
            <h3
              onClick={() => onOpenWorkspace(delivery.id)}
              className="font-semibold text-white text-sm hover:text-indigo-400 cursor-pointer transition-colors line-clamp-1"
            >
              {delivery.title}
            </h3>
            <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">{delivery.description}</p>
          </div>

          {/* Client and Destination */}
          <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Building className="w-3.5 h-3.5 text-indigo-400" /> Client:
              </span>
              <span className="text-white font-medium truncate max-w-[170px]">{delivery.client.name}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" /> Destination:
              </span>
              <span className="text-slate-300 font-mono text-[11px] truncate max-w-[170px]">
                {delivery.destination.type}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Due Date:
              </span>
              <span
                className={`font-mono text-[11px] ${
                  isDueSoon && delivery.status !== 'Approved' && delivery.status !== 'Completed'
                    ? 'text-rose-400 font-bold'
                    : 'text-slate-300'
                }`}
              >
                {new Date(delivery.due_date).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Rejection Alert if rejected */}
          {delivery.status === 'Rejected' && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="block font-semibold">Client Returned Package:</strong>
                <span className="line-clamp-2 text-[11px] mt-0.5">{delivery.rejection_reason}</span>
              </div>
            </div>
          )}

          {/* Active transfer progress if submitted */}
          {delivery.status === 'Submitted' && delivery.transfer_progress_percent !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Transfer Progress:</span>
                <span className="text-indigo-400 font-bold">{delivery.transfer_progress_percent}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${delivery.transfer_progress_percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-2">
        <Button
          id={`btn-open-workspace-${delivery.id}`}
          variant="primary"
          size="sm"
          onClick={() => onOpenWorkspace(delivery.id)}
          className="text-xs flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          Delivery Workspace
        </Button>

        {delivery.status === 'Draft' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPrepare(delivery.id)}
            className="text-xs text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10"
          >
            Prepare
          </Button>
        )}

        {delivery.status === 'Ready' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSubmit(delivery.id)}
            className="text-xs text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/10"
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Submit
          </Button>
        )}

        {delivery.status === 'Submitted' && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onApprove(delivery.id)}
              className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 px-2"
              title="Client Approve"
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject(delivery.id)}
              className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 px-2"
              title="Client Reject"
            >
              <XCircle className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {delivery.status === 'Rejected' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRetry(delivery.id)}
            className="text-xs text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Retry Package
          </Button>
        )}
      </div>
    </Card>
  );
};
