import type React from 'react';
import { useMemo } from 'react';
import { deliveriesApi } from '@/api/deliveries/deliveries';
import type { Delivery, DeliveryRow } from '@/api/deliveries/deliveries';
import { calendarsApi, resourcesApi } from '@/api/scheduling/scheduling';
import type { Resource, ResourceRow, WorkCalendar } from '@/api/scheduling/scheduling';
import { usersApi } from '@/api/identity/users';
import type { UserSummary } from '@/api/identity/users';
import { EntityPicker } from '@/components/forms/EntityPicker';
import type { PickerProps } from '@/modules/directory/pickers';

export const ResourcePicker: React.FC<PickerProps> = ({ label = 'Resource', ...p }) => (
  <EntityPicker<ResourceRow> label={label} queryKey={resourcesApi.keys.all} fetchPage={resourcesApi.list} fetchOne={resourcesApi.get as unknown as (id: string, signal?: AbortSignal) => Promise<Resource & ResourceRow>} getLabel={(r) => `${r.code} · ${r.name}`} {...p} />
);

export const CalendarPicker: React.FC<PickerProps> = ({ label = 'Work calendar', ...p }) => (
  <EntityPicker<WorkCalendar> label={label} queryKey={calendarsApi.keys.all} fetchPage={calendarsApi.list} fetchOne={calendarsApi.get} getLabel={(c) => `${c.name} (${c.time_zone})`} {...p} />
);

/** Needs `identity.user.view` (the list is 403 without it): forms gate the field with that code. */
export const UserPicker: React.FC<PickerProps> = ({ label = 'User', ...p }) => (
  <EntityPicker<UserSummary & { id: string }> label={label} queryKey={['identity-users']} fetchPage={usersApi.list as never} fetchOne={usersApi.get as never} getLabel={(u) => u.email} {...p} />
);

/**
 * The deliveries of one project (the studio list ignores a project filter, CR-17, so this reads the project's own
 * route). That route needs `delivery.view` and full access to the project; the milestone form gates the field.
 */
export const ProjectDeliveryPicker: React.FC<PickerProps & { projectId: string }> = ({ label = 'Delivery', projectId, ...p }) => {
  const fetchPage = useMemo(() => deliveriesApi.ofProject(projectId), [projectId]);
  return (
    <EntityPicker<DeliveryRow> label={label} queryKey={['deliveries', 'of-project', projectId]} fetchPage={fetchPage} fetchOne={deliveriesApi.get as unknown as (id: string, signal?: AbortSignal) => Promise<Delivery & DeliveryRow>} getLabel={(d) => `${d.code} · ${d.name}`} disabled={!projectId || p.disabled} {...p} />
  );
};
