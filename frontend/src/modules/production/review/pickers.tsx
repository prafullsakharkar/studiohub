import type React from 'react';
import { playlistsApi, reviewsApi, versionsApi } from '@/api/production/review';
import type { Playlist, Review, Version } from '@/api/production/review';
import { EntityPicker } from '@/components/forms/EntityPicker';
import type { PickerProps } from '@/modules/directory/pickers';

export const VersionPicker: React.FC<PickerProps> = ({ label = 'Version', ...p }) => (
  <EntityPicker<Version> label={label} queryKey={versionsApi.keys.all} fetchPage={versionsApi.list} fetchOne={versionsApi.get} getLabel={(v) => `${v.code} · ${v.version_number}`} {...p} />
);
export const PlaylistPicker: React.FC<PickerProps> = ({ label = 'Playlist', ...p }) => (
  <EntityPicker<Playlist> label={label} queryKey={playlistsApi.keys.all} fetchPage={playlistsApi.list} fetchOne={playlistsApi.get} getLabel={(x) => `${x.code} · ${x.name}`} {...p} />
);
export const ReviewPicker: React.FC<PickerProps> = ({ label = 'Review', ...p }) => (
  <EntityPicker<Review> label={label} queryKey={reviewsApi.keys.all} fetchPage={reviewsApi.list} fetchOne={reviewsApi.get} getLabel={(x) => `${x.code} · ${x.title}`} {...p} />
);
