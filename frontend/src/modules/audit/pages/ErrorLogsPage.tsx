import type React from 'react';
import { errorLogsConfig } from '../viewer/configs';
import { LogListPage } from '../viewer/LogListPage';

export const ErrorLogsPage: React.FC = () => <LogListPage config={errorLogsConfig} />;
