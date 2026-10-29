import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { teamsFormConfig } from '@/modules/directory/entities/teams';

export const EditTeamPage: React.FC = () => <DirectoryFormPage config={teamsFormConfig} />;
