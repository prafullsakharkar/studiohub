import React, { useState } from 'react';
import { Layers, Building, Check, Plus, ArrowRight } from 'lucide-react';
import { Person } from '@/types/organization';
import { useDepartments } from '@/modules/organization/hooks/useOrganizationData';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const PersonDepartmentsTab: React.FC<{
  person: Person;
  onAssignDepartment?: (deptId: string, deptName: string) => void;
}> = ({ person, onAssignDepartment }) => {
  const { data: departments } = useDepartments();
  const [selectedDept, setSelectedDept] = useState(person.department_id);

  const handleSelect = (dept: any) => {
    setSelectedDept(dept.id);
    if (onAssignDepartment) {
      onAssignDepartment(dept.id, dept.name);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Department Alignment & Craft Discipline
          </h3>
          <p className="text-xs text-slate-400">
            Current department assignment determines default supervisor routing, task reviews, and software toolsets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(departments || []).map((dept) => {
          const isCurrent = dept.id === selectedDept;
          return (
            <div
              key={dept.id}
              onClick={() => handleSelect(dept)}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${
                isCurrent
                  ? 'border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500/50'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: dept.color || '#6366f1' }}
                  />
                  <div>
                    <h4 className="font-bold text-sm text-white">{dept.name}</h4>
                    <span className="text-[10px] font-mono text-slate-400">Code: {dept.code}</span>
                  </div>
                </div>
                {isCurrent && (
                  <Badge variant="info" className="text-[10px] font-mono flex items-center gap-1">
                    <Check className="w-3 h-3" /> Assigned
                  </Badge>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-2 line-clamp-2">{dept.description}</p>

              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Supervisor: {dept.head_name}</span>
                <span className="font-mono text-[11px] text-white">{dept.member_count} artists</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
