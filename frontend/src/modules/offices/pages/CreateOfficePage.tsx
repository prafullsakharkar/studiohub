import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { officesFormConfig } from '@/modules/directory/entities/offices';

export const CreateOfficePage: React.FC = () => <DirectoryFormPage config={officesFormConfig} />;
