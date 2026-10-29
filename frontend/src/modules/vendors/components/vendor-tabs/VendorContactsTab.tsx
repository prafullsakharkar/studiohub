import type React from 'react';
import { vendorContactsConfig } from '@/modules/directory/entities/partners';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';

export const VendorContactsTab: React.FC<{ vendorId: string }> = ({ vendorId }) => <RelatedRecords config={vendorContactsConfig} parentId={vendorId} />;
