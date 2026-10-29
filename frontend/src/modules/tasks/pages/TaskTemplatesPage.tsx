import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { TaskTemplateForm, useTemplatesListConfig } from '@/modules/production/work/templates';

export const TaskTemplatesPage: React.FC = () => <DirectoryListPage config={useTemplatesListConfig()} />;

export const TaskTemplateFormPage: React.FC = () => <TaskTemplateForm />;
