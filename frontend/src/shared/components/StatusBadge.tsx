import React from 'react';
import { ProductionStatus, PriorityLevel } from '@/types/common';
import { Badge } from './Badge';

interface StatusBadgeProps {
  status: ProductionStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const getVariant = (s: ProductionStatus) => {
    switch (s) {
      case 'Approved':
        return 'success';
      case 'In Progress':
        return 'info';
      case 'Pending Review':
        return 'purple';
      case 'Retake':
        return 'error';
      case 'On Hold':
        return 'warning';
      case 'Omitted':
      case 'Not Started':
      default:
        return 'neutral';
    }
  };

  return (
    <Badge variant={getVariant(status)} size={size}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {status}
    </Badge>
  );
};

interface PriorityBadgeProps {
  priority: PriorityLevel;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'sm' }) => {
  const getVariant = (p: PriorityLevel) => {
    switch (p) {
      case 'Critical':
        return 'error';
      case 'High':
        return 'warning';
      case 'Medium':
        return 'info';
      case 'Low':
      default:
        return 'neutral';
    }
  };

  return (
    <Badge variant={getVariant(priority)} size={size}>
      {priority}
    </Badge>
  );
};
