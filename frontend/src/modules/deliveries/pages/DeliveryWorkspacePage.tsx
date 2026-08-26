import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDeliveryWorkspace } from '../hooks/useDeliveryWorkspace';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { DeliveryApprovalModal } from '../components/DeliveryApprovalModal';
import { DeliveryRejectModal } from '../components/DeliveryRejectModal';
import { DeliveryCancelModal } from '../components/DeliveryCancelModal';
import { AddVersionModal } from '../components/AddVersionModal';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCcw,
  Ban,
  Check,
  Building,
  HardDrive,
  Calendar,
  Layers,
  FileCheck,
  FileCode,
  ShieldCheck,
  Copy,
  Terminal,
  ExternalLink,
  Film,
  Plus,
  Trash2,
  Play,
  Download,
  Eye,
  RefreshCw,
  Mail,
  User,
  CheckSquare,
  Activity,
  History as HistoryIcon,
} from 'lucide-react';

export const DeliveryWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    delivery,
    loading,
    error,
    refresh,
    prepare,
    validate,
    submit,
    approve,
    reject,
    retry,
    complete,
    cancel,
    addVersion,
    removeVersion,
  } = useDeliveryWorkspace(id || '');

  // 8 Workspace Tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'contents' | 'validation' | 'media' | 'client' | 'status' | 'history' | 'activity'
  >('overview');

  // Video Preview Modal State
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // Modals
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isAddVersionOpen, setIsAddVersionOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-xs font-mono">Mounting Delivery Workspace & Initializing QC Manifests...</p>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Delivery Package Not Found</h2>
        <p className="text-xs text-slate-400">{error || 'The requested delivery identifier does not exist.'}</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/deliveries')}>
          Return to Deliveries Hub
        </Button>
      </div>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> {status}
          </span>
        );
      case 'Submitted':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> Submitted (In Transfer)
          </span>
        );
      case 'Ready':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5" /> Ready for Client Submit
          </span>
        );
      case 'Preparing':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5 animate-pulse">
            <Clock className="w-3.5 h-3.5 animate-spin" /> Packaging Media...
          </span>
        );
      case 'Rejected':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Client Rejected
          </span>
        );
      case 'Cancelled':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Draft Package
          </span>
        );
    }
  };

  return (
    <div id="delivery-workspace-root" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/deliveries')}
            className="text-xs text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Deliveries
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {delivery.package_code}
              </span>
              <h1 className="text-lg font-bold text-white truncate max-w-xl">{delivery.title}</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Project: <strong className="text-slate-300">{delivery.project_name}</strong> • Milestone:{' '}
              <strong className="text-slate-300">{delivery.milestone_name}</strong>
            </p>
          </div>
        </div>

        {/* Dynamic Operation Buttons Header */}
        <div className="flex items-center flex-wrap gap-2">
          {delivery.status === 'Draft' && (
            <Button
              id="op-btn-prepare"
              variant="primary"
              size="sm"
              onClick={() => prepare(user?.full_name)}
              className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
              leftIcon={<FileCheck className="w-3.5 h-3.5" />}
            >
              Prepare Package
            </Button>
          )}

          <Button
            id="op-btn-validate"
            variant="outline"
            size="sm"
            onClick={() => validate('QC Inspector')}
            className="text-xs text-slate-300 hover:text-white"
            leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />}
          >
            Validate QC
          </Button>

          {delivery.status === 'Ready' && (
            <Button
              id="op-btn-submit"
              variant="primary"
              size="sm"
              onClick={() => submit(user?.full_name)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Submit to Client
            </Button>
          )}

          {delivery.status === 'Submitted' && (
            <>
              <Button
                id="op-btn-approve"
                variant="primary"
                size="sm"
                onClick={() => setIsApproveOpen(true)}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Approve
              </Button>
              <Button
                id="op-btn-reject"
                variant="outline"
                size="sm"
                onClick={() => setIsRejectOpen(true)}
                className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
              >
                Reject / Retake
              </Button>
            </>
          )}

          {delivery.status === 'Rejected' && (
            <Button
              id="op-btn-retry"
              variant="primary"
              size="sm"
              onClick={() => retry(user?.full_name)}
              className="text-xs bg-amber-600 hover:bg-amber-500 text-white"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Retry & Re-Package
            </Button>
          )}

          {delivery.status === 'Approved' && (
            <Button
              id="op-btn-complete"
              variant="primary"
              size="sm"
              onClick={() => complete(user?.full_name)}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Complete & Archive
            </Button>
          )}

          {delivery.status !== 'Cancelled' && delivery.status !== 'Completed' && (
            <Button
              id="op-btn-cancel"
              variant="outline"
              size="sm"
              onClick={() => setIsCancelOpen(true)}
              className="text-xs text-slate-500 hover:text-rose-400 border-slate-800 hover:border-rose-500/30"
              title="Cancel Delivery Package"
            >
              <Ban className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 8 Workspace Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 overflow-x-auto pb-2 text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => setActiveTab('contents')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'contents'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          Contents ({delivery.versions?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('validation')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'validation'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Validation ({delivery.validation_checks?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('media')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'media'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          Media Files ({delivery.media_files?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('client')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'client'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          Client Portal
        </button>

        <button
          onClick={() => setActiveTab('status')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'status'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Status & Lifecycle
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <HistoryIcon className="w-3.5 h-3.5" />
          History
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'activity'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Activity Log ({delivery.activity?.length || 0})
        </button>
      </div>

      {/* ===================== TAB 1: OVERVIEW ===================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Rejection Alert Banner if Rejected */}
          {delivery.status === 'Rejected' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-sm font-semibold text-rose-300">
                  Client Rejection: {delivery.rejection_reason}
                </strong>
                <p className="text-rose-200/90 leading-relaxed">{delivery.rejection_notes}</p>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => retry(user?.full_name)}
                    className="text-xs bg-rose-600 hover:bg-rose-500 text-white"
                  >
                    Initiate Repackaging & Retake Cycle
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400 block">Package Status</span>
              <div className="mt-2">{getStatusBadge(delivery.status)}</div>
            </Card>

            <Card className="p-4 bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400 block">QC Validation Score</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-emerald-400 font-mono">
                  {delivery.validation_score || 100}%
                </span>
                <span className="text-xs text-slate-400">All Passed</span>
              </div>
            </Card>

            <Card className="p-4 bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400 block">Total Payload Size</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-indigo-400 font-mono">
                  {delivery.total_size_formatted || '40.00 GB'}
                </span>
                <span className="text-xs text-slate-400">{delivery.total_shots_count || 4} Shots</span>
              </div>
            </Card>

            <Card className="p-4 bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400 block">Turnover Due Date</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-bold text-amber-400 font-mono">
                  {new Date(delivery.due_date).toLocaleDateString()}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">18:00 PST</span>
              </div>
            </Card>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5 bg-slate-900/90 border border-slate-800 space-y-4">
              <h3 className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
                Client & Ingest Destination
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Client Enterprise:</span>
                  <span className="text-white font-semibold">{delivery.client.name}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Representative Contact:</span>
                  <span className="text-slate-300">
                    {delivery.client.representative_name} ({delivery.client.contact_email})
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Protocol / Destination:</span>
                  <span className="text-cyan-400 font-mono">{delivery.destination.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Server Directory:</span>
                  <span className="text-slate-300 font-mono text-[11px] truncate max-w-xs">
                    {delivery.destination.target_directory || '/incoming/vfx/turnovers'}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-slate-900/90 border border-slate-800 space-y-4">
              <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                Payload Description & Manifest Summary
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{delivery.description}</p>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Manifest Checksum:</span>
                  <button
                    onClick={() => copyToClipboard('5566778899aabbccddeeff00112233445566778899aabbccddeeff0011223344')}
                    className="text-indigo-400 hover:text-indigo-300 text-[11px] truncate max-w-xs flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedHash ? 'Copied' : '5566778899aabbccddeeff...'}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total Rendered Frames:</span>
                  <span className="text-slate-300">{delivery.total_frames_count || 576} Frames</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: CONTENTS ===================== */}
      {activeTab === 'contents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Delivered Version Entities & Sequences</h3>
              <p className="text-xs text-slate-400">All shots, asset cuts, and CDL references bundled in this turnover.</p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddVersionOpen(true)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Published Version
            </Button>
          </div>

          <div className="space-y-3">
            {delivery.versions && delivery.versions.length > 0 ? (
              delivery.versions.map((ver) => (
                <Card
                  key={ver.id}
                  className="p-4 bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
                      <img
                        src={ver.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300'}
                        alt={ver.entity_code}
                        className="w-full h-full object-cover"
                      />
                      {ver.video_url && (
                        <button
                          onClick={() => setPreviewVideoUrl(ver.video_url || null)}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Play className="w-5 h-5 fill-current" />
                        </button>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs flex items-center gap-1">
                          <Film className="w-3.5 h-3.5 text-indigo-400" />
                          {ver.entity_code}
                        </span>
                        <span className="font-mono text-emerald-400 text-xs font-bold">{ver.version_number}</span>
                        {ver.is_hero && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            HERO
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {ver.department}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400 mt-1.5">
                        <span>Format: {ver.file_format}</span>
                        <span>Frames: {ver.frame_range || '1001-1100'}</span>
                        <span>Resolution: {ver.resolution}</span>
                        <span>Size: {ver.file_size_formatted}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {ver.video_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewVideoUrl(ver.video_url || null)}
                        className="text-xs text-indigo-300 hover:text-white"
                        leftIcon={<Play className="w-3 h-3" />}
                      >
                        Review
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeVersion(ver.id)}
                      className="text-xs text-slate-500 hover:text-rose-400 border-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                No versions linked to this package yet. Click "Add Published Version" above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB 3: VALIDATION ===================== */}
      {activeTab === 'validation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-900/90 rounded-xl border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Pre-Flight Delivery QC Rule Verification</h3>
              <p className="text-xs text-slate-400">
                Automated studio validation tests ensuring zero frame drops, ACEScg compliance, and valid slates.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => validate('QC Inspector')}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
              leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
            >
              Re-Run Full QC Suite
            </Button>
          </div>

          <div className="space-y-3">
            {delivery.validation_checks?.map((check) => (
              <Card
                key={check.id}
                className={`p-4 border flex items-start gap-3.5 ${
                  check.status === 'passed'
                    ? 'bg-emerald-950/15 border-emerald-500/20 text-emerald-300'
                    : check.status === 'warning'
                    ? 'bg-amber-950/15 border-amber-500/20 text-amber-300'
                    : 'bg-rose-950/15 border-rose-500/20 text-rose-300'
                }`}
              >
                {check.status === 'passed' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
                {check.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
                {check.status === 'failed' && <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="font-semibold text-white text-xs">{check.title}</strong>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 uppercase">
                        {check.severity}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {check.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{check.details}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ===================== TAB 4: MEDIA ===================== */}
      {activeTab === 'media' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Media Payload & File Assets Explorer</h3>
              <p className="text-xs text-slate-400">Physical files staged on the distribution endpoint.</p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total: {delivery.total_size_formatted || '40.00 GB'}
            </span>
          </div>

          <Card className="bg-slate-900/90 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">File Asset Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Payload Size</th>
                    <th className="px-4 py-3">SHA-256 Checksum</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                  {delivery.media_files?.map((mf) => (
                    <tr key={mf.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white truncate max-w-xs">{mf.filename}</td>
                      <td className="px-4 py-3 text-slate-400">{mf.file_type}</td>
                      <td className="px-4 py-3 text-slate-300">{mf.file_size_formatted}</td>
                      <td className="px-4 py-3 text-indigo-300 text-[11px] truncate max-w-xs">{mf.checksum_sha256}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {mf.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ===================== TAB 5: CLIENT ===================== */}
      {activeTab === 'client' && (
        <div className="space-y-6">
          <Card className="p-5 bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                {delivery.client.avatar ? (
                  <img
                    src={delivery.client.avatar}
                    alt={delivery.client.name}
                    className="w-12 h-12 rounded-full object-cover border border-slate-700"
                  />
                ) : (
                  <Building className="w-10 h-10 text-indigo-400 p-2 bg-slate-950 rounded-xl border border-slate-800" />
                )}
                <div>
                  <h3 className="font-bold text-white text-sm">{delivery.client.name}</h3>
                  <span className="text-xs text-slate-400 font-mono">Client ID: {delivery.client.code}</span>
                </div>
              </div>

              {delivery.client.portal_url && (
                <a
                  href={delivery.client.portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Client Portal
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-500 font-mono text-[10px] uppercase">Client Lead Representative</span>
                <p className="text-white font-medium">{delivery.client.representative_name}</p>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {delivery.client.contact_email}
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-500 font-mono text-[10px] uppercase">Vendor Collaboration</span>
                <p className="text-white font-medium">{delivery.vendor?.name || 'In-House Studio Hub'}</p>
                <span className="text-slate-400 block text-[11px]">
                  Vendor Lead: {delivery.vendor?.vendor_lead_name || 'Alex Chen'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ===================== TAB 6: STATUS & LIFECYCLE ===================== */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          <Card className="p-6 bg-slate-900/90 border border-slate-800 space-y-6">
            <h3 className="text-sm font-bold text-white">Delivery Lifecycle & State Machine</h3>

            {/* Visual Step Pipeline */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[
                { step: '1', name: 'Draft & Assembled', active: true, done: delivery.status !== 'Draft' },
                {
                  step: '2',
                  name: 'Pre-flight QC Validated',
                  active: delivery.status !== 'Draft',
                  done: delivery.status === 'Submitted' || delivery.status === 'Approved' || delivery.status === 'Completed',
                },
                {
                  step: '3',
                  name: 'Submitted to Client',
                  active: delivery.status === 'Submitted' || delivery.status === 'Approved' || delivery.status === 'Completed',
                  done: delivery.status === 'Approved' || delivery.status === 'Completed',
                },
                {
                  step: '4',
                  name: 'Approved & Completed',
                  active: delivery.status === 'Approved' || delivery.status === 'Completed',
                  done: delivery.status === 'Completed',
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                    s.done
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                      : s.active
                      ? 'bg-indigo-950/30 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      s.done
                        ? 'bg-emerald-500 text-slate-950'
                        : s.active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {s.done ? <Check className="w-4 h-4" /> : s.step}
                  </div>
                  <div className="text-xs font-semibold">{s.name}</div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <span className="font-semibold text-white block">Current Package Operational Status:</span>
              <div className="flex items-center gap-2">{getStatusBadge(delivery.status)}</div>
              {delivery.submitted_at && (
                <p className="text-slate-400 font-mono text-[11px]">
                  Submitted on: {new Date(delivery.submitted_at).toLocaleString()} by {delivery.submitted_by_name}
                </p>
              )}
              {delivery.approved_at && (
                <p className="text-emerald-400 font-mono text-[11px]">
                  Approved on: {new Date(delivery.approved_at).toLocaleString()} by {delivery.approved_by_name}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ===================== TAB 7: HISTORY ===================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white">Delivery Revision & Manifest History</h3>

          <div className="space-y-3">
            {delivery.history && delivery.history.length > 0 ? (
              delivery.history.map((hist) => (
                <Card key={hist.id} className="p-4 bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold">
                        Turnover Revision #{hist.revision}
                      </span>
                      <span className="font-semibold text-white">{hist.status}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {hist.submitted_at ? new Date(hist.submitted_at).toLocaleString() : 'Active Revision'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400">
                    Manifest Hash: <span className="text-indigo-300">{hist.manifest_checksum}</span>
                  </div>

                  {hist.notes && <p className="text-slate-300 italic">"{hist.notes}"</p>}
                </Card>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                No historical revisions archived yet for this delivery.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB 8: ACTIVITY ===================== */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white">Audit Trail & Action Logs</h3>

          <div className="space-y-2.5">
            {delivery.activity?.map((act) => (
              <div
                key={act.id}
                className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-start justify-between text-xs"
              >
                <div>
                  <h5 className="font-semibold text-white">{act.title}</h5>
                  <p className="text-slate-300 mt-0.5">{act.description}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1.5">
                    <span>Actor: {act.actor_name}</span>
                    {act.actor_role && <span>({act.actor_role})</span>}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Video Modal */}
      {previewVideoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden max-w-3xl w-full">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Playback Preview (4K Reference Cut)</span>
              <Button size="sm" variant="outline" onClick={() => setPreviewVideoUrl(null)} className="text-xs">
                Close
              </Button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              <video src={previewVideoUrl} controls autoPlay className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <DeliveryApprovalModal
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        deliveryId={delivery.id}
        onApprove={approve}
      />

      <DeliveryRejectModal
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        deliveryId={delivery.id}
        onReject={reject}
      />

      <DeliveryCancelModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        deliveryId={delivery.id}
        onCancel={cancel}
      />

      <AddVersionModal
        isOpen={isAddVersionOpen}
        onClose={() => setIsAddVersionOpen(false)}
        onAddVersion={addVersion}
      />
    </div>
  );
};
