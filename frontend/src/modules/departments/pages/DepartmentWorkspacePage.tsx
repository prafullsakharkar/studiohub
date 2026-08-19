import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  ChevronLeft,
  Edit,
  Users2,
  Users,
  Film,
  CheckSquare,
  Clock,
  BarChart3,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { useDepartment, useDepartmentMutations } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

// Sub Tabs
import { DeptOverviewTab } from '../components/DeptOverviewTab';
import { DeptTeamsTab } from '../components/DeptTeamsTab';
import { DeptPeopleTab } from '../components/DeptPeopleTab';
import { DeptProjectsTab } from '../components/DeptProjectsTab';
import { DeptTasksTab } from '../components/DeptTasksTab';
import { DeptCapacityTab } from '../components/DeptCapacityTab';
import { DeptUtilizationTab } from '../components/DeptUtilizationTab';
import { DeptActivityTab } from '../components/DeptActivityTab';

export const DepartmentWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: dept, isLoading, error } = useDepartment(id || '');
  const { updateDepartment } = useDepartmentMutations();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
        <span className="text-xs text-slate-400 mt-3 font-mono">Loading department craft workspace...</span>
      </div>
    );
  }

  if (error || !dept) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Department Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested department craft identifier could not be resolved.
        </p>
        <Link to="/departments">
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
            Back to Departments
          </Button>
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'teams', label: 'Teams', icon: Users2 },
    { id: 'people', label: 'People', icon: Users },
    { id: 'projects', label: 'Projects', icon: Film },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'capacity', label: 'Capacity', icon: Clock },
    { id: 'utilization', label: 'Utilization', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  const handleAssignProject = (projectCode: string) => {
    const current = dept.assigned_projects || ['NK99'];
    if (!current.includes(projectCode)) {
      updateDepartment.mutate({
        id: dept.id,
        data: { assigned_projects: [...current, projectCode] },
      });
    }
  };

  const handleRemoveProject = (projectCode: string) => {
    const current = dept.assigned_projects || ['NK99'];
    updateDepartment.mutate({
      id: dept.id,
      data: { assigned_projects: current.filter((c) => c !== projectCode) },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link to="/departments">
            <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
              Departments
            </Button>
          </Link>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-white text-sm shrink-0"
            style={{ backgroundColor: dept.color || '#6366f1' }}
          >
            {dept.code}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">{dept.name}</h1>
              <Badge variant="outline" className="text-[10px] font-mono text-indigo-300">
                {dept.code}
              </Badge>
            </div>
            <span className="text-xs text-slate-400 font-mono">Head: {dept.head_name} • {dept.member_count} artists</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/departments/${dept.id}/edit`}>
            <Button size="sm" variant="outline" leftIcon={<Edit className="w-3.5 h-3.5" />}>
              Edit Department
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
        {activeTab === 'overview' && <DeptOverviewTab dept={dept} />}
        {activeTab === 'teams' && <DeptTeamsTab dept={dept} />}
        {activeTab === 'people' && <DeptPeopleTab dept={dept} />}
        {activeTab === 'projects' && (
          <DeptProjectsTab
            dept={dept}
            onAssignProject={handleAssignProject}
            onRemoveProject={handleRemoveProject}
          />
        )}
        {activeTab === 'tasks' && <DeptTasksTab dept={dept} />}
        {activeTab === 'capacity' && <DeptCapacityTab dept={dept} />}
        {activeTab === 'utilization' && <DeptUtilizationTab dept={dept} />}
        {activeTab === 'activity' && <DeptActivityTab dept={dept} />}
      </div>
    </div>
  );
};
