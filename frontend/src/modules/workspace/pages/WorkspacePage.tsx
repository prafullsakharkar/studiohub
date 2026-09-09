import React from 'react';
import { Workspace } from '@/shared/workspace/Workspace';

export const WorkspacePage: React.FC = () => {
  return (
    <div className="h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <Workspace />
    </div>
  );
};
