import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { officesListConfig } from '@/modules/directory/entities/offices';

export const OfficesListPage: React.FC = () => <DirectoryListPage config={officesListConfig} />;
