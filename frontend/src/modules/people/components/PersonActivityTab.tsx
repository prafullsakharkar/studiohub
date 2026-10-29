import type React from 'react';
import { EntityHistory } from '@/components/history/EntityHistory';
import type { Person } from '@/types/masterData';

export const PersonActivityTab: React.FC<{ person: Person }> = ({ person }) => <EntityHistory targetType="Person" targetId={person.id} title="Person history" />;
