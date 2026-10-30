import type React from 'react';
import { Link } from 'react-router-dom';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { Button } from '@/shared/components/Button';
import { deliveriesFormConfig, useDeliveriesListConfig } from '../deliveries';
import { destinationsFormConfig, useDestinationsListConfig } from '../destinations';

/** Deliveries across the caller's projects, with a way to the destinations. */
export const DeliveriesPage: React.FC = () => {
  const config = useDeliveriesListConfig();
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: () => (
          <Link to="/deliveries/destinations">
            <Button size="sm" variant="outline">
              Destinations
            </Button>
          </Link>
        ),
      }}
    />
  );
};

export const DeliveryFormPage: React.FC = () => <DirectoryFormPage config={deliveriesFormConfig} />;

export const DestinationsPage: React.FC = () => {
  const config = useDestinationsListConfig();
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: () => (
          <Link to="/deliveries">
            <Button size="sm" variant="outline">
              Deliveries
            </Button>
          </Link>
        ),
      }}
    />
  );
};

export const DestinationFormPage: React.FC = () => <DirectoryFormPage config={destinationsFormConfig} />;
