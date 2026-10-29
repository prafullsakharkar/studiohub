import React from 'react';
import { useVendors } from '@/modules/vendors/hooks/useVendorsData';

interface VendorSelectProps {
  value?: string;
  onChange: (vendorId: string, vendorName?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Flat vendor-partner dropdown fed by `/api/v1/vendors/`. No org dimension.
 */
export const VendorSelect: React.FC<VendorSelectProps> = ({
  value,
  onChange,
  placeholder = '-- Select Vendor --',
  className = '',
  disabled = false,
  id = 'vendor-select-dropdown',
}) => {
  const { data: vendorsData, isLoading } = useVendors();
  const vendors = vendorsData?.items ?? [];

  return (
    <select
      id={id}
      value={value ?? ''}
      disabled={disabled || isLoading}
      onChange={(e) => {
        const next = e.target.value;
        const picked = vendors.find((v) => v.id === next);
        onChange(next, picked?.name);
      }}
      className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 appearance-none font-sans ${className}`}
    >
      <option value="">
        {isLoading ? 'Loading vendors…' : placeholder}
      </option>
      {vendors.map((vendor) => (
        <option key={vendor.id} value={vendor.id}>
          {vendor.name}
          {vendor.code ? ` (${vendor.code})` : ''}
        </option>
      ))}
    </select>
  );
};
