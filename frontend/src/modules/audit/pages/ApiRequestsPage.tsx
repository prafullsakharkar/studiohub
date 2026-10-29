import type React from 'react';
import { apiRequestsConfig } from '../viewer/configs';
import { LogListPage } from '../viewer/LogListPage';

export const ApiRequestsPage: React.FC = () => <LogListPage config={apiRequestsConfig} />;
