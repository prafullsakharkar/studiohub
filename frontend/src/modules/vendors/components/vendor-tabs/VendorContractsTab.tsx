import type React from 'react';
import { vendorContractsConfig } from '@/modules/directory/entities/partners';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';

export const VendorContractsTab: React.FC<{ vendorId: string }> = ({ vendorId }) => <RelatedRecords config={vendorContractsConfig} parentId={vendorId} />;
