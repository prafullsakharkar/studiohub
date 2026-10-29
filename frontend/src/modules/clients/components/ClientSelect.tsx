import React from 'react';
import { useClients } from '@/modules/clients/hooks/useClientsData';

interface ClientSelectProps {
  value?: string;
  onChange: (clientId: string, clientName?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Flat client-studio dropdown fed by `/api/v1/clients/`.
 * No org dimension.
 */
export const ClientSelect: React.FC<ClientSelectProps> = ({
  value,
  onChange,
  placeholder = '-- Select Client Studio --',
  className = '',
  disabled = false,
  id = 'client-select-dropdown',
}) => {
  const { data: clientsData, isLoading } = useClients();
  const clients = clientsData?.items ?? [];

  return (
    <select
      id={id}
      value={value ?? ''}
      disabled={disabled || isLoading}
      onChange={(e) => {
        const next = e.target.value;
        const picked = clients.find((c) => c.id === next);
        onChange(next, picked?.name);
      }}
      className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 appearance-none font-sans ${className}`}
    >
      <option value="">
        {isLoading ? 'Loading clients…' : placeholder}
      </option>
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.name}
          {client.code ? ` (${client.code})` : ''}
        </option>
      ))}
    </select>
  );
};
