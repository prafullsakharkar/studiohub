import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    Layers,
    ChevronLeft,
    Edit,
    Users,
    Film,
    ClipboardList,
    Clock,
    BarChart3,
    Activity,
    AlertCircle,
} from 'lucide-react';
import { useTeam, useTeamMutations } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

// Sub Tabs
import { TeamOverviewTab } from '../components/TeamOverviewTab';
import { TeamMembersTab } from '../components/TeamMembersTab';
import { TeamProjectsTab } from '../components/TeamProjectsTab';
import { TeamAssignmentsTab } from '../components/TeamAssignmentsTab';
import { TeamCapacityTab } from '../components/TeamCapacityTab';
import { TeamUtilizationTab } from '../components/TeamUtilizationTab';
import { TeamActivityTab } from '../components/TeamActivityTab';

export const TeamWorkspacePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    const { data: team, isLoading, error } = useTeam(id || '');
    const { updateTeam } = useTeamMutations();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <LoadingSpinner size="lg" />
                <span className="text-xs text-slate-400 mt-3 font-mono">Loading team squad workspace...</span>
            </div>
        );
    }

    if (error || !team) {
        return (
            <div className="p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">Team Not Found</h2>
                <p className="text-xs text-slate-400">
                    The requested team squad identifier could not be resolved.
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
        { id: 'overview', label: 'Overview', icon: Layers },
        { id: 'members', label: 'Members', icon: Users },
        { id: 'projects', label: 'Projects', icon: Film },
        { id: 'assignments', label: 'Assignments', icon: ClipboardList },
        { id: 'capacity', label: 'Capacity', icon: Clock },
        { id: 'utilization', label: 'Utilization', icon: BarChart3 },
        { id: 'activity', label: 'Activity', icon: Activity },
    ];

    const handleAssignProject = (projectCode: string) => {
        const current = team.assigned_projects || [team.current_project_code];
        if (!current.includes(projectCode)) {
            updateTeam.mutate({
                id: team.id,
                data: { assigned_projects: [...current, projectCode] },
            });
        }
    };

    const handleRemoveProject = (projectCode: string) => {
        const current = team.assigned_projects || [team.current_project_code];
        updateTeam.mutate({
            id: team.id,
            data: { assigned_projects: current.filter((c) => c !== projectCode) },
        });
    };

    const handleRemoveMember = (personId: string) => {
        const current = team.member_ids || [];
        updateTeam.mutate({
            id: team.id,
            data: {
                member_ids: current.filter((m) => m !== personId),
                member_count: Math.max(0, (team.member_count || 1) - 1),
            },
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <Link to="/teams">
                        <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
                            Teams
                        </Button>
                    </Link>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-white text-sm shrink-0 bg-indigo-600">
                        {team.code}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-white">{team.name}</h1>
                            <Badge variant="outline" className="text-[10px] font-mono text-indigo-300">
                                {team.code}
                            </Badge>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">Lead: {team.lead_name} • {team.member_count} members</span>
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
            <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto no-scrollbar">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${isActive
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
                {activeTab === 'overview' && <TeamOverviewTab team={team} />}
                {activeTab === 'members' && <TeamMembersTab team={team} onRemoveMember={handleRemoveMember} />}
                {activeTab === 'projects' && (
                    <TeamProjectsTab
                        team={team}
                        onAssignProject={handleAssignProject}
                        onRemoveProject={handleRemoveProject}
                    />
                )}
                {activeTab === 'assignments' && <TeamAssignmentsTab team={team} />}
                {activeTab === 'capacity' && <TeamCapacityTab team={team} />}
                {activeTab === 'utilization' && <TeamUtilizationTab team={team} />}
                {activeTab === 'activity' && <TeamActivityTab team={team} />}
            </div>
        </div>
    );
};
