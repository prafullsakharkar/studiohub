import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Users,
  ChevronLeft,
  Edit,
  Mail,
  Building,
  Layers,
  Users2,
  Film,
  CheckSquare,
  Sparkles,
  Clock,
  ShieldCheck,
  Activity,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { usePerson, usePersonMutations } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

// Tab Components
import { PersonOverviewTab } from '../components/PersonOverviewTab';
import { PersonOrganizationsTab } from '../components/PersonOrganizationsTab';
import { PersonDepartmentsTab } from '../components/PersonDepartmentsTab';
import { PersonTeamsTab } from '../components/PersonTeamsTab';
import { PersonProjectsTab } from '../components/PersonProjectsTab';
import { PersonAssignmentsTab } from '../components/PersonAssignmentsTab';
import { PersonSkillsTab } from '../components/PersonSkillsTab';
import { PersonAvailabilityTab } from '../components/PersonAvailabilityTab';
import { PersonSecurityTab } from '../components/PersonSecurityTab';
import { PersonActivityTab } from '../components/PersonActivityTab';

export const PersonWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: person, isLoading, error } = usePerson(id || '');
  const { updatePerson } = usePersonMutations();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
        <span className="text-xs text-slate-400 mt-3 font-mono">Loading artist record...</span>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Artist Profile Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested artist identifier could not be resolved in the studio database.
        </p>
        <Link to="/people">
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
            Back to Roster
          </Button>
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Users },
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    { id: 'departments', label: 'Departments', icon: Layers },
    { id: 'teams', label: 'Teams', icon: Users2 },
    { id: 'projects', label: 'Projects', icon: Film },
    { id: 'assignments', label: 'Assignments', icon: CheckSquare },
    { id: 'skills', label: 'Skills', icon: Sparkles },
    { id: 'availability', label: 'Availability', icon: Clock },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  // Actions handlers
  const handleAssignDepartment = (deptId: string, deptName: string) => {
    updatePerson.mutate({
      id: person.id,
      data: { department_id: deptId, department_name: deptName },
    });
  };

  const handleAssignTeam = (teamId: string, teamName: string) => {
    updatePerson.mutate({
      id: person.id,
      data: { team_id: teamId, team_name: teamName },
    });
  };

  const handleAssignProject = (projectCode: string) => {
    const current = person.assigned_projects || ['NK99'];
    if (!current.includes(projectCode)) {
      updatePerson.mutate({
        id: person.id,
        data: { assigned_projects: [...current, projectCode] },
      });
    }
  };

  const handleRemoveProject = (projectCode: string) => {
    const current = person.assigned_projects || ['NK99'];
    updatePerson.mutate({
      id: person.id,
      data: { assigned_projects: current.filter((c) => c !== projectCode) },
    });
  };

  const handleUpdateSkills = (skills: string[]) => {
    updatePerson.mutate({
      id: person.id,
      data: { skills },
    });
  };

  const handleUpdateAvailability = (status: any) => {
    updatePerson.mutate({
      id: person.id,
      data: { availability_status: status },
    });
  };

  const handleUpdateSecurityStatus = (status: 'Active' | 'Inactive' | 'Suspended') => {
    updatePerson.mutate({
      id: person.id,
      data: { status },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link to="/people">
            <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
              Roster
            </Button>
          </Link>
          <img
            src={person.avatar_url}
            alt=""
            className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/40 shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">{person.full_name}</h1>
              <Badge variant="outline" className="text-[10px] font-mono text-indigo-300">
                {person.role}
              </Badge>
            </div>
            <span className="text-xs text-slate-400 font-mono">{person.department_name} • {person.office_name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/people/${person.id}/edit`}>
            <Button size="sm" variant="outline" leftIcon={<Edit className="w-3.5 h-3.5" />}>
              Edit Profile
            </Button>
          </Link>
        </div>
      </div>

      {/* 10 Workspace Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                isActive
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      <div className="animate-in fade-in duration-150">
        {activeTab === 'overview' && <PersonOverviewTab person={person} />}
        {activeTab === 'organizations' && <PersonOrganizationsTab person={person} />}
        {activeTab === 'departments' && (
          <PersonDepartmentsTab person={person} onAssignDepartment={handleAssignDepartment} />
        )}
        {activeTab === 'teams' && (
          <PersonTeamsTab person={person} onAssignTeam={handleAssignTeam} />
        )}
        {activeTab === 'projects' && (
          <PersonProjectsTab
            person={person}
            onAssignProject={handleAssignProject}
            onRemoveProject={handleRemoveProject}
          />
        )}
        {activeTab === 'assignments' && <PersonAssignmentsTab person={person} />}
        {activeTab === 'skills' && (
          <PersonSkillsTab person={person} onUpdateSkills={handleUpdateSkills} />
        )}
        {activeTab === 'availability' && (
          <PersonAvailabilityTab person={person} onUpdateStatus={handleUpdateAvailability} />
        )}
        {activeTab === 'security' && (
          <PersonSecurityTab person={person} onUpdateStatus={handleUpdateSecurityStatus} />
        )}
        {activeTab === 'activity' && <PersonActivityTab person={person} />}
      </div>
    </div>
  );
};
