import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { EntityType, EntityId } from '@/types/crud';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { usePermissions } from '@/core/permissions/usePermissions';
import { mockProjects } from '@/mocks/db/production/projects';
import { mockTeams, mockPeople, mockClients, mockVendors, mockOrganizations } from '@/mocks/db/organization/organization';
import {
  Briefcase,
  Users,
  Archive,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react';

export type ActionModalType =
  | 'assign_project'
  | 'assign_team'
  | 'archive_entity'
  | 'restore_entity'
  | 'change_status'
  | 'create_entity'
  | null;

interface ActionModalProps {
  type: ActionModalType;
  entityType?: EntityType;
  entityId?: EntityId;
  isOpen: boolean;
  onClose: () => void;
}

export const ActionDispatcherModal: React.FC<ActionModalProps> = ({
  type,
  entityType = 'shot',
  entityId = 'shot-001',
  isOpen,
  onClose,
}) => {
  const { addActivity } = useActivityStore();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const { currentRole } = usePermissions();

  // State for forms
  const [selectedProject, setSelectedProject] = useState(mockProjects[0]?.id || 'proj-001');
  const [selectedTeam, setSelectedTeam] = useState(mockTeams[0]?.id || 'tm-001');
  const [selectedPerson, setSelectedPerson] = useState(mockPeople[0]?.id || 'usr-001');
  const [selectedStatus, setSelectedStatus] = useState('Approved');
  const [targetEntityName, setTargetEntityName] = useState('');
  const [targetEntityCode, setTargetEntityCode] = useState('');
  const [createCategory, setCreateCategory] = useState<EntityType>('shot');

  if (!isOpen || !type) return null;

  // Handle Assign Project
  const handleAssignProject = () => {
    const proj = mockProjects.find((p) => p.id === selectedProject) || mockProjects[0];
    const person = mockPeople.find((u) => u.id === selectedPerson) || mockPeople[0];

    addActivity({
      actor: {
        id: 'usr-001',
        name: 'Alex Chen',
        email: 'supervisor@studiohub.vfx',
        role: currentRole.name,
      },
      action: 'assign',
      actionLabel: 'Project assigned',
      entity: {
        type: 'project',
        id: proj.id,
        code: proj.code,
        name: proj.name,
        context: `Assignee: ${person.full_name} • Status: Active`,
        deepLink: '/projects',
      },
      description: `Assigned project ${proj.name} [${proj.code}] to lead artist ${person.full_name}.`,
      diffs: [{ field: 'lead_assignee', label: 'Show Lead', before: 'Unassigned', after: person.full_name }],
    });

    addNotification({
      title: 'Project Assigned',
      message: `Successfully linked ${proj.name} to ${person.full_name}`,
      type: 'success',
    });
    onClose();
  };

  // Handle Assign Team
  const handleAssignTeam = () => {
    const team = mockTeams.find((t) => t.id === selectedTeam) || mockTeams[0];
    const proj = mockProjects.find((p) => p.id === selectedProject) || mockProjects[0];

    addActivity({
      actor: {
        id: 'usr-002',
        name: 'Marcus Vance',
        email: 'admin@studiohub.vfx',
        role: currentRole.name,
      },
      action: 'assign',
      actionLabel: 'Team assigned',
      entity: {
        type: 'team',
        id: team.id,
        code: team.code,
        name: team.name,
        context: `Deployed to Project: ${proj.name} [${proj.code}]`,
        deepLink: '/teams',
      },
      description: `Deployed specialized production squad ${team.name} to show ${proj.name}.`,
      diffs: [{ field: 'assigned_project', label: 'Target Show', before: 'Bench / Idle', after: proj.name }],
    });

    addNotification({
      title: 'Team Assigned',
      message: `Deployed ${team.name} to show ${proj.name}`,
      type: 'success',
    });
    onClose();
  };

  // Handle Archive Entity
  const handleArchive = () => {
    addActivity({
      actor: {
        id: 'usr-001',
        name: 'Alex Chen',
        email: 'supervisor@studiohub.vfx',
        role: currentRole.name,
      },
      action: 'archive',
      actionLabel: `${entityType.toUpperCase()} archived`,
      entity: {
        type: entityType,
        id: entityId,
        name: `${entityType} #${entityId}`,
        context: 'State: Archived / Cold Storage',
      },
      description: `Safely archived ${entityType} record ${entityId} to enterprise cold storage.`,
      diffs: [{ field: 'is_active', label: 'Active State', before: 'true', after: 'false (Archived)' }],
    });

    addNotification({
      title: 'Entity Archived',
      message: `Moved ${entityType} #${entityId} to cold storage archive`,
      type: 'warning',
    });
    onClose();
  };

  // Handle Restore Entity
  const handleRestore = () => {
    addActivity({
      actor: {
        id: 'usr-001',
        name: 'Alex Chen',
        email: 'supervisor@studiohub.vfx',
        role: currentRole.name,
      },
      action: 'restore',
      actionLabel: `${entityType.toUpperCase()} restored`,
      entity: {
        type: entityType,
        id: entityId,
        name: `${entityType} #${entityId}`,
        context: 'State: Active / Restored',
      },
      description: `Restored ${entityType} ${entityId} back to active production roster.`,
      diffs: [{ field: 'is_active', label: 'Active State', before: 'false (Archived)', after: 'true (Active)' }],
    });

    addNotification({
      title: 'Entity Restored',
      message: `Restored ${entityType} #${entityId} to active production`,
      type: 'success',
    });
    onClose();
  };

  // Handle Change Status
  const handleChangeStatus = () => {
    addActivity({
      actor: {
        id: 'usr-001',
        name: 'Alex Chen',
        email: 'supervisor@studiohub.vfx',
        role: currentRole.name,
      },
      action: 'status_change',
      actionLabel: 'Status changed',
      entity: {
        type: entityType,
        id: entityId,
        name: `${entityType} #${entityId}`,
        context: `New Status: ${selectedStatus}`,
      },
      description: `Changed lifecycle status of ${entityType} to ${selectedStatus}.`,
      diffs: [{ field: 'status', label: 'Production Status', before: 'In Progress', after: selectedStatus }],
    });

    addNotification({
      title: 'Status Updated',
      message: `Updated status to ${selectedStatus}`,
      type: 'success',
    });
    onClose();
  };

  // Handle Create Entity
  const handleCreateEntity = () => {
    const name = targetEntityName.trim() || `New ${createCategory}`;
    const code = targetEntityCode.trim() || `${createCategory.slice(0, 3).toUpperCase()}-99`;

    addActivity({
      actor: {
        id: 'usr-001',
        name: 'Alex Chen',
        email: 'supervisor@studiohub.vfx',
        role: currentRole.name,
      },
      action: 'create',
      actionLabel: `${createCategory.charAt(0).toUpperCase() + createCategory.slice(1)} created`,
      entity: {
        type: createCategory,
        id: `${createCategory}-new-${Date.now().toString(36)}`,
        code,
        name,
        context: 'Status: Active / Initialized',
        deepLink: `/${createCategory}s`,
      },
      description: `Created new ${createCategory} entity: ${name} [${code}] with default studio templates.`,
      diffs: [{ field: 'state', label: 'Entity Creation', before: 'None', after: 'Active' }],
    });

    addNotification({
      title: 'Entity Created',
      message: `Created ${name} [${code}] in ${createCategory}s`,
      type: 'success',
    });
    onClose();
  };

  return (
    <>
      {/* Assign Project Dialog */}
      {type === 'assign_project' && (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Command: Assign Project"
          subtitle="Link show project to lead supervisor, client, or external vendor"
          size="md"
        >
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                {mockProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Lead Artist / Supervisor</label>
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                {mockPeople.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} — {u.role} ({u.department_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleAssignProject}>
                Confirm Assignment
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Team Dialog */}
      {type === 'assign_team' && (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Command: Assign Team"
          subtitle="Deploy production squad to contracted show or sequence"
          size="md"
        >
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Squad / Team</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                {mockTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.code}] {t.name} ({t.member_count || 0} crew)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                {mockProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleAssignTeam}>
                Deploy Team
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Archive Entity Dialog */}
      {type === 'archive_entity' && (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Command: Archive Entity"
          subtitle="Move active record to immutable cold storage archive"
          size="sm"
        >
          <div className="space-y-4 py-2">
            <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl flex items-start gap-3 text-rose-300 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure you want to archive this entity?</p>
                <p className="text-slate-400 mt-1 text-[11px]">
                  Archiving removes the record from active daily schedules. An audit log entry will be permanently written.
                </p>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" onClick={handleArchive}>
                Archive Now
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Restore Entity Dialog */}
      {type === 'restore_entity' && (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Command: Restore Entity"
          subtitle="Reactivate archived record back into production workflow"
          size="sm"
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-300">
              This will restore the entity and resume task tracking and notifications.
            </p>
            <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleRestore}>
                Restore Entity
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Change Status Dialog */}
      {type === 'change_status' && (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Command: Change Status"
          subtitle="Advance entity lifecycle status and publish audit event"
          size="sm"
        >
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">New Production Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Approved">Approved</option>
                <option value="On Hold">On Hold</option>
                <option value="Blocked">Blocked</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleChangeStatus}>
                Update Status
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Entity Modal */}
      {type === 'create_entity' && (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title={`Command: Create ${createCategory.toUpperCase()}`}
          subtitle="Instantiate a new enterprise production record"
          size="md"
        >
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Entity Type</label>
              <select
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value as EntityType)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 capitalize"
              >
                <option value="organization">Organization</option>
                <option value="client">Client Studio</option>
                <option value="vendor">Vendor Partner</option>
                <option value="person">Person / Crew</option>
                <option value="department">Department</option>
                <option value="team">Team Squad</option>
                <option value="office">Office Site</option>
                <option value="project">Project Show</option>
                <option value="shot">Shot</option>
                <option value="asset">OpenUSD Asset</option>
                <option value="task">Production Task</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Entity Name / Title</label>
              <input
                type="text"
                placeholder={`e.g. Neon City Layout / Warner Bros / FX Dept`}
                value={targetEntityName}
                onChange={(e) => setTargetEntityName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Entity Code / Identifier</label>
              <input
                type="text"
                placeholder={`e.g. SH010 / AST_ENV_01 / CLI_WB`}
                value={targetEntityCode}
                onChange={(e) => setTargetEntityCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleCreateEntity}>
                Create Record
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
