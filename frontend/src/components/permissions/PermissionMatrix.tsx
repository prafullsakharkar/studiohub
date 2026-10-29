import React from 'react';
import { PermissionsCatalogSection } from '@/modules/access/components/PermissionsCatalogSection';

export interface PermissionMatrixProps {
  className?: string;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({ className = '' }) => {
  return (
    <div className={className}>
      <PermissionsCatalogSection />
    </div>
  );
};

export default PermissionMatrix;
