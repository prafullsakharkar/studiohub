import React, { useState } from 'react';
import { Layers, Users, Cpu, Plus, Sparkles, Sliders } from 'lucide-react';
import { Organization, DepartmentEntity } from '@/types/organization';
import { mockDepartments } from '@/mocks/db/organization/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const DepartmentsTab: React.FC<{ org: Organization }> = ({ org }) => {
  const [departments, setDepartments] = useState<DepartmentEntity[]>(mockDepartments);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Production Departments & Pipeline Toolchains
          </h2>
          <p className="text-xs text-slate-400">
            Specialized studio disciplines, software configurations (Houdini, Maya, Nuke), and department supervisors.
          </p>
        </div>

        <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
          Add Department
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">{dept.name}</h3>
                  <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                    {dept.code}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">Supervisor: {dept.head_name}</span>
              </div>
              <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                {dept.member_count} Artists
              </span>
            </div>

            <p className="text-xs text-slate-400 line-clamp-2">{dept.description}</p>

            <div className="pt-2">
              <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1.5">Approved Software Stack</span>
              <div className="flex flex-wrap gap-1.5">
                {dept.software_stack.map((soft) => (
                  <span
                    key={soft}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300"
                  >
                    {soft}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Pipeline: USD Hydra 2.0</span>
              <span className="text-indigo-400 hover:underline cursor-pointer">Edit Toolchain</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
