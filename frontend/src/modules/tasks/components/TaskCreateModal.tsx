import React, { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { useShots } from '@/modules/shots/hooks/useShots';
import { useAssets } from '@/modules/assets/hooks/useAssets';
import { mockDepartments, mockTeams } from '@/mocks/db/organization/organization';
import { mockUsers } from '@/mocks/db/identity/users';
import { mockVendors } from '@/mocks/db/organization/organization';
import { Department, PriorityLevel, ProductionStatus } from '@/types/common';
import { Task, TaskEntityType } from '@/types/tasks';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import {
  CheckSquare,
  Sparkles,
  Calendar,
  Clock,
  Layers,
  Users,
  Building,
  Tag,
  Share2,
} from 'lucide-react';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Task>) => Promise<any>;
  defaultProjectId?: string;
  defaultEntityType?: TaskEntityType;
  defaultEntityId?: string;
  defaultEntityCode?: string;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultProjectId = 'proj-001',
  defaultEntityType = 'Shot',
  defaultEntityId,
  defaultEntityCode,
}) => {
  const { user } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const addActivity = useActivityStore((state) => state.addActivity);

  const { data: projectsData } = useProjects();
  const { data: shotsData } = useShots();
  const { data: assetsData } = useAssets();

  const [projectId, setProjectId] = useState<string>(defaultProjectId);
  const [entityType, setEntityType] = useState<TaskEntityType>(defaultEntityType);
  const [entityId, setEntityId] = useState<string>(defaultEntityId || '');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState<Department>('FX & Simulation');
  const [teamId, setTeamId] = useState<string>('team-01');
  const [assigneeId, setAssigneeId] = useState<string>('usr-003');
  const [reviewerId, setReviewerId] = useState<string>('usr-001');
  const [vendorId, setVendorId] = useState<string>('');
  const [priority, setPriority] = useState<PriorityLevel>('High');
  const [status, setStatus] = useState<ProductionStatus>('Not Started');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('2026-09-10');
  const [estimatedHours, setEstimatedHours] = useState(36);
  const [software, setSoftware] = useState('Houdini 20.5 (Solaris Karma)');
  const [milestone, setMilestone] = useState('First Temp Dailies');
  const [workflowStage, setWorkflowStage] = useState('Primary Production');
  const [workflowStep, setWorkflowStep] = useState('Working Pass 1');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('VFX, HighPriority');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProject = projectsData?.results?.find((p) => p.id === projectId) || projectsData?.results?.[0];
  const projectShots = shotsData?.results?.filter((s) => s.project_id === projectId) || shotsData?.results || [];
  const projectAssets = assetsData?.results?.filter((a) => a.project_id === projectId) || assetsData?.results || [];

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Task title is required.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let entityCode = defaultEntityCode || '';
      let entityName = '';
      if (entityType === 'Shot') {
        const shot = projectShots.find((s) => s.id === entityId) || projectShots[0];
        entityCode = shot?.code || 'NK_010_010';
        entityName = shot?.name || 'Shot';
      } else if (entityType === 'Asset') {
        const asset = projectAssets.find((a) => a.id === entityId) || projectAssets[0];
        entityCode = asset?.code || 'AST_001';
        entityName = asset?.name || 'Asset';
      } else {
        entityCode = `${selectedProject?.code || 'NK99'}_GLOBAL`;
        entityName = 'Global Production Pipeline';
      }

      const assignedUser = mockUsers.find((u) => u.id === assigneeId);
      const reviewerUser = mockUsers.find((u) => u.id === reviewerId);
      const selectedTeam = mockTeams.find((t) => t.id === teamId);
      const selectedVendor = mockVendors.find((v) => v.id === vendorId);
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

      const payload: Partial<Task> = {
        title,
        project_id: selectedProject?.id || 'proj-001',
        project_code: selectedProject?.code || 'NK99',
        project_name: selectedProject?.name || 'Cyberpunk 2099: Neo-Kyoto',
        entity_type: entityType,
        entity_id: entityId || (entityType === 'Shot' ? projectShots[0]?.id : projectAssets[0]?.id) || 'shot-001',
        entity_code: entityCode,
        entity_name: entityName,
        department,
        team_id: teamId || undefined,
        team_name: selectedTeam?.name,
        assignee_id: assigneeId || undefined,
        assignee_name: assignedUser?.full_name,
        assignee_avatar: assignedUser?.avatar_url,
        assignee_role: assignedUser?.role,
        reviewer_id: reviewerId || undefined,
        reviewer_name: reviewerUser?.full_name,
        reviewer_avatar: reviewerUser?.avatar_url,
        vendor_id: vendorId || undefined,
        vendor_name: selectedVendor?.name,
        vendor_code: selectedVendor?.code,
        priority,
        status,
        schedule: {
          start_date: startDate,
          due_date: dueDate,
          estimated_hours: Number(estimatedHours) || 24,
          logged_hours: 0,
          progress_percent: 0,
          milestone,
          overrun_risk: false,
        },
        workflow: {
          stage_name: workflowStage,
          step_name: workflowStep,
          step_number: 1,
          total_steps: 4,
          pipeline_template: `${department} Standard Pipeline`,
        },
        dependencies: {
          upstream_task_ids: [],
          downstream_task_ids: [],
        },
        description,
        software,
        tags,
        is_archived: false,
        due_date: dueDate,
        estimated_hours: Number(estimatedHours) || 24,
        logged_hours: 0,
      };

      const created = await onSubmit(payload);

      addActivity({
        actor: {
          id: user?.id || 'usr-001',
          name: user?.full_name || 'Alex Chen',
          email: user?.email || 'supervisor@studiohub.vfx',
          role: user?.role || 'VFX Supervisor',
        },
        action: 'create',
        actionLabel: 'Task Created',
        entity: {
          type: 'task',
          id: created?.id || 'new-task',
          code: created?.code || 'TSK-NEW',
          name: title,
          context: `${selectedProject?.code} / ${entityCode}`,
        },
        description: `Registered task ${title} (${department}) for ${assignedUser?.full_name || 'Unassigned'}`,
        tags: ['Task', department, priority],
      });

      addNotification({
        type: 'success',
        title: 'Task Created Successfully',
        message: `Task "${title}" registered under ${entityCode}.`,
      });

      onClose();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Failed to Create Task',
        message: err.message || 'An error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Production Task"
      size="xl"
    >
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Project & Context Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-lg border border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Production Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {projectsData?.results?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Target Entity Type
            </label>
            <select
              value={entityType}
              onChange={(e) => {
                const newType = e.target.value as TaskEntityType;
                setEntityType(newType);
                if (newType === 'Shot' && projectShots[0]) {
                  setEntityId(projectShots[0].id);
                } else if (newType === 'Asset' && projectAssets[0]) {
                  setEntityId(projectAssets[0].id);
                }
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Shot">Shot (VFX / Sequence Cut)</option>
              <option value="Asset">Asset (Model / Rig / LookDev)</option>
              <option value="General">General Pipeline / Infrastructure</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Target Entity Record
            </label>
            {entityType === 'Shot' ? (
              <select
                value={entityId || projectShots[0]?.id || ''}
                onChange={(e) => setEntityId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {projectShots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            ) : entityType === 'Asset' ? (
              <select
                value={entityId || projectAssets[0]?.id || ''}
                onChange={(e) => setEntityId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {projectAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} ({a.category}) - {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs bg-slate-800/80 border border-slate-700/80 rounded-md px-3 py-2 text-slate-300">
                Global Production Tooling
              </div>
            )}
          </div>
        </div>

        {/* Task Title & Description */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Task Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Volumetric Rain & Neon Light Reflection Simulation"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Brief & Technical Execution Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe objectives, solver parameters, camera focal lengths, and delivery standards..."
              className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Department, Team & Software */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="FX & Simulation">FX & Simulation (Houdini)</option>
              <option value="3D Modeling & Assets">3D Modeling & Assets</option>
              <option value="Character & Creature Rigging">Character & Creature Rigging</option>
              <option value="Character & Creature Animation">Animation (Maya)</option>
              <option value="Lighting & LookDev">Lighting & LookDev (Katana/Solaris)</option>
              <option value="Compositing (Nuke)">Compositing (Nuke)</option>
              <option value="Editorial">Editorial</option>
              <option value="Pipeline & Core Infrastructure">Pipeline & Core Infrastructure</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Assigned Team
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {mockTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Primary DCC Software
            </label>
            <input
              type="text"
              value={software}
              onChange={(e) => setSoftware(e.target.value)}
              placeholder="e.g. Houdini 20.5 / Solaris"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Assignee, Reviewer & Vendor */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Lead Assignee (Artist)
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {mockUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Reviewer / Supervisor
            </label>
            <select
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {mockUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              External Vendor Partner (Optional)
            </label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">None (In-House Studio)</option>
              {mockVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority, Status, Milestone */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
              <option value="Critical">Critical (Blocker)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductionStatus)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Turnover">Turnover</option>
              <option value="Bidding">Bidding</option>
              <option value="Pending Review">Pending Review</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Milestone Checkpoint
            </label>
            <input
              type="text"
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
              placeholder="e.g. Director Temp Review"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Schedule & Hours */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/40 p-4 rounded-lg border border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Target Due Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Estimated Hours (Budget)
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Workflow & Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Workflow Stage
            </label>
            <input
              type="text"
              value={workflowStage}
              onChange={(e) => setWorkflowStage(e.target.value)}
              placeholder="e.g. FX Simulation & Pyro"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Current Step
            </label>
            <input
              type="text"
              value={workflowStep}
              onChange={(e) => setWorkflowStep(e.target.value)}
              placeholder="e.g. High-Res Cache"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Pyro, Rain, Hero"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} leftIcon={<CheckSquare className="w-4 h-4" />}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
};
