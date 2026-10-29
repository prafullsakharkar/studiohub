import { useTeam } from '@/modules/teams';
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users2,
  ChevronLeft,
  Edit,
  Users,
  Film,
  CheckSquare,
  Clock,
  BarChart3,
  Activity,
  AlertCircle,
} from 'lucide-react';
;
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { ScrollableTabs } from '@/shared/components/tabs/ScrollableTabs';
import { TabContentTransition } from '@/shared/components/tabs/TabContentTransition';

// Tabs
import { TeamOverviewTab } from '../components/TeamOverviewTab';
import { TeamMembersTab } from '../components/TeamMembersTab';
import { TeamProjectsTab } from '../components/TeamProjectsTab';
import { TeamAssignmentsTab } from '../components/TeamAssignmentsTab';
import { TeamCapacityTab } from '../components/TeamCapacityTab';
import { TeamUtilizationTab } from '../components/TeamUtilizationTab';
import { TeamActivityTab } from '../components/TeamActivityTab';

export const TeamWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: team, isLoading, error } = useTeam(id || '');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
        <span className="text-xs text-slate-400 mt-3 font-mono">Loading team workspace...</span>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Team Squad Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested team identifier could not be resolved in the studio database.
        </p>
        <Link to="/teams">
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
            Back to Teams
          </Button>
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Users2 },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'projects', label: 'Projects', icon: Film },
    { id: 'assignments', label: 'Assignments', icon: CheckSquare },
    { id: 'capacity', label: 'Capacity', icon: Clock },
    { id: 'utilization', label: 'Utilization', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link to="/teams">
            <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
              Teams
            </Button>
          </Link>
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-mono font-bold text-indigo-400 text-sm shrink-0">
            <Users2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">{team.name}</h1>
              <Badge variant="outline" className="text-[10px] font-mono text-indigo-300">
                {team.code}
              </Badge>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Lead: {team.lead_name} • {team.department_name} • {team.member_count} members
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/teams/${team.id}/edit`}>
            <Button size="sm" variant="outline" leftIcon={<Edit className="w-3.5 h-3.5" />}>
              Edit Team
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
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
          ariaLabel="Team workspace tabs"
        />
      </div>

      {/* Tab Content Display */}
      <TabContentTransition tabKey={activeTab}>
        {activeTab === 'overview' && <TeamOverviewTab team={team} />}
        {activeTab === 'members' && <TeamMembersTab team={team} />}
        {activeTab === 'projects' && <TeamProjectsTab team={team} />}
        {activeTab === 'assignments' && <TeamAssignmentsTab team={team} />}
        {activeTab === 'capacity' && <TeamCapacityTab team={team} />}
        {activeTab === 'utilization' && <TeamUtilizationTab team={team} />}
        {activeTab === 'activity' && <TeamActivityTab team={team} />}
      </TabContentTransition>
    </div>
  );
};
