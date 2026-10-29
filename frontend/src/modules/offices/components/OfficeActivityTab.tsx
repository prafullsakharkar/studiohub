import type React from 'react';
import { EntityHistory } from '@/components/history/EntityHistory';
import type { OfficeEntity } from '@/types/masterData';

export const OfficeActivityTab: React.FC<{ office: OfficeEntity }> = ({ office }) => <EntityHistory targetType="Office" targetId={office.id} title="Office history" />;
