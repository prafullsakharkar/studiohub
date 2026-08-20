import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    Layers,
    ChevronLeft,
    Edit,
    Users,
    Building2,
    Users2,
    Film,
    Boxes,
    Clock,
    CalendarDays,
    Activity,
    AlertCircle,
} from 'lucide-react';
import { useOffice, useOfficeMutations } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

// Sub Tabs
import { OfficeOverviewTab } from '../components/OfficeOverviewTab';
import { OfficePeopleTab } from '../components/OfficePeopleTab';
import { OfficeDepartmentsTab } from '../components/OfficeDepartmentsTab';
import { OfficeTeamsTab } from '../components/OfficeTeamsTab';
import { OfficeProjectsTab } from '../components/OfficeProjectsTab';
import { OfficeResourcesTab } from '../components/OfficeResourcesTab';
import { OfficeWorkingHoursTab } from '../components/OfficeWorkingHoursTab';
import { OfficeHolidaysTab } from '../components/OfficeHolidaysTab';
import { OfficeActivityTab } from '../components/OfficeActivityTab';

export const OfficeWorkspacePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    const { data: office, isLoading, error } = useOffice(id || '');
    const { updateOffice } = useOfficeMutations();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <LoadingSpinner size="lg" />
                <span className="text-xs text-slate-400 mt-3 font-mono">Loading facility workspace...</span>
            </div>
        );
    }

    if (error || !office) {
        return (
            <div className="p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">Office Not Found</h2>
                <p className="text-xs text-slate-400">
                    The requested facility identifier could not be resolved.
                </p>
                <Link to="/offices">
                    <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
                        Back to Offices
                    </Button>
                </Link>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Layers },
        { id: 'people', label: 'People', icon: Users },
        { id: 'departments', label: 'Departments', icon: Building2 },
        { id: 'teams', label: 'Teams', icon: Users2 },
        { id: 'projects', label: 'Projects', icon: Film },
        { id: 'resources', label: 'Resources', icon: Boxes },
        { id: 'working-hours', label: 'Working Hours', icon: Clock },
        { id: 'holidays', label: 'Holidays', icon: CalendarDays },
        { id: 'activity', label: 'Activity', icon: Activity },
    ];

    const handleAssignProject = (projectCode: string) => {
        const current = office.assigned_projects || [];
        if (!current.includes(projectCode)) {
            updateOffice.mutate({
                id: office.id,
                data: { assigned_projects: [...current, projectCode] },
            });
        }
    };

    const handleRemoveProject = (projectCode: string) => {
        const current = office.assigned_projects || [];
        updateOffice.mutate({
            id: office.id,
            data: { assigned_projects: current.filter((c) => c !== projectCode) },
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <Link to="/offices">
                        <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
                            Offices
                        </Button>
                    </Link>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-white text-sm shrink-0 bg-indigo-600">
                        {office.code}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-white">{office.name}</h1>
                            <Badge variant="outline" className="text-[10px] font-mono text-indigo-300">
                                {office.code}
                            </Badge>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{office.city}, {office.country} • {office.status}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link to={`/offices/${office.id}/edit`}>
                        <Button size="sm" variant="outline" leftIcon={<Edit className="w-3.5 h-3.5" />}>
                            Edit Office
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
                {activeTab === 'overview' && <OfficeOverviewTab office={office} />}
                {activeTab === 'people' && <OfficePeopleTab office={office} />}
                {activeTab === 'departments' && <OfficeDepartmentsTab office={office} />}
                {activeTab === 'teams' && <OfficeTeamsTab office={office} />}
                {activeTab === 'projects' && (
                    <OfficeProjectsTab
                        office={office}
                        onAssignProject={handleAssignProject}
                        onRemoveProject={handleRemoveProject}
                    />
                )}
                {activeTab === 'resources' && <OfficeResourcesTab office={office} />}
                {activeTab === 'working-hours' && <OfficeWorkingHoursTab office={office} />}
                {activeTab === 'holidays' && <OfficeHolidaysTab office={office} />}
                {activeTab === 'activity' && <OfficeActivityTab office={office} />}
            </div>
        </div>
    );
};
