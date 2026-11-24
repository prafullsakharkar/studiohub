import type React from 'react';
import { useActiveProjectScope } from '@/core/production/useActiveProjectScope';
import { Link } from 'react-router-dom';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { reviewsFormConfig, useReviewsListConfig } from '@/modules/production/review/reviews';
import { Button } from '@/shared/components/Button';

/** Review sessions of the project chosen in the project switcher; with none chosen, of every project. */
export const ReviewsPage: React.FC = () => {
  const config = useReviewsListConfig(useActiveProjectScope());
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: () => (
          <Link to="/playlists">
            <Button size="sm" variant="outline">
              Playlists
            </Button>
          </Link>
        ),
      }}
    />
  );
};

export const ReviewFormPage: React.FC = () => <DirectoryFormPage config={reviewsFormConfig} />;
