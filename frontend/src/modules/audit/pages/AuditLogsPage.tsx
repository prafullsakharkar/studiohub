import type React from 'react';
import { auditLogsConfig } from '../viewer/configs';
import { LogListPage } from '../viewer/LogListPage';

export const AuditLogsPage: React.FC = () => <LogListPage config={auditLogsConfig} />;
