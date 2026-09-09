import React, { useState } from 'react';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { usePeople, useTeams } from '@/modules/organization/hooks/useOrganizationData';
import { ProductionStatus, PriorityLevel } from '@/types/common';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Trash2,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface TaskBulkOperationsBarProps {
  selectedCount: number;
  selectedTaskIds: string[];
  onClearSelection: () => void;
  onBulkAssign: (payload: {
    assignee_id?: string;
    assignee_name?: string;
    assignee_avatar?: string;
    assignee_role?: string;
    team_id?: string;
    team_name?: string;
  }) => Promise<void>;
  onBulkStatusUpdate: (status: ProductionStatus) => Promise<void>;
  onBulkArchive: (isArchived: boolean) => Promise<void>;
  onBulkDelete: () => Promise<void>;
}

export const TaskBulkOperationsBar: React.FC<TaskBulkOperationsBarProps> = ({
  selectedCount,
  selectedTaskIds,
  onClearSelection,
  onBulkAssign,
  onBulkStatusUpdate,
  onBulkArchive,
  onBulkDelete,
}) => {
  const { data: peopleData } = usePeople();
  const { data: teamsData } = useTeams();
  const people: any[] = (peopleData as any)?.results ?? peopleData ?? [];
  const teams: any[] = (teamsData as any)?.results ?? teamsData ?? [];

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ProductionStatus>('In Progress');
  const [isProcessing, setIsProcessing] = useState(false);

  if (selectedCount === 0) return null;

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const user = people.find((u) => u.id === selectedAssigneeId);
      const team = teams.find((t) => t.id === selectedTeamId);
      await onBulkAssign({
        assignee_id: user?.id,
        assignee_name: user?.full_name,
        assignee_avatar: user?.avatar_url,
        assignee_role: user?.role,
        team_id: team?.id,
        team_name: team?.name,
      });
      setIsAssignModalOpen(false);
      onClearSelection();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await onBulkStatusUpdate(selectedStatus);
      setIsStatusModalOpen(false);
      onClearSelection();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSubmit = async () => {
    setIsProcessing(true);
    try {
      await onBulkDelete();
      setIsDeleteModalOpen(false);
      onClearSelection();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-indigo-500/40 rounded-xl px-5 py-3 shadow-2xl backdrop-blur-md flex items-center gap-4 text-sm text-slate-200">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700 font-semibold text-indigo-300">
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
            {selectedCount}
          </span>
          <span>{selectedCount === 1 ? 'task selected' : 'tasks selected'}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAssignModalOpen(true)}
            leftIcon={<Users className="w-3.5 h-3.5" />}
          >
            Bulk Assign
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsStatusModalOpen(true)}
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            Change Status
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await onBulkArchive(true);
              onClearSelection();
            }}
            leftIcon={<Archive className="w-3.5 h-3.5 text-amber-400" />}
          >
            Archive
          </Button>

          <Button
            size="sm"
            variant="danger"
            onClick={() => setIsDeleteModalOpen(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete
          </Button>
        </div>

        <button
          onClick={onClearSelection}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-2"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Bulk Assign Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Bulk Assign ${selectedCount} Tasks`}
        size="md"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Select Assignee (Artist)
            </label>
            <select
              value={selectedAssigneeId}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Unassigned</option>
              {people.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role}) - {u.department_name || 'Studio'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Assign Production Team
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">No Team</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isProcessing}>
              Apply Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`Change Status for ${selectedCount} Tasks`}
        size="md"
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              New Production Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ProductionStatus)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Retake">Retake</option>
              <option value="On Hold">On Hold</option>
              <option value="Omitted">Omitted</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isProcessing}>
              Update Statuses
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={`Delete ${selectedCount} Tasks?`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to delete the <span className="font-semibold text-white">{selectedCount}</span> selected production tasks?
            This will remove all associated schedule records and timelog link references.
          </p>
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-md text-xs text-rose-200 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>This action requires studio permission and cannot be undone.</span>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" isLoading={isProcessing} onClick={handleDeleteSubmit}>
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
