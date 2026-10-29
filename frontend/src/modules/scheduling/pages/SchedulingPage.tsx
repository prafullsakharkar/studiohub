import React from 'react';
import { SchedulingWorkspace } from '../components/SchedulingWorkspace';
import { ProductionContextGuard } from '@/core/production/ProductionContext';

export const SchedulingPage: React.FC = () => {
  return (
    <ProductionContextGuard>
      <SchedulingWorkspace />
    </ProductionContextGuard>
  );
};
