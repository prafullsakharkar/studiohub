import React, { useState } from 'react';
import { Task } from '@/types/tasks';
import { Button } from '@/shared/components/Button';
import { usePeople, useTeams, useVendors } from '@/modules/organization/hooks/useOrganizationData';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Department } from '@/types/common';
import { Users, UserCheck, Building, ShieldCheck, Save, UserX } from 'lucide-react';

interface TaskAssignmentTabProps {
  task: Task;
  onUpdate: (data: Partial<Task>) => Promise<any>;
}

export const TaskAssignmentTab: React.FC<TaskAssignmentTabProps> = ({ task, onUpdate }) => {
  const { user } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const addActivity = useActivityStore((state) => state.addActivity);

  const { data: peopleData } = usePeople();
  const { data: teamsData } = useTeams();
  const { data: vendorsData } = useVendors();
  const people: any[] = (peopleData as any)?.results ?? peopleData ?? [];
  const teams: any[] = (teamsData as any)?.results ?? teamsData ?? [];
  const vendors: any[] = (vendorsData as any)?.results ?? vendorsData ?? [];

  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
  const [reviewerId, setReviewerId] = useState(task.reviewer_id || '');
  const [teamId, setTeamId] = useState(task.team_id || '');
  const [department, setDepartment] = useState<Department>(task.department);
  const [vendorId, setVendorId] = useState(task.vendor_id || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const assignedUser = people.find((u) => u.id === assigneeId);
      const reviewerUser = people.find((u) => u.id === reviewerId);
      const selectedTeam = teams.find((t) => t.id === teamId);
      const selectedVendor = vendors.find((v) => v.id === vendorId);

      await onUpdate({
        assignee_id: assigneeId || undefined,
        assignee_name: assignedUser?.full_name,
        assignee_avatar: assignedUser?.avatar_url,
        assignee_role: assignedUser?.role,
        reviewer_id: reviewerId || undefined,
        reviewer_name: reviewerUser?.full_name,
        reviewer_avatar: reviewerUser?.avatar_url,
        team_id: teamId || undefined,
        team_name: selectedTeam?.name,
        department,
        vendor_id: vendorId || undefined,
        vendor_name: selectedVendor?.name,
        vendor_code: selectedVendor?.code,
      });

      addActivity({
        actor: {
          id: user?.id || '',
          name: user?.full_name || 'Unknown User',
          email: user?.email || '',
          role: user?.role || 'Unknown',
        },
        action: 'update',
        actionLabel: 'Task Reassigned',
        entity: {
          type: 'task',
          id: task.id,
          code: task.code,
          name: task.title,
          context: task.project_code,
        },
        description: `Reassigned task to ${assignedUser?.full_name || 'Unassigned'} in ${selectedTeam?.name || 'team'}`,
        tags: ['Assignment', department],
      });

      addNotification({
        type: 'success',
        title: 'Assignment Updated',
        message: `Task assigned to ${assignedUser?.full_name || 'Unassigned'}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Failed to Update Assignment',
        message: err.message || 'An error occurred.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Personnel & Team Assignment</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage artist delegation, supervisor review lines, and studio vendor contracting.
            </p>
          </div>
          <Button type="submit" variant="primary" isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
            Apply Changes
          </Button>
        </div>

        {/* Lead Assignee */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Lead Artist / Assignee
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Unassigned —</option>
              {people.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role}) — {u.department_name || 'Studio'}
                </option>
              ))}
            </select>
          </div>

          {/* Supervisor / Reviewer */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Supervisor / Reviewer
            </label>
            <select
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— No Designated Reviewer —</option>
              {people.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Department & Team */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-800">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="FX & Simulation">FX & Simulation</option>
              <option value="3D Modeling & Assets">3D Modeling & Assets</option>
              <option value="Character & Creature Rigging">Character & Creature Rigging</option>
              <option value="Character & Creature Animation">Animation</option>
              <option value="Lighting & LookDev">Lighting & LookDev</option>
              <option value="Compositing (Nuke)">Compositing (Nuke)</option>
              <option value="Editorial">Editorial</option>
              <option value="Pipeline & Core Infrastructure">Pipeline & Core Infrastructure</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Assigned Team Squad
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Unassigned Team —</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              External Vendor Studio
            </label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">None (Internal Studio Work)</option>
              {vendors.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </form>
  );
};
