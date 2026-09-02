import React, { useMemo, useState } from 'react';
import { useSequences, useArchivedSequences } from '../hooks/useSequences';
import { useSequenceMutations } from '../hooks/useSequenceMutations';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Can } from '@/core/permissions/Can';
import { Sequence, SequenceInput, ExistenceResult } from '@/types/sequences';
import { ProductionStatus } from '@/types/common';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import {
  Layers,
  Plus,
  Archive,
  RotateCcw,
  Download,
  ListFilter,
  ClipboardCheck,
} from 'lucide-react';

const statuses: (ProductionStatus | 'ALL')[] = [
  'ALL',
  'Not Started',
  'In Progress',
  'Pending Review',
  'Approved',
  'On Hold',
  'Archived',
];

export const SequencesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [viewArchived, setViewArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [bulkCodes, setBulkCodes] = useState('');
  const [bulkName, setBulkName] = useState('');
  const [existenceResults, setExistenceResults] = useState<ExistenceResult[] | null>(null);

  const addNotification = useNotificationStore((state) => state.addNotification);

  const { data: projectsData } = useProjects();
  const activeQuery = useSequences({
    page,
    page_size: 10,
    search: search || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    project_id: projectFilter !== 'ALL' ? projectFilter : undefined,
  });
  const archivedQuery = useArchivedSequences();

  const {
    bulkCreate,
    bulkArchive,
    bulkRestore,
    existenceCheck,
    isBulkCreating,
    isBulkArchiving,
    isBulkRestoring,
  } = useSequenceMutations();

  const data = viewArchived ? archivedQuery.data : activeQuery.data;
  const isLoading = viewArchived ? archivedQuery.isLoading : activeQuery.isLoading;
  const sequences = data?.results || [];
  const totalCount = data?.count || 0;
  const projects = projectsData?.results || [];

  const selectedProjectId =
    projectFilter !== 'ALL' ? projectFilter : projects[0]?.id || '';

  const parsedCodes = useMemo(
    () =>
      bulkCodes
        .split(/[\n,;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    [bulkCodes]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === sequences.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sequences.map((s) => s.id));
    }
  };

  const handleExistenceCheck = async () => {
    if (!selectedProjectId) {
      addNotification({
        type: 'error',
        title: 'No Project',
        message: 'Select a project before checking sequence codes.',
      });
      return;
    }
    const items = parsedCodes.map((code) => ({ project_id: selectedProjectId, code }));
    const response = await existenceCheck(items);
    setExistenceResults(response.results);
  };

  const handleBulkCreate = async () => {
    if (!selectedProjectId) {
      addNotification({
        type: 'error',
        title: 'No Project',
        message: 'Select a project before creating sequences.',
      });
      return;
    }
    const items: SequenceInput[] = parsedCodes.map((code, index) => {
      const existing = existenceResults?.find((r) => r.index === index);
      return {
        project_id: selectedProjectId,
        code,
        name: bulkName ? `${code} ${bulkName}` : bulkName,
        status: 'Not Started',
      };
    });
    const response = await bulkCreate(items);
    addNotification({
      type: response.failed === 0 ? 'success' : 'warning',
      title: 'Bulk Create Finished',
      message: `${response.successful} created, ${response.failed} failed (duplicates / soft-deleted / invalid).`,
    });
    setIsBulkCreateOpen(false);
    setBulkCodes('');
    setBulkName('');
    setExistenceResults(null);
    setPage(1);
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    await bulkArchive(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    await bulkRestore(selectedIds);
    setSelectedIds([]);
  };

  const exportCSV = () => {
    const csvContent = [
      ['Code', 'Name', 'Project', 'Status', 'Frames', 'Department', 'Shots'].join(','),
      ...sequences.map((s) =>
        [
          s.code,
          `"${s.name}"`,
          s.project_code,
          s.status,
          `${s.frame_in}-${s.frame_out}`,
          `"${s.department || ''}"`,
          s.shots_count,
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StudioHub_Sequences_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">Sequence Registry</h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  {totalCount} Sequences
                </span>
                <button
                  onClick={() => {
                    setViewArchived((v) => !v);
                    setSelectedIds([]);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border transition-colors ${
                    viewArchived
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {viewArchived ? 'Viewing Archived' : 'Archived'}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Organization-scoped sequence breakdown with bulk create, archive &amp; restore
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {selectedIds.length > 0 && (
              <div className="flex items-center space-x-2 bg-indigo-950/60 border border-indigo-500/40 px-2.5 py-1 rounded-lg animate-in fade-in">
                <span className="text-xs font-mono font-bold text-indigo-300">
                  {selectedIds.length} selected
                </span>
                {viewArchived ? (
                  <Button variant="secondary" size="sm" onClick={handleBulkRestore} isLoading={isBulkRestoring}>
                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                  </Button>
                ) : (
                  <Can permission="sequences:delete">
                    <Button variant="danger" size="sm" onClick={handleBulkArchive} isLoading={isBulkArchiving}>
                      <Archive className="w-3.5 h-3.5" /> Archive
                    </Button>
                  </Can>
                )}
              </div>
            )}

            <Button variant="outline" size="sm" onClick={exportCSV} leftIcon={<Download className="w-3.5 h-3.5" />}>
              Export CSV
            </Button>

            {!viewArchived && (
              <Can permission="sequences:create">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsBulkCreateOpen(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Bulk Create
                </Button>
              </Can>
            )}
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 mx-4 sm:mx-6 mt-4">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <SearchInput
            className="w-full sm:w-72"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onClear={() => {
              setSearch('');
              setPage(1);
            }}
            placeholder="Filter code, name, department..."
          />
          <select
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto">
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <LoadingSpinner size="lg" label="Querying sequence database..." />
        ) : sequences.length === 0 ? (
          <EmptyState
            icon={<Layers className="w-8 h-8 text-indigo-400" />}
            title={viewArchived ? 'No Archived Sequences' : 'No Sequences Found'}
            description={
              viewArchived
                ? 'No soft-deleted sequences in the archive.'
                : 'Create sequences for a project to group shots into reels.'
            }
            actionLabel={viewArchived ? undefined : 'Bulk Create'}
            onAction={() => !viewArchived && setIsBulkCreateOpen(true)}
          />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 select-none">
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === sequences.length && sequences.length > 0}
                        onChange={selectAll}
                        className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                      />
                    </th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Frame Range</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 text-center">Shots</th>
                    {viewArchived && <th className="py-2.5 px-3">Archived At</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {sequences.map((seq) => {
                    const isSelected = selectedIds.includes(seq.id);
                    return (
                      <tr
                        key={seq.id}
                        className={`hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-indigo-950/20' : ''} ${
                          viewArchived ? 'opacity-80' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(seq.id)}
                            className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">{seq.code}</td>
                        <td className="py-2.5 px-3 text-slate-300">{seq.name || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{seq.project_code}</td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={seq.status} />
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-300">
                          {seq.frame_in} - {seq.frame_out}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{seq.department || '—'}</td>
                        <td className="py-2.5 px-3 text-center text-slate-300">{seq.shots_count}</td>
                        {viewArchived && (
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {seq.deleted_at ? new Date(seq.deleted_at).toLocaleDateString() : '—'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-slate-800 bg-slate-950/60">
              <Pagination
                currentPage={page}
                totalCount={totalCount}
                pageSize={10}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bulk Create Modal */}
      <Modal
        isOpen={isBulkCreateOpen}
        onClose={() => setIsBulkCreateOpen(false)}
        title="Bulk Create Sequences"
        description="Paste one sequence code per line. Codes are normalized to uppercase and checked for existence before creation."
        size="2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setProjectFilter(e.target.value === projects[0]?.id ? 'ALL' : e.target.value);
                  setExistenceResults(null);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Default Name Suffix (optional)</label>
              <input
                type="text"
                placeholder="e.g. Reel"
                value={bulkName}
                onChange={(e) => setBulkName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Sequence Codes</label>
            <textarea
              value={bulkCodes}
              onChange={(e) => {
                setBulkCodes(e.target.value);
                setExistenceResults(null);
              }}
              rows={8}
              placeholder={'NK_010\nNK_020\nNK_030'}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:ring-2 focus:ring-indigo-500 resize-y"
            />
            <p className="text-[11px] text-slate-500">
              {parsedCodes.length} code{parsedCodes.length === 1 ? '' : 's'} parsed
            </p>
          </div>

          {existenceResults && (
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-950/50 space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <ClipboardCheck className="w-4 h-4 text-indigo-400" /> Existence Check
              </div>
              {existenceResults.map((r, i) => {
                const code = parsedCodes[r.index] || `#${r.index}`;
                const tone =
                  r.status === 'new'
                    ? 'text-emerald-400'
                    : r.status === 'soft_deleted'
                    ? 'text-amber-400'
                    : 'text-rose-400';
                return (
                  <div key={i} className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300">{code}</span>
                    <span className={tone}>{r.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExistenceCheck}
            leftIcon={<ListFilter className="w-3.5 h-3.5" />}
          >
            Check Existence
          </Button>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={() => setIsBulkCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleBulkCreate} isLoading={isBulkCreating}>
              Create {parsedCodes.length} Sequences
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
