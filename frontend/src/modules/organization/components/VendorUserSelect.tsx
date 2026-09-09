import React from 'react';
import { mockVendorUsers } from '@/mocks/db/organization/clientVendorDetails';

interface VendorUserSelectProps {
  vendorId?: string;
  value?: string;
  onChange: (userId: string, userName?: string, userEmail?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const VendorUserSelect: React.FC<VendorUserSelectProps> = ({
  vendorId,
  value,
  onChange,
  placeholder = '-- Select Vendor Artist / User --',
  className = '',
  disabled = false,
}) => {
  let users = mockVendorUsers;
  if (vendorId) {
    users = users.filter((u) => u.vendor_id === vendorId);
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selected = users.find((u) => u.id === selectedId);
    onChange(selectedId, selected?.name, selected?.email);
  };

  return (
    <select
      id="vendor-user-select-dropdown"
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || users.length === 0}
      className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 appearance-none font-sans ${className}`}
    >
      <option value="">
        {users.length === 0 ? 'No vendor users found' : placeholder}
      </option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name} ({user.role} • {user.specialization})
        </option>
      ))}
    </select>
  );
};
