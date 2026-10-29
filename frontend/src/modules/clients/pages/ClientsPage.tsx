import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { clientsListConfig } from '@/modules/directory/entities/clients';

export const ClientsPage: React.FC = () => <DirectoryListPage config={clientsListConfig} />;
