import { useRoles } from '@/modules/access/hooks/useAccessData';
import { usePeople } from '@/modules/people';
import { useProjects } from '@/modules/production';
import type React from 'react';
import { useState, useMemo, useEffect } from 'react';
import {
  Film,
  Users,
  Search,
  Plus,
  Shield,
  Trash2,
  Edit,
  CheckCircle2,
  Building2,
  Layers,
  Sparkles,
  FolderKanban,
} from 'lucide-react';
import { useAccessManagementStore } from '@/core/access/useAccessManagementStore';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { Modal } from '@/shared/components/Modal';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { filterAccessibleProjects } from '@/core/permissions/accessControl';
import { useProductionStore } from '@/core/production/useProductionStore';
import type { Role } from '@/types/identity';

export const ProjectAccessSection: React.FC = () => {
  const { user: currentUser } = useCurrentUser();

  const { data: projectsData, isLoading: isProjectsLoading } = useProjects();
  const { data: peopleData, isLoading: isPeopleLoading } = usePeople();
  const { data: rolesData } = useRoles();

  const projectsList = useMemo(
    // Access surface: never offer projects the viewer cannot access.
    // Project assignment (membership / vendor / client delegation) is the
    // only production access dimension; this filter enforces the project rule.
    () => filterAccessibleProjects(currentUser, projectsData?.results || []),
    [projectsData, currentUser],
  );
  const peopleList = useMemo(() => peopleData?.items || [], [peopleData]);
  const rolesList: Role[] = useMemo(() => (Array.isArray(rolesData) ? (rolesData as unknown as Role[]) : []), [rolesData]);

  const {
    selectedProjectId,
    setSelectedProjectId,
    getAllRoles,
    assignUserProjectRole,
    removeUserFromProject,
    getUserEffectiveAccess,
  } = useAccessManagementStore();

  const [search, setSearch] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
  const [roleToAssign, setRoleToAssign] = useState('Artist');
  const [scopeToAssign, setScopeToAssign] = useState('PROJECT');
  const [departmentTag, setDepartmentTag] = useState('VFX');

  const { activeProjectId, setActiveProject } = useProductionStore();

  // Sync selected project id with toolbar active project or real project list
  useEffect(() => {
    if (activeProjectId && projectsList.some((p) => p.id === activeProjectId)) {
      if (selectedProjectId !== activeProjectId) {
        setSelectedProjectId(activeProjectId);
      }
    } else if (projectsList.length > 0) {
      if (!selectedProjectId || !projectsList.some((p) => p.id === selectedProjectId)) {
        setSelectedProjectId(projectsList[0].id);
      }
    } else {
      setSelectedProjectId('');
    }
  }, [projectsList, selectedProjectId, setSelectedProjectId, activeProjectId]);

  const allRoles: Role[] = useMemo(() => {
    if (rolesList.length > 0) {
      return rolesList.filter((r: Role) => !(r as any).is_archived);
    }
    return getAllRoles().filter((r: Role) => !r.is_archived);
  }, [rolesList, getAllRoles]);

  const actor = {
    id: currentUser?.id || 'usr-001',
    name: currentUser?.full_name || 'Administrator',
    email: currentUser?.email || 'admin@studiohub.vfx',
  };

  const currentProject = useMemo(() => {
    return projectsList.find((p) => p.id === selectedProjectId) || projectsList[0] || null;
  }, [projectsList, selectedProjectId]);

  // Compute users enrolled in this project
  const projectMembers = useMemo(() => {
    if (!currentProject) return [];
    return peopleList
      .map((person) => {
        const adaptedUser = {
          id: person.id,
          email: person.email,
          full_name: person.full_name,
          role: person.role,
          department: person.department_name,
          avatar_url: person.avatar_url,
          created_at: person.created_at,
          project_memberships: [],
          memberships: [],
        };
        const access = getUserEffectiveAccess(person.id, adaptedUser, projectsList);
        const membership = access?.projectMemberships.find(
          (p) => p.projectId === currentProject.id || (p as any).project_id === currentProject.id
        );
        if (!membership) return null;
        return {
          user: person,
          membership,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter(({ user }) => {
        if (
          search &&
          !user.full_name?.toLowerCase().includes(search.toLowerCase()) &&
          !user.email?.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      });
  }, [currentProject, peopleList, projectsList, getUserEffectiveAccess, search]);

  const availableUsersToAdd = useMemo(() => {
    const existingIds = projectMembers.map((m) => m.user.id);
    return peopleList.filter((u) => !existingIds.includes(u.id));
  }, [peopleList, projectMembers]);

  useEffect(() => {
    if (availableUsersToAdd.length > 0 && !selectedUserToAdd) {
      setSelectedUserToAdd(availableUsersToAdd[0].id);
    }
  }, [availableUsersToAdd, selectedUserToAdd]);

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToAdd || !currentProject) return;

    assignUserProjectRole(
      selectedUserToAdd,
      currentProject.id,
      roleToAssign,
      scopeToAssign,
      {
        department: departmentTag,
        projectName: currentProject.name,
        projectCode: currentProject.code,
      },
      actor
    );

    setIsAddUserModalOpen(false);
  };

  const handleRemoveUser = (userId: string) => {
    if (!currentProject) return;
    if (confirm(`Remove user from ${currentProject.name}?`)) {
      removeUserFromProject(userId, currentProject.id, actor);
    }
  };

  const handleChangeRole = (userId: string, newRole: string, currentScope: string) => {
    if (!currentProject) return;
    assignUserProjectRole(
      userId,
      currentProject.id,
      newRole,
      currentScope,
      {
        projectName: currentProject.name,
        projectCode: currentProject.code,
      },
      actor
    );
  };

  const handleChangeScope = (userId: string, currentRole: string, newScope: string) => {
    if (!currentProject) return;
    assignUserProjectRole(
      userId,
      currentProject.id,
      currentRole,
      newScope,
      {
        projectName: currentProject.name,
        projectCode: currentProject.code,
      },
      actor
    );
  };

  return (
    <div className="space-y-4">
      {/* Project Selector Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Film className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs font-mono font-medium text-slate-300">Target Production:</span>
          </div>

          {/* Target production selector */}
          <div className="flex items-center gap-2">
            {projectsList.length === 0 ? (
              <span className="text-xs text-slate-500 font-mono italic">No active projects available</span>
            ) : (
              <select
                aria-label="Select Target Production"
                value={selectedProjectId || currentProject?.id || ''}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setActiveProject(e.target.value);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 font-mono cursor-pointer"
              >
                {projectsList.map((proj) => (
                  <option key={proj.id} value={proj.id} className="bg-slate-900 text-white font-mono">
                    [{proj.code}] {proj.name}
                  </option>
                ))}
              </select>
            )}
            <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
              (Synced with toolbar)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project crew..."
            className="w-52 text-xs"
          />

          <Button
            size="xs"
            variant="primary"
            disabled={!currentProject || availableUsersToAdd.length === 0}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsAddUserModalOpen(true)}
          >
            Add Crew Member
          </Button>
        </div>
      </div>

      {/* Project Access Matrix Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Base Role</th>
                <th className="py-3 px-4">Project Assigned Role</th>
                <th className="py-3 px-4">Access Scope Boundary</th>
                <th className="py-3 px-4">Department / Unit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {projectMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-mono text-xs">
                    {!currentProject
                      ? 'No project selected or available.'
                      : 'No crew members assigned to this project yet.'}
                  </td>
                </tr>
              ) : (
                projectMembers.map(({ user, membership }) => {
                  const currentRole = membership.roles[0] || 'Artist';

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={user.full_name}
                            className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-700"
                          />
                          <div>
                            <div className="font-bold text-white">{user.full_name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        <Badge variant="neutral" className="text-[10px]">
                          {user.role}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={currentRole}
                          onChange={(e) =>
                            handleChangeRole(user.id, e.target.value, membership.scope)
                          }
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-semibold focus:outline-hidden focus:border-indigo-500"
                        >
                          {allRoles.map((r) => (
                            <option key={r.id} value={r.name}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={membership.scope}
                          onChange={(e) =>
                            handleChangeScope(user.id, currentRole, e.target.value)
                          }
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-teal-300 font-mono focus:outline-hidden focus:border-teal-500"
                        >
                          <option value="PROJECT">PROJECT (Full Show)</option>
                          <option value="TEAM">TEAM (Squad Only)</option>
                          <option value="ASSIGNED">ASSIGNED (Tasks Only)</option>
                          <option value="VENDOR">VENDOR (Isolated)</option>
                          <option value="CLIENT">CLIENT (Screening)</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {user.department_name || 'VFX Production'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          title="Remove from Project"
                          onClick={() => handleRemoveUser(user.id)}
                          className="p-1.5 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User to Project Modal */}
      {isAddUserModalOpen && currentProject && (
        <Modal
          isOpen={isAddUserModalOpen}
          onClose={() => setIsAddUserModalOpen(false)}
          title={`Assign Crew Member to ${currentProject.name}`}
        >
          <form onSubmit={handleAddUserSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Select User</label>
              <select
                value={selectedUserToAdd}
                onChange={(e) => setSelectedUserToAdd(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                {availableUsersToAdd.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email}) - {u.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Project Role</label>
              <select
                value={roleToAssign}
                onChange={(e) => setRoleToAssign(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                {allRoles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Scope Boundary</label>
              <select
                value={scopeToAssign}
                onChange={(e) => setScopeToAssign(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="PROJECT">PROJECT (Full Project Wide Access)</option>
                <option value="TEAM">TEAM (Department / Team Squad Scope)</option>
                <option value="ASSIGNED">ASSIGNED (Only Assigned Entities)</option>
                <option value="VENDOR">VENDOR (Vendor Sandbox)</option>
                <option value="CLIENT">CLIENT (Client Screening View)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button size="xs" variant="outline" onClick={() => setIsAddUserModalOpen(false)}>
                Cancel
              </Button>
              <Button size="xs" variant="primary" type="submit">
                Assign Crew to Project
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

