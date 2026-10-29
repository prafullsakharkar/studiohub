import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { vendorsFormConfig } from '@/modules/directory/entities/vendors';

export const VendorEditPage: React.FC = () => <DirectoryFormPage config={vendorsFormConfig} />;
