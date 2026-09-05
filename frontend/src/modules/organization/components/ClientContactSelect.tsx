import React from 'react';
import { useClientContacts } from '../hooks/useOrganizationData';

interface ClientContactSelectProps {
  clientId?: string;
  value?: string;
  onChange: (contactId: string, contactName?: string, contactEmail?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const ClientContactSelect: React.FC<ClientContactSelectProps> = ({
  clientId,
  value,
  onChange,
  placeholder = '-- Select Client Contact --',
  className = '',
  disabled = false,
}) => {
  const { data: contacts = [] } = useClientContacts(clientId);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selected = contacts.find((c) => c.id === selectedId);
    onChange(selectedId, selected?.name, selected?.email);
  };

  return (
    <select
      id="client-contact-select-dropdown"
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || contacts.length === 0}
      className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 appearance-none font-sans ${className}`}
    >
      <option value="">
        {contacts.length === 0 ? 'No contacts available for client' : placeholder}
      </option>
      {contacts.map((contact) => (
        <option key={contact.id} value={contact.id}>
          {contact.name} ({contact.role})
        </option>
      ))}
    </select>
  );
};
