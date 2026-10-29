import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { tasksFormConfig, useTasksListConfig } from '@/modules/production/work/tasks';

/** Tasks across the caller's projects: filter, change status in place, act on several at once, log time. */
export const TasksPage: React.FC = () => <DirectoryListPage config={useTasksListConfig()} />;

export const TaskFormPage: React.FC = () => <DirectoryFormPage config={tasksFormConfig} />;
