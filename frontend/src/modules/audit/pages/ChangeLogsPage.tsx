import type React from 'react';
import { changeLogsConfig } from '../viewer/configs';
import { LogListPage } from '../viewer/LogListPage';

export const ChangeLogsPage: React.FC = () => <LogListPage config={changeLogsConfig} />;
