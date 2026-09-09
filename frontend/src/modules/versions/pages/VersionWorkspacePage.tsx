import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  GitBranch,
  ChevronLeft,
  Edit,
  Film,
  Image as ImageIcon,
  Paperclip,
  Database,
  Activity,
  Archive,
  RotateCcw,
  Trash2,
  ListMusic,
  Columns,
  UploadCloud,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  ExternalLink,
  Tag,
  Share2,
  Box,
} from 'lucide-react';
import { useVersion, useVersions } from '../hooks/useVersions';
import { useVersionMutations } from '../hooks/useVersionMutations';
import { useAttachments } from '@/modules/attachments/hooks/useAttachments';
import { useAttachmentMutations } from '@/modules/attachments/hooks/useAttachmentMutations';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Modal } from '@/shared/components/Modal';

// Tabs
import { VersionOverviewTab } from '../components/VersionOverviewTab';
import { VersionMediaTab } from '../components/VersionMediaTab';
import { VersionReviewsTab } from '../components/VersionReviewsTab';
import { VersionPlaylistsTab } from '../components/VersionPlaylistsTab';
import { VersionPublishingTab } from '../components/VersionPublishingTab';
import { VersionNotesTab } from '../components/VersionNotesTab';
import { VersionActivityTab } from '../components/VersionActivityTab';
import { AttachmentList } from '@/shared/components/attachments/AttachmentList';

// Modals
import { VersionEditModal } from '../components/VersionEditModal';
import { VersionCompareModal } from '../components/VersionCompareModal';
import { AttachmentUploader } from '@/shared/components/attachments/AttachmentUploader';
import { ProductionStatus } from '@/types/common';

