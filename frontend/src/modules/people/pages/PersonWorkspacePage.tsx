import { usePerson, usePersonMutations } from '@/modules/people/hooks/usePeopleData';
import React, { useState } from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
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
;
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { ScrollableTabs } from '@/shared/components/tabs/ScrollableTabs';
import { TabContentTransition } from '@/shared/components/tabs/TabContentTransition';

// Tab Components
import { PersonOverviewTab } from '../components/PersonOverviewTab';
import { PersonDepartmentsTab } from '../components/PersonDepartmentsTab';
import { PersonTeamsTab } from '../components/PersonTeamsTab';
import { PersonProjectsTab } from '../components/PersonProjectsTab';
import { PersonAssignmentsTab } from '../components/PersonAssignmentsTab';
import { PersonSkillsTab } from '../components/PersonSkillsTab';
import { PersonAvailabilityTab } from '../components/PersonAvailabilityTab';
import { AccountSection } from '@/modules/identity/components/AccountSection';
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
    { id: 'departments', label: 'Departments', icon: Layers },
    { id: 'teams', label: 'Teams', icon: Users2 },
    { id: 'projects', label: 'Projects', icon: Film },
    { id: 'assignments', label: 'Assignments', icon: CheckSquare },
    { id: 'skills', label: 'Skills', icon: Sparkles },
    { id: 'availability', label: 'Availability', icon: Clock },
    { id: 'security', label: 'Account', icon: ShieldCheck },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  // Actions handlers
  // Membership lives on the person: `department` and `team` are ids (the API ignores department_id / team_id).
  const handleAssignDepartment = (departmentId: string | null) => updatePerson.mutateAsync({ id: person.id, data: { department: departmentId } });
  const handleAssignTeam = (teamId: string | null) => updatePerson.mutateAsync({ id: person.id, data: { team: teamId } });

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

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link to="/people">
            <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
              Roster
            </Button>
          </Link>
          <SmartImg
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
      <div className="border-b border-slate-800 pb-1">
        <ScrollableTabs
          tabs={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            icon: tab.icon,
          }))}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId)}
          variant="pills"
          size="sm"
          ariaLabel="Person workspace tabs"
        />
      </div>

      {/* Tab Content Display */}
      <TabContentTransition tabKey={activeTab}>
        {activeTab === 'overview' && <PersonOverviewTab person={person} />}
        {activeTab === 'departments' && (
          <PersonDepartmentsTab currentDepartmentId={person.department} onAssignDepartment={handleAssignDepartment} />
        )}
        {activeTab === 'teams' && (
          <PersonTeamsTab currentTeamId={person.team} onAssignTeam={handleAssignTeam} />
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
          <AccountSection
            personId={person.id}
            personName={person.full_name}
            personEmail={person.email || undefined}
            userId={person.user ?? person.user_id}
          />
        )}
        {activeTab === 'activity' && <PersonActivityTab person={person} />}
      </TabContentTransition>
    </div>
  );
};
