import React from 'react';
import { useOffices } from '../hooks/useOrganizationData';

interface OfficeSelectProps {
  value?: string;
  onChange: (officeId: string, officeName?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const OfficeSelect: React.FC<OfficeSelectProps> = ({
  value,
  onChange,
  placeholder = '-- Select Studio Hub --',
  className = '',
  disabled = false,
}) => {
  const { data: officesData, isLoading } = useOffices();
  const offices = officesData || [];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selected = offices.find((o) => o.id === selectedId || o.name === selectedId);
    onChange(selectedId, selected?.name);
  };

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || isLoading}
      className={`bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 ${className}`}
    >
      <option value="">{isLoading ? 'Loading locations...' : placeholder}</option>
      {offices.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name} ({o.city}, {o.country} • {o.timezone})
        </option>
      ))}
    </select>
  );
};