export const VersionWorkspacePage: React.FC = () => {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Modals
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { data: version, isLoading, error } = useVersion(versionId || '');
  const { data: allVersionsData } = useVersions({ project_id: version?.project_id });
  const allVersions = allVersionsData?.results || [];

  const {
    updateVersion,
    publishVersion,
    unpublishVersion,
    archiveVersion,
    deleteVersion,
    isArchiving,
    isDeleting,
  } = useVersionMutations();

  // Attachments for this version
  const { data: attachments = [] } = useAttachments({
    entity_type: 'version',
    entity_id: versionId,
  });
  const { createAttachment, deleteAttachment } = useAttachmentMutations();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
        <span className="text-xs text-slate-400 mt-3 font-mono">Loading Version entity workspace...</span>
      </div>
    );
  }

  if (error || !version) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Version Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested version identifier could not be located in the studio database.
        </p>
        <Link to="/versions">
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
            Back to Version Catalog
          </Button>
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Box },
    { id: 'media', label: 'Media', icon: Film },
    { id: 'reviews', label: 'Reviews', icon: CheckCircle2, badge: version.reviews_count },
    { id: 'playlists', label: 'Playlists', icon: ListMusic, badge: version.playlists?.length },
    { id: 'publishing', label: 'Publishing', icon: Database },
    { id: 'notes', label: 'Notes', icon: MessageSquare, badge: version.notes_count },
    { id: 'attachments', label: 'Attachments', icon: Paperclip, badge: attachments.length },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  const handleStatusChange = async (newStatus: ProductionStatus) => {
    await updateVersion({
      id: version.id,
      data: { status: newStatus },
    });
  };

  const handleArchiveToggle = async () => {
    await archiveVersion(version.id);
  };

  const handleDelete = async () => {
    await deleteVersion(version.id);
    navigate('/versions');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumbs & Back Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <Link to="/versions" className="hover:text-slate-200 flex items-center">
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Versions
          </Link>
          <span>/</span>
          <span className="text-slate-300">{version.project_code}</span>
          <span>/</span>
          {version.shot_code && (
            <>
              <span className="text-cyan-400">{version.shot_code}</span>
              <span>/</span>
            </>
          )}
          {version.asset_code && (
            <>
              <span className="text-amber-400">{version.asset_code}</span>
              <span>/</span>
            </>
          )}
          <span className="text-white font-bold">{version.version_number}</span>
        </div>

        {/* Global Fast Actions */}
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCompareOpen(true)}
            leftIcon={<Columns className="w-3.5 h-3.5" />}
            className="font-mono text-xs"
          >
            Compare
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsUploadOpen(true)}
            leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
            className="font-mono text-xs"
          >
            Upload
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            leftIcon={<Edit className="w-3.5 h-3.5" />}
            className="font-mono text-xs"
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleArchiveToggle}
            isLoading={isArchiving}
            title={version.is_archived ? 'Restore Version' : 'Archive Version'}
            className="font-mono text-xs"
          >
            {version.is_archived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsDeleteModalOpen(true)}
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Entity Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 shadow-lg">
              <GitBranch className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5 flex-wrap">
                <h1 className="text-xl font-bold font-mono text-white">{version.version_number}</h1>
                <span className="text-sm font-mono text-slate-400">({version.code})</span>
                <StatusBadge status={version.status} />
                {version.is_published && (
                  <Badge variant="success" className="text-[10px] font-mono">
                    <Database className="w-3 h-3 mr-1" />
                    OpenUSD Published
                  </Badge>
                )}
                {version.is_archived && (
                  <Badge variant="warning" className="text-[10px] font-mono">
                    Archived
                  </Badge>
                )}
              </div>

              <p className="text-xs text-slate-400 font-mono">
                {version.task_name || version.task_title || version.task_code || 'Task'} • {version.department} • Author: <strong className="text-slate-200">{version.artist?.name || version.artist_name || 'Artist'}</strong>
              </p>
            </div>
          </div>

          {/* Quick Status Selector */}
          <div className="flex items-center space-x-2 self-start md:self-auto">
            <select
              value={version.status}
              onChange={(e) => handleStatusChange(e.target.value as ProductionStatus)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="in_progress">In Progress</option>
              <option value="ready_for_review">Ready for Review</option>
              <option value="approved">Approved</option>
              <option value="changes_requested">Changes Requested (Retake)</option>
              <option value="final_approved">Final Approved</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="flex items-center space-x-1 border-t border-slate-800/80 pt-3 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Viewport */}
      <div className="min-h-[450px]">
        {activeTab === 'overview' && (
          <VersionOverviewTab
            version={version}
            onOpenMedia={() => setActiveTab('media')}
            onOpenReview={() => setActiveTab('reviews')}
            onPublishClick={() => setActiveTab('publishing')}
            onCompareClick={() => setIsCompareOpen(true)}
          />
        )}

        {activeTab === 'media' && <VersionMediaTab version={version} />}

        {activeTab === 'reviews' && <VersionReviewsTab version={version} />}

        {activeTab === 'playlists' && <VersionPlaylistsTab version={version} />}

        {activeTab === 'publishing' && <VersionPublishingTab version={version} />}

        {activeTab === 'notes' && <VersionNotesTab version={version} />}

        {activeTab === 'attachments' && (
          <AttachmentList
            attachments={attachments}
            onUpload={createAttachment}
            onDelete={deleteAttachment}
            entityType="version"
            entityId={version.id}
            entityCode={version.version_number}
            projectId={version.project_id}
            projectCode={version.project_code}
          />
        )}

        {activeTab === 'activity' && <VersionActivityTab version={version} />}
      </div>

      {/* Edit Version Modal */}
      <VersionEditModal
        version={version}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={(data) => updateVersion({ id: version.id, data })}
      />

      {/* Compare Versions Modal */}
      <VersionCompareModal
        version={version}
        allVersions={allVersions}
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
      />

      {/* Upload Attachment Modal */}
      <AttachmentUploader
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={createAttachment}
        entityType="version"
        entityId={version.id}
        entityCode={version.version_number}
        projectId={version.project_id}
        projectCode={version.project_code}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Version Deletion"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Are you sure you want to permanently delete version <strong className="text-white">{version.version_number}</strong>?
            This will remove render references from the catalog.
          </p>
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} isLoading={isDeleting}>
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
