import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { vendorsListConfig } from '@/modules/directory/entities/vendors';

export const VendorsPage: React.FC = () => <DirectoryListPage config={vendorsListConfig} />;
