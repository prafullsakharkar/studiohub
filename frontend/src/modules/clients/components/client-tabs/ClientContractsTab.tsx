import type React from 'react';
import { clientContractsConfig } from '@/modules/directory/entities/partners';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';

export const ClientContractsTab: React.FC<{ clientId: string }> = ({ clientId }) => <RelatedRecords config={clientContractsConfig} parentId={clientId} />;
