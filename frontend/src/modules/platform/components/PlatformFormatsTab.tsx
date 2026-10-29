import React, { useState } from 'react';
import {
  FileCode,
  PlaySquare,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { MasterReviewType, MasterFileType } from '@/types/masterData';
import { usePermissionEvaluator } from '@/core/permissions/usePermissionEvaluator';
import {
  usePlatformMasterReviewTypes,
  useCreatePlatformReviewType,
  useUpdatePlatformReviewType,
  useArchivePlatformReviewType,
  useRestorePlatformReviewType,
  useDeletePlatformReviewType,
  usePlatformMasterFileTypes,
  useCreatePlatformFileType,
  useUpdatePlatformFileType,
  useArchivePlatformFileType,
  useRestorePlatformFileType,
  useDeletePlatformFileType,
} from '@/core/masterData/useMasterData';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { MasterDataTabShell, MasterDataItem } from '../admin/masterData/MasterDataTabShell';
import { masterDataEntities } from '../admin/masterData/masterDataEntities';

export const PlatformFormatsTab: React.FC = () => {
  const { data: reviewTypesList, isLoading: isReviewLoading } = usePlatformMasterReviewTypes();
  const { data: fileTypesList, isLoading: isFileLoading } = usePlatformMasterFileTypes();
  const [subTab, setSubTab] = useState<'reviews' | 'files'>('reviews');
  const { can } = usePermissionEvaluator();
  const { addNotification } = useNotificationStore();

  // Review Modals & state
  const [isCreateReviewOpen, setIsCreateReviewOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<MasterReviewType | null>(null);
  const [deleteReviewTarget, setDeleteReviewTarget] = useState<MasterReviewType | null>(null);
  const [reviewForm, setReviewForm] = useState({
    name: '',
    code: '',
    description: '',
    allow_verdicts: true,
    require_notes: false,
  });

  // File Modals & state
  const [isCreateFileOpen, setIsCreateFileOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<MasterFileType | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<MasterFileType | null>(null);
  const [fileForm, setFileForm] = useState({
    name: '',
    extension: '',
    category: '3d_scene' as '3d_scene' | 'image_sequence' | 'geometry' | 'composite' | 'editorial' | 'audio' | 'general',
    mime_type: '',
    description: '',
  });

  // RBAC checks (create is gated by the shell via masterDataEntities)
  const canReviewUpdate = can('platform.review_type.update') || can('platform.master_data.update');
  const canReviewArchive = can('platform.review_type.archive') || can('platform.master_data.archive');
  const canReviewRestore = can('platform.review_type.restore') || can('platform.master_data.restore');
  const canReviewDelete = can('platform.review_type.delete') || can('platform.master_data.delete');

  const canFileUpdate = can('platform.file_type.update') || can('platform.master_data.update');
  const canFileArchive = can('platform.file_type.archive') || can('platform.master_data.archive');
  const canFileRestore = can('platform.file_type.restore') || can('platform.master_data.restore');
  const canFileDelete = can('platform.file_type.delete') || can('platform.master_data.delete');

  // Mutations
  const createReviewMutation = useCreatePlatformReviewType();
  const updateReviewMutation = useUpdatePlatformReviewType();
  const archiveReviewMutation = useArchivePlatformReviewType();
  const restoreReviewMutation = useRestorePlatformReviewType();
  const deleteReviewMutation = useDeletePlatformReviewType();

  const createFileMutation = useCreatePlatformFileType();
  const updateFileMutation = useUpdatePlatformFileType();
  const archiveFileMutation = useArchivePlatformFileType();
  const restoreFileMutation = useRestorePlatformFileType();
  const deleteFileMutation = useDeletePlatformFileType();

  // RBAC: create is gated by the shell via masterDataEntities
  const reviewItems: MasterDataItem[] = (reviewTypesList || []).map((r) => ({
    ...r,
    is_archived: r.status !== 'active',
  }));

  const fileItems: MasterDataItem[] = (fileTypesList || []).map((f) => ({
    ...f,
    code: f.code || f.extension || f.name,
    is_archived: f.status !== 'active',
  }));

  const openCreateReview = () => {
    setReviewForm({ name: '', code: '', description: '', allow_verdicts: true, require_notes: false });
    setIsCreateReviewOpen(true);
  };

  const openCreateFile = () => {
    setFileForm({ name: '', extension: '', category: '3d_scene', mime_type: '', description: '' });
    setIsCreateFileOpen(true);
  };

  // Review Handlers
  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createReviewMutation.mutateAsync(reviewForm);
      setIsCreateReviewOpen(false);
      setReviewForm({ name: '', code: '', description: '', allow_verdicts: true, require_notes: false });
      addNotification({ type: 'success', title: 'Review Type Created', message: `Registered ${reviewForm.name}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const handleUpdateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;
    try {
      await updateReviewMutation.mutateAsync({ id: editingReview.id, data: reviewForm });
      setEditingReview(null);
      addNotification({ type: 'success', title: 'Review Type Updated', message: `Updated ${reviewForm.name}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  // File Handlers
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFileMutation.mutateAsync(fileForm);
      setIsCreateFileOpen(false);
      setFileForm({ name: '', extension: '', category: '3d_scene', mime_type: '', description: '' });
      addNotification({ type: 'success', title: 'File Format Registered', message: `Registered .${fileForm.extension}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const handleUpdateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;
    try {
      await updateFileMutation.mutateAsync({ id: editingFile.id, data: fileForm });
      setEditingFile(null);
      addNotification({ type: 'success', title: 'File Format Updated', message: `Updated .${fileForm.extension}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const subTabsNode = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setSubTab('reviews')}
        className={`h-9 flex items-center gap-2 px-3.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
          subTab === 'reviews'
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
        }`}
      >
        <PlaySquare className="w-4 h-4 text-indigo-400" />
        Review Formats ({reviewTypesList?.length || 0})
      </button>
      <button
        type="button"
        onClick={() => setSubTab('files')}
        className={`h-9 flex items-center gap-2 px-3.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
          subTab === 'files'
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
        }`}
      >
        <FileCode className="w-4 h-4 text-cyan-400" />
        File Types ({fileTypesList?.length || 0})
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* REVIEW TYPES TABLE */}
      {subTab === 'reviews' && (
        <MasterDataTabShell
          subTabs={subTabsNode}
          entity={masterDataEntities.reviewTypes}
          items={reviewItems}
          isLoading={isReviewLoading}
          onCreate={openCreateReview}
          createLabel="Add Review Type"
          renderTable={(rows) =>
            rows.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">No review types registered.</div>
            ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardBody className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Review Type</th>
                    <th className="py-3.5 px-4">Code Identifier</th>
                    <th className="py-3.5 px-4">Governance Rules</th>
                    <th className="py-3.5 px-4">State</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {(rows as MasterReviewType[]).map((review) => (
                    <tr key={review.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <PlaySquare className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-white">{review.name}</span>
                            {review.description && <p className="text-xs text-slate-400 truncate max-w-xs">{review.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-indigo-300">{review.code}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {review.allow_verdicts && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              VERDICTS
                            </span>
                          )}
                          {review.require_notes && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              MANDATORY NOTES
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={review.status === 'active' ? 'success' : 'secondary'} className="text-xs uppercase font-mono">
                          {review.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReview(review);
                              setReviewForm({
                                name: review.name,
                                code: review.code,
                                description: review.description || '',
                                allow_verdicts: review.allow_verdicts ?? true,
                                require_notes: review.require_notes ?? false,
                              });
                            }}
                            disabled={!canReviewUpdate}
                            title={canReviewUpdate ? 'Edit' : 'Requires permission'}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {review.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => archiveReviewMutation.mutate(review.id)}
                              disabled={!canReviewArchive}
                              title={canReviewArchive ? 'Archive' : 'Requires permission'}
                              className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 disabled:opacity-30"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => restoreReviewMutation.mutate(review.id)}
                              disabled={!canReviewRestore}
                              title={canReviewRestore ? 'Restore' : 'Requires permission'}
                              className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 disabled:opacity-30"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteReviewTarget(review)}
                            disabled={!canReviewDelete}
                            title={canReviewDelete ? 'Delete' : 'Requires permission'}
                            className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </CardBody>
        </Card>
            )
          }
        />
      )}

      {/* FILE TYPES TABLE */}
      {subTab === 'files' && (
        <MasterDataTabShell
          subTabs={subTabsNode}
          entity={masterDataEntities.fileTypes}
          items={fileItems}
          isLoading={isFileLoading}
          onCreate={openCreateFile}
          createLabel="Register File Format"
          searchFields={['name', 'code', 'extension', 'category', 'mime_type', 'description']}
          renderTable={(rows) =>
            rows.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">No file formats registered.</div>
            ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardBody className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">File Format</th>
                    <th className="py-3.5 px-4">Extension</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">MIME Type</th>
                    <th className="py-3.5 px-4">State</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {(rows as MasterFileType[]).map((file) => (
                    <tr key={file.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                            <FileCode className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-white">{file.name}</span>
                            {file.description && <p className="text-xs text-slate-400 truncate max-w-xs">{file.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-cyan-300">.{file.extension}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs font-mono capitalize bg-slate-950 text-slate-300 border-slate-800">
                          {file.category.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-400">{file.mime_type || 'application/octet-stream'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={file.status === 'active' ? 'success' : 'secondary'} className="text-xs uppercase font-mono">
                          {file.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFile(file);
                              setFileForm({
                                name: file.name,
                                extension: file.extension,
                                category: file.category as any,
                                mime_type: file.mime_type || '',
                                description: file.description || '',
                              });
                            }}
                            disabled={!canFileUpdate}
                            title={canFileUpdate ? 'Edit' : 'Requires permission'}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {file.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => archiveFileMutation.mutate(file.id)}
                              disabled={!canFileArchive}
                              title={canFileArchive ? 'Archive' : 'Requires permission'}
                              className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 disabled:opacity-30"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => restoreFileMutation.mutate(file.id)}
                              disabled={!canFileRestore}
                              title={canFileRestore ? 'Restore' : 'Requires permission'}
                              className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 disabled:opacity-30"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteFileTarget(file)}
                            disabled={!canFileDelete}
                            title={canFileDelete ? 'Delete' : 'Requires permission'}
                            className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </CardBody>
        </Card>
            )
          }
        />
      )}

      {/* CREATE REVIEW MODAL */}
      {isCreateReviewOpen && (
        <Modal isOpen={isCreateReviewOpen} onClose={() => setIsCreateReviewOpen(false)} title="Register Review Type">
          <form onSubmit={handleCreateReview} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Review Type Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Client Review, Dailies, Director Approval"
                value={reviewForm.name}
                onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Code Slug (Optional)</label>
              <input
                type="text"
                placeholder="client_review"
                value={reviewForm.code}
                onChange={(e) => setReviewForm({ ...reviewForm, code: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex items-center gap-6 py-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewForm.allow_verdicts}
                  onChange={(e) => setReviewForm({ ...reviewForm, allow_verdicts: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                />
                Allow Approval Verdicts
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewForm.require_notes}
                  onChange={(e) => setReviewForm({ ...reviewForm, require_notes: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                />
                Require Written Notes
              </label>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={reviewForm.description}
                onChange={(e) => setReviewForm({ ...reviewForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateReviewOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={createReviewMutation.isPending}>Create Review Type</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE FILE TYPE MODAL */}
      {isCreateFileOpen && (
        <Modal isOpen={isCreateFileOpen} onClose={() => setIsCreateFileOpen(false)} title="Register Platform File Format">
          <form onSubmit={handleCreateFile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Binary"
                  value={fileForm.name}
                  onChange={(e) => setFileForm({ ...fileForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">File Extension (no dot)</label>
                <input
                  type="text"
                  required
                  placeholder="mb"
                  value={fileForm.extension}
                  onChange={(e) => setFileForm({ ...fileForm, extension: e.target.value.replace('.', '') })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Category</label>
                <select
                  value={fileForm.category}
                  onChange={(e) => setFileForm({ ...fileForm, category: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="3d_scene">3D Scene / DCC Project</option>
                  <option value="geometry">Geometry Cache (USD/Alembic)</option>
                  <option value="image_sequence">Image Sequence / Plate</option>
                  <option value="composite">Composite / Node Graph</option>
                  <option value="editorial">Editorial / Timeline</option>
                  <option value="audio">Audio Track</option>
                  <option value="general">General / Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">MIME Type</label>
                <input
                  type="text"
                  placeholder="application/octet-stream"
                  value={fileForm.mime_type}
                  onChange={(e) => setFileForm({ ...fileForm, mime_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={fileForm.description}
                onChange={(e) => setFileForm({ ...fileForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateFileOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={createFileMutation.isPending}>Register Format</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRMATIONS */}
      {deleteReviewTarget && (
        <Modal isOpen={Boolean(deleteReviewTarget)} onClose={() => setDeleteReviewTarget(null)} title="Delete Review Type">
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-semibold text-white">Delete &quot;{deleteReviewTarget.name}&quot;?</p>
                <p className="text-xs text-slate-400 mt-1">This removes the review taxonomy from global master definitions.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteReviewTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={async () => {
                await deleteReviewMutation.mutateAsync(deleteReviewTarget.id);
                setDeleteReviewTarget(null);
                addNotification({ type: 'success', title: 'Review Type Deleted', message: `Deleted ${deleteReviewTarget.name}` });
              }}>Confirm Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteFileTarget && (
        <Modal isOpen={Boolean(deleteFileTarget)} onClose={() => setDeleteFileTarget(null)} title="Delete File Format">
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-semibold text-white">Delete &quot;.{deleteFileTarget.extension}&quot;?</p>
                <p className="text-xs text-slate-400 mt-1">This removes the file format from global master definitions.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteFileTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={async () => {
                await deleteFileMutation.mutateAsync(deleteFileTarget.id);
                setDeleteFileTarget(null);
                addNotification({ type: 'success', title: 'File Format Deleted', message: `Deleted .${deleteFileTarget.extension}` });
              }}>Confirm Delete</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
