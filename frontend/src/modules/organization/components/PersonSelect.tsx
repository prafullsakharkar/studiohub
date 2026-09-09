import React from 'react';
import { usePeople } from '../hooks/useOrganizationData';
import { User } from 'lucide-react';

interface PersonSelectProps {
  value?: string;
  onChange: (personId: string, personName?: string) => void;
  departmentFilter?: string;
  teamFilter?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const PersonSelect: React.FC<PersonSelectProps> = ({
  value,
  onChange,
  departmentFilter,
  teamFilter,
  placeholder = '-- Select Crew Member --',
  className = '',
  disabled = false,
}) => {
  const { data: peopleData, isLoading } = usePeople();
  let people = peopleData?.results || [];

  if (departmentFilter) {
    people = people.filter(
      (p) =>
        p.department_name?.toLowerCase() === departmentFilter.toLowerCase() ||
        p.department_id === departmentFilter
    );
  }

  if (teamFilter) {
    people = people.filter(
      (p) =>
        p.team_name?.toLowerCase() === teamFilter.toLowerCase() ||
        p.team_id === teamFilter
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedPerson = people.find((p) => p.id === selectedId);
    onChange(selectedId, selectedPerson?.full_name);
  };

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || isLoading}
      className={`bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 ${className}`}
    >
      <option value="">{isLoading ? 'Loading crew...' : placeholder}</option>
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          {person.full_name} ({person.role} • {person.department_name})
        </option>
      ))}
    </select>
  );
};
