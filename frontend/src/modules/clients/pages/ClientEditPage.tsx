import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { clientsFormConfig } from '@/modules/directory/entities/clients';

export const ClientEditPage: React.FC = () => <DirectoryFormPage config={clientsFormConfig} />;
