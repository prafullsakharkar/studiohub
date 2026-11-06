import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { shotsFormConfig, useShotsListConfig } from '@/modules/production/work/shots';

/** Shots across the caller's projects. The Bulk menu opens once a project is chosen (CR-48). */
export const ShotsPage: React.FC = () => <DirectoryListPage config={useShotsListConfig()} />;

export const ShotFormPage: React.FC = () => <DirectoryFormPage config={shotsFormConfig} />;
