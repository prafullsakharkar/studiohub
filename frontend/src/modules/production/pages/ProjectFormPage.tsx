import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { projectsFormConfig } from '../structure/configs';

export const ProjectFormPage: React.FC = () => <DirectoryFormPage config={projectsFormConfig} />;
