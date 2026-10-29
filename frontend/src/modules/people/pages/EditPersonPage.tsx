import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { peopleFormConfig } from '@/modules/directory/entities/people';

export const EditPersonPage: React.FC = () => <DirectoryFormPage config={peopleFormConfig} />;
