import type React from 'react';
import { DirectoryFormPage } from './DirectoryFormPage';
import { DirectoryListPage } from './DirectoryListPage';
import { positionsFormConfig, positionsListConfig } from './entities/positions';

export const PositionsListPage: React.FC = () => <DirectoryListPage config={positionsListConfig} />;
export const CreatePositionPage: React.FC = () => <DirectoryFormPage config={positionsFormConfig} />;
export const EditPositionPage: React.FC = () => <DirectoryFormPage config={positionsFormConfig} />;
