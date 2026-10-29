import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { vendorsFormConfig } from '@/modules/directory/entities/vendors';

export const VendorCreatePage: React.FC = () => <DirectoryFormPage config={vendorsFormConfig} />;
