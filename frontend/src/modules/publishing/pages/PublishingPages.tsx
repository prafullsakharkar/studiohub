import type React from 'react';
import { useActiveProjectScope } from '@/core/production/useActiveProjectScope';
import { Link } from 'react-router-dom';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { Button } from '@/shared/components/Button';
import { filesFormConfig, useFilesListConfig } from '../files';
import { publishFormConfig, usePublishListConfig } from '../jobs';
import { pathTemplateFormConfig, publishDestinationsFormConfig, rootsFormConfig, usePathTemplatesListConfig, usePublishDestinationsListConfig, useRootsListConfig } from '../registry';

const NavLink: React.FC<{ to: string; children: string }> = ({ to, children }) => (
  <Link to={to}>
    <Button size="sm" variant="outline">
      {children}
    </Button>
  </Link>
);

/** The other publishing screens, from the header of each. */
const nav = (current: 'jobs' | 'files' | 'roots' | 'templates' | 'destinations') => () => (
  <>
    {current !== 'jobs' && <NavLink to="/publishing">Export jobs</NavLink>}
    {current !== 'files' && <NavLink to="/publishing/files">Published files</NavLink>}
    {current !== 'roots' && <NavLink to="/publishing/storage-roots">Storage roots</NavLink>}
    {current !== 'templates' && <NavLink to="/publishing/path-templates">Path templates</NavLink>}
    {current !== 'destinations' && <NavLink to="/publishing/destinations">Destinations</NavLink>}
  </>
);

/** Export jobs and published files follow the project switcher (every project with none chosen); roots, templates and destinations are the studio's. */
export const PublishingPage: React.FC = () => <DirectoryListPage config={{ ...usePublishListConfig(useActiveProjectScope()), headerExtra: nav('jobs') }} />;
export const PublishFormPage: React.FC = () => <DirectoryFormPage config={publishFormConfig} />;

export const PublishedFilesPage: React.FC = () => {
  const config = useFilesListConfig(useActiveProjectScope());
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: () => (
          <>
            {nav('files')()}
            <NavLink to="/publishing/files/bulk">Register many</NavLink>
          </>
        ),
      }}
    />
  );
};
export const PublishedFileFormPage: React.FC = () => <DirectoryFormPage config={filesFormConfig} />;

export const StorageRootsPage: React.FC = () => <DirectoryListPage config={{ ...useRootsListConfig(), headerExtra: nav('roots') }} />;
export const StorageRootFormPage: React.FC = () => <DirectoryFormPage config={rootsFormConfig} />;

export const PathTemplatesPage: React.FC = () => <DirectoryListPage config={{ ...usePathTemplatesListConfig(), headerExtra: nav('templates') }} />;
export const PathTemplateFormPage: React.FC = () => <DirectoryFormPage config={pathTemplateFormConfig} />;

export const PublishDestinationsPage: React.FC = () => <DirectoryListPage config={{ ...usePublishDestinationsListConfig(), headerExtra: nav('destinations') }} />;
export const PublishDestinationFormPage: React.FC = () => <DirectoryFormPage config={publishDestinationsFormConfig} />;
