import type React from 'react';
import { EntityHistory } from '@/components/history/EntityHistory';
import type { TeamEntity } from '@/types/masterData';

export const TeamActivityTab: React.FC<{ team: TeamEntity }> = ({ team }) => <EntityHistory targetType="Team" targetId={team.id} title="Team history" />;
