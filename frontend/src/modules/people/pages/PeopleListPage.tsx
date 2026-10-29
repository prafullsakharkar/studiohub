import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { peopleListConfig } from '@/modules/directory/entities/people';

export const PeopleListPage: React.FC = () => <DirectoryListPage config={peopleListConfig} />;
