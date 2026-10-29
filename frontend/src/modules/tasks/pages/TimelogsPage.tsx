import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { timelogsFormConfig, useTimelogsListConfig } from '@/modules/production/work/timelogs';

/** Time logs: yours, or the whole project's for holders of `timelog.view_all`, with approval for `timelog.approve`. */
export const TimelogsPage: React.FC = () => <DirectoryListPage config={useTimelogsListConfig()} />;

export const TimelogFormPage: React.FC = () => <DirectoryFormPage config={timelogsFormConfig} />;
