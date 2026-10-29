import { usePeople } from '@/modules/people';
import { useProjects } from '@/modules/production';
import type React from 'react';
import { useState, useMemo, useEffect } from 'react';
import {
  Terminal,
  Play,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useAccessManagementStore } from '@/core/access/useAccessManagementStore';
import { DOMAIN_PERMISSIONS_CATALOG, PERMISSION_DOMAINS } from '@/core/access/domainPermissions';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import type { SimulationRequest, SimulationResult } from '@/types/identity';

export const PermissionSimulatorSection: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedDomain, setSelectedDomain] = useState<string>('Shots');
  const [selectedPermissionCode, setSelectedPermissionCode] = useState<string>('shot.update');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  const { data: peopleData } = usePeople();
  const { data: projectsData } = useProjects();

  const peopleList = useMemo(() => peopleData?.items || [], [peopleData]);
  const projectsList = useMemo(() => projectsData?.results || [], [projectsData]);

  const { simulatePermission } = useAccessManagementStore();

  useEffect(() => {
    if (peopleList.length > 0 && (!selectedUserId || !peopleList.some((p) => p.id === selectedUserId))) {
      setSelectedUserId(peopleList[0].id);
    }
  }, [peopleList, selectedUserId]);

  useEffect(() => {
    if (projectsList.length > 0 && (!selectedProjectId || !projectsList.some((p) => p.id === selectedProjectId))) {
      setSelectedProjectId(projectsList[0].id);
    }
  }, [projectsList, selectedProjectId]);

  const availablePermissionsForDomain = useMemo(() => {
    return DOMAIN_PERMISSIONS_CATALOG.filter((p) => p.domain === selectedDomain);
  }, [selectedDomain]);

  const handleDomainChange = (domain: string) => {
    setSelectedDomain(domain);
    const firstPerm = DOMAIN_PERMISSIONS_CATALOG.find((p) => p.domain === domain);
    if (firstPerm) {
      setSelectedPermissionCode(firstPerm.code);
    }
  };

  const handleRunSimulation = () => {
    const [res, act] = selectedPermissionCode.split('.');

    const req: SimulationRequest = {
      userId: selectedUserId || 'usr-001',
      organizationId: '',
      projectId: selectedProjectId || undefined,
      resource: res || 'shot',
      action: act || 'view',
    };

    const result = simulatePermission(req);
    setSimulationResult(result);
  };

  // Initial simulation run when ready
  useEffect(() => {
    if (selectedUserId && !simulationResult) {
      handleRunSimulation();
    }
  }, [selectedUserId]);

  const selectedUser = peopleList.find((u) => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      {/* Introduction Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Terminal className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Authorization Decision Engine Simulator</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Evaluate identity memberships, project boundaries, and role permissions without executing live mutations.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="primary"
          leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
          onClick={handleRunSimulation}
        >
          Evaluate Policy
        </Button>
      </div>

      {/* Simulator Inputs & Result Output Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Request Parameters */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2 pb-2 border-b border-slate-800">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            Simulation Request Parameters
          </h4>

          {/* User Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Target Identity (User)</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
            >
              {peopleList.length === 0 ? (
                <option value="">No users found</option>
              ) : (
                peopleList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role}) - {u.email}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Project Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Project Context</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="">Global / Studio Level (No Project)</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Domain Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Permission Domain</label>
            <select
              value={selectedDomain}
              onChange={(e) => handleDomainChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
            >
              {PERMISSION_DOMAINS.map((dom) => (
                <option key={dom} value={dom}>
                  {dom}
                </option>
              ))}
            </select>
          </div>

          {/* Permission Code Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Required Action Code</label>
            <select
              value={selectedPermissionCode}
              onChange={(e) => setSelectedPermissionCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-indigo-300 font-mono"
            >
              {availablePermissionsForDomain.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} - {p.name} ({p.riskLevel} Risk)
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <Button
              size="sm"
              variant="primary"
              className="w-full"
              leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
              onClick={handleRunSimulation}
            >
              Run Authorization Check
            </Button>
          </div>
        </div>

        {/* Right Output: Decision & Execution Trace */}
        <div className="lg:col-span-7">
          {simulationResult ? (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              {/* Top Decision Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                  simulationResult.allowed
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {simulationResult.allowed ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-8 h-8 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-lg font-extrabold tracking-tight">
                      {simulationResult.allowed ? 'ACCESS GRANTED (ALLOW)' : 'ACCESS DENIED (403 FORBIDDEN)'}
                    </div>
                    <div className="text-xs font-mono mt-0.5 opacity-90">
                      Code: <span className="font-bold">{simulationResult.permissionCode}</span>
                    </div>
                  </div>
                </div>

                <Badge
                  variant={simulationResult.allowed ? 'success' : 'error'}
                  className="text-xs px-2.5 py-1 font-mono uppercase"
                >
                  {simulationResult.allowed ? 'ALLOWED' : 'DENIED'}
                </Badge>
              </div>

              {/* Summary Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Evaluated Role</span>
                  <div className="font-bold text-white mt-0.5">
                    {simulationResult.evaluatedRole || selectedUser?.role || 'None'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Evaluated Scope</span>
                  <div className="font-mono text-teal-400 font-bold mt-0.5">
                    {simulationResult.evaluatedScope || 'GLOBAL'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 sm:col-span-1 col-span-2">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Reason</span>
                  <div className="text-slate-300 mt-0.5 truncate">{simulationResult.reason}</div>
                </div>
              </div>

              {/* Evaluation Step-by-Step Trace */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Engine Evaluation Step-by-Step Trace
                </h4>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {simulationResult.evaluationSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1 font-mono text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 font-bold">{step.step}</span>
                        <Badge
                          variant={
                            step.status === 'PASSED'
                              ? 'success'
                              : step.status === 'FAILED'
                              ? 'error'
                              : 'neutral'
                          }
                          className="text-[9px]"
                        >
                          {step.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500 font-mono">
              Click &quot;Run Authorization Check&quot; to test policy decisions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

