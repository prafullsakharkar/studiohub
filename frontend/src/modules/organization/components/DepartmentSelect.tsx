import React from 'react';
import { useDepartments } from '../hooks/useOrganizationData';

interface DepartmentSelectProps {
  value?: string;
  onChange: (deptId: string, deptName?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const DepartmentSelect: React.FC<DepartmentSelectProps> = ({
  value,
  onChange,
  placeholder = '-- Select Department --',
  className = '',
  disabled = false,
}) => {
  const { data: departments, isLoading } = useDepartments();
  const depts = departments || [];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selected = depts.find((d) => d.id === selectedId || d.name === selectedId || d.code === selectedId);
    onChange(selectedId, selected?.name);
  };

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || isLoading}
      className={`bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 ${className}`}
    >
      <option value="">{isLoading ? 'Loading departments...' : placeholder}</option>
      {depts.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name} ({d.code})
        </option>
      ))}
    </select>
  );
};
