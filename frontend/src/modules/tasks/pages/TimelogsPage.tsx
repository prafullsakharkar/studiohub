import type React from 'react';
import { useActiveProjectScope } from '@/core/production/useActiveProjectScope';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { timelogsFormConfig, useTimelogsListConfig } from '@/modules/production/work/timelogs';

/**
 * Time logs of the project chosen in the project switcher (every project with none chosen): yours, or the whole project's
 * for holders of `timelog.view_all`, with approval for `timelog.approve`.
 */
export const TimelogsPage: React.FC = () => <DirectoryListPage config={useTimelogsListConfig(useActiveProjectScope())} />;

export const TimelogFormPage: React.FC = () => <DirectoryFormPage config={timelogsFormConfig} />;
