import type React from 'react';
import { clientContactsConfig } from '@/modules/directory/entities/partners';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';

export const ClientContactsTab: React.FC<{ clientId: string }> = ({ clientId }) => <RelatedRecords config={clientContactsConfig} parentId={clientId} />;
