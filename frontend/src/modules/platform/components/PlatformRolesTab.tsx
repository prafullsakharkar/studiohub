import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Users, Building2, Briefcase, Search, Plus } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import {
  usePlatformRoles,
  usePlatformGroups,
  usePlatformDepartments,
  usePlatformPositions,
} from '@/core/masterData/useMasterData';
import { RolesSection, RolesSectionHandle } from '../admin/masterData/OrgStructure/RolesSection';
import { GroupsSection } from '../admin/masterData/OrgStructure/GroupsSection';
import { DepartmentsSection, DepartmentsSectionHandle } from '../admin/masterData/OrgStructure/DepartmentsSection';
import { PositionsSection, PositionsSectionHandle } from '../admin/masterData/OrgStructure/PositionsSection';

interface PlatformRolesTabProps {
  initialSubTab?: 'roles' | 'groups' | 'departments' | 'positions';
}

export const PlatformRolesTab: React.FC<PlatformRolesTabProps> = ({ initialSubTab = 'roles' }) => {
  const [subTab, setSubTab] = useState<'roles' | 'groups' | 'departments' | 'positions'>(initialSubTab);
  const [searchQuery, setSearchQuery] = useState('');

  const rolesRef = useRef<RolesSectionHandle>(null);
  const departmentsRef = useRef<DepartmentsSectionHandle>(null);
  const positionsRef = useRef<PositionsSectionHandle>(null);

  const { data: roles = [] } = usePlatformRoles();
  const { data: groups = [] } = usePlatformGroups();
  const { data: departments = [] } = usePlatformDepartments();
  const { data: positions = [] } = usePlatformPositions();

  const getCreateLabel = () => {
    switch (subTab) {
      case 'roles':
        return 'Create Role';
      case 'departments':
        return 'New Department';
      case 'positions':
        return 'New Position';
    }
  };

  const handleCreate = () => {
    if (subTab === 'roles') {
      rolesRef.current?.openCreate();
    } else if (subTab === 'departments') {
      departmentsRef.current?.openCreate();
    } else if (subTab === 'positions') {
      positionsRef.current?.openCreate();
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Navigation Bar - Consistent with MasterDataTabShell */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
        {/* Left side: Sub tabs & Add button in same row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSubTab('roles')}
              className={`h-9 flex items-center gap-2 px-3.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                subTab === 'roles'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Shield className="w-4 h-4 text-amber-400" />
              Platform Roles ({roles.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('groups')}
              className={`h-9 flex items-center gap-2 px-3.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                subTab === 'groups'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Users className="w-4 h-4 text-purple-400" />
              Access Groups ({groups.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('departments')}
              className={`h-9 flex items-center gap-2 px-3.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                subTab === 'departments'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Building2 className="w-4 h-4 text-cyan-400" />
              Departments ({departments.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('positions')}
              className={`h-9 flex items-center gap-2 px-3.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                subTab === 'positions'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Briefcase className="w-4 h-4 text-emerald-400" />
              Positions ({positions.length})
            </button>
          </div>

          {subTab === 'groups' ? (
            <Link
              to="/access/groups"
              className="h-9 whitespace-nowrap bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 font-bold border border-purple-500/40 flex items-center gap-1.5 px-3.5 rounded-lg text-sm transition"
            >
              <Users className="w-4 h-4" />
              Manage in Access
            </Link>
          ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            className="h-9 whitespace-nowrap bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-0 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {getCreateLabel()}
          </Button>
          )}
        </div>

        {/* Right side: Search in right end */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-64 md:ml-auto">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={`Search ${subTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full pl-9 pr-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {subTab === 'roles' && (
        <RolesSection
          ref={rolesRef}
          searchQuery={searchQuery}
          hideHeaderCreateButton={true}
        />
      )}
      {subTab === 'groups' && (
        <GroupsSection
          searchQuery={searchQuery}
        />
      )}
      {subTab === 'departments' && (
        <DepartmentsSection
          ref={departmentsRef}
          searchQuery={searchQuery}
          hideHeaderCreateButton={true}
        />
      )}
      {subTab === 'positions' && (
        <PositionsSection
          ref={positionsRef}
          searchQuery={searchQuery}
          hideHeaderCreateButton={true}
        />
      )}
    </div>
  );
};
