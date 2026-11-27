import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { departmentsListConfig } from '@/modules/directory/entities/departments';

export const DepartmentsListPage: React.FC = () => <DirectoryListPage config={departmentsListConfig} />;
