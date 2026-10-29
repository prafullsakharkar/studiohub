import type React from 'react';
import { tracksConfig } from '../viewer/configs';
import { LogListPage } from '../viewer/LogListPage';

export const TracksPage: React.FC = () => <LogListPage config={tracksConfig} />;
