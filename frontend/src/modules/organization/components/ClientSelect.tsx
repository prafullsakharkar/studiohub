import React from 'react';
import { useClients } from '../hooks/useOrganizationData';
import { Building } from 'lucide-react';

interface ClientSelectProps {
  value?: string;
  onChange: (clientId: string, clientName?: string) => void;
  studioTypeFilter?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const ClientSelect: React.FC<ClientSelectProps> = ({
  value,
  onChange,
  studioTypeFilter,
  placeholder = '-- Select Client Studio --',
  className = '',
  disabled = false,
}) => {
  const { data: clientsData, isLoading } = useClients();
  let clients = clientsData?.results || [];

  if (studioTypeFilter && studioTypeFilter !== 'ALL') {
    clients = clients.filter((c) => c.studio_type === studioTypeFilter);
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedClient = clients.find((c) => c.id === selectedId);
    onChange(selectedId, selectedClient?.name);
  };

  return (
    <div className="relative">
      <select
        id="client-select-dropdown"
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || isLoading}
        className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 appearance-none font-sans ${className}`}
      >
        <option value="">{isLoading ? 'Loading client accounts...' : placeholder}</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            [{client.code}] {client.name} — {client.studio_type}
          </option>
        ))}
      </select>
    </div>
  );
};
