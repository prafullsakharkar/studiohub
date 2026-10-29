import type React from 'react';
import { backgroundJobsConfig } from '../viewer/configs';
import { LogListPage } from '../viewer/LogListPage';

export const BackgroundJobsPage: React.FC = () => <LogListPage config={backgroundJobsConfig} />;
