import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { teamsListConfig } from '@/modules/directory/entities/teams';

export const TeamsListPage: React.FC = () => <DirectoryListPage config={teamsListConfig} />;
