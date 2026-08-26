import React from 'react';
import { useVendors } from '../hooks/useOrganizationData';

interface VendorSelectProps {
  value?: string;
  onChange: (vendorId: string, vendorName?: string) => void;
  specializationFilter?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const VendorSelect: React.FC<VendorSelectProps> = ({
  value,
  onChange,
  specializationFilter,
  placeholder = '-- Select Vendor Partner --',
  className = '',
  disabled = false,
}) => {
  const { data: vendorsData, isLoading } = useVendors();
  let vendors = vendorsData?.results || [];

  if (specializationFilter && specializationFilter !== 'ALL') {
    vendors = vendors.filter((v) => v.specialization === specializationFilter);
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedVendor = vendors.find((v) => v.id === selectedId);
    onChange(selectedId, selectedVendor?.name);
  };

  return (
    <select
      id="vendor-select-dropdown"
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || isLoading}
      className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 appearance-none font-sans ${className}`}
    >
      <option value="">{isLoading ? 'Loading vendor partners...' : placeholder}</option>
      {vendors.map((vendor) => (
        <option key={vendor.id} value={vendor.id}>
          [{vendor.code}] {vendor.name} — {vendor.specialization} ({vendor.security_tier})
        </option>
      ))}
    </select>
  );
};
