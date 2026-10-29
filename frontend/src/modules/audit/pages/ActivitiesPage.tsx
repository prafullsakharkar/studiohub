import type React from 'react';
import { activityConfig } from '../viewer/configs';
import { LogListPage } from '../viewer/LogListPage';

export const ActivitiesPage: React.FC = () => <LogListPage config={activityConfig} />;
