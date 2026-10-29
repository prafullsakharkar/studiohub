import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { projectsListConfig } from '../structure/configs';

export const ProjectsPage: React.FC = () => <DirectoryListPage config={projectsListConfig} />;
