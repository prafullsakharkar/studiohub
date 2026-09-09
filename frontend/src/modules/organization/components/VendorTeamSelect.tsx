import React from 'react';
import { mockVendorTeams } from '@/mocks/db/organization/clientVendorDetails';

interface VendorTeamSelectProps {
  vendorId?: string;
  value?: string;
  onChange: (teamId: string, teamName?: string, teamCode?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const VendorTeamSelect: React.FC<VendorTeamSelectProps> = ({
  vendorId,
  value,
  onChange,
  placeholder = '-- Select Vendor Squad / Team --',
  className = '',
  disabled = false,
}) => {
  let teams = mockVendorTeams;
  if (vendorId) {
    teams = teams.filter((t) => t.vendor_id === vendorId);
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selected = teams.find((t) => t.id === selectedId);
    onChange(selectedId, selected?.name, selected?.code);
  };

  return (
    <select
      id="vendor-team-select-dropdown"
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || teams.length === 0}
      className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 appearance-none font-sans ${className}`}
    >
      <option value="">
        {teams.length === 0 ? 'No external vendor teams found' : placeholder}
      </option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          [{team.code}] {team.name} ({team.focus_discipline} • Lead: {team.lead_name})
        </option>
      ))}
    </select>
  );
};
