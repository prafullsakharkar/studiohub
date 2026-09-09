import React from 'react';
import { useTeams } from '../hooks/useOrganizationData';

interface TeamSelectProps {
  value?: string;
  onChange: (teamId: string, teamName?: string) => void;
  departmentId?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const TeamSelect: React.FC<TeamSelectProps> = ({
  value,
  onChange,
  departmentId,
  placeholder = '-- Select Team Squad --',
  className = '',
  disabled = false,
}) => {
  const { data: teamsData, isLoading } = useTeams();
  let teams = teamsData || [];

  if (departmentId) {
    teams = teams.filter((t) => t.department_id === departmentId || t.department_name === departmentId);
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selected = teams.find((t) => t.id === selectedId || t.name === selectedId || t.code === selectedId);
    onChange(selectedId, selected?.name);
  };

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || isLoading}
      className={`bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 ${className}`}
    >
      <option value="">{isLoading ? 'Loading squads...' : placeholder}</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} ({t.code} • Lead: {t.lead_name})
        </option>
      ))}
    </select>
  );
};
