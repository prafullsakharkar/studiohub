import type React from 'react';
import { departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import type { Department } from '@/api/masterdata/departments';
import { clientsApi, officesApi, peopleApi, positionsApi, teamsApi, vendorsApi } from '@/api/masterdata/directory';
import type { Client, Office, Person, Position, Team, Vendor } from '@/api/masterdata/directory';
import { EntityPicker } from '@/components/forms/EntityPicker';

export interface PickerProps {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  /** Narrow the list, e.g. `{ department: id }` for teams. */
  filters?: Record<string, string | number | boolean | undefined>;
}

/** Ready-made pickers for the directory entities; later phases import these instead of building selects. */
export const DepartmentPicker: React.FC<PickerProps> = ({ label = 'Department', ...p }) => (
  <EntityPicker<Department> label={label} queryKey={departmentKeys.all} fetchPage={departmentsApi.list} fetchOne={departmentsApi.get} getLabel={(d) => d.name} {...p} />
);
export const TeamPicker: React.FC<PickerProps> = ({ label = 'Team', ...p }) => (
  <EntityPicker<Team> label={label} queryKey={teamsApi.keys.all} fetchPage={teamsApi.list} fetchOne={teamsApi.get} getLabel={(t) => t.name} {...p} />
);
export const OfficePicker: React.FC<PickerProps> = ({ label = 'Office', ...p }) => (
  <EntityPicker<Office> label={label} queryKey={officesApi.keys.all} fetchPage={officesApi.list} fetchOne={officesApi.get} getLabel={(o) => `${o.name} (${o.city})`} {...p} />
);
export const PositionPicker: React.FC<PickerProps> = ({ label = 'Position', ...p }) => (
  <EntityPicker<Position> label={label} queryKey={positionsApi.keys.all} fetchPage={positionsApi.list} fetchOne={positionsApi.get} getLabel={(x) => x.name} {...p} />
);
export const PersonPicker: React.FC<PickerProps> = ({ label = 'Person', ...p }) => (
  <EntityPicker<Person> label={label} queryKey={peopleApi.keys.all} fetchPage={peopleApi.list} fetchOne={peopleApi.get} getLabel={(x) => x.full_name} {...p} />
);
export const ClientPicker: React.FC<PickerProps> = ({ label = 'Client', ...p }) => (
  <EntityPicker<Client> label={label} queryKey={clientsApi.keys.all} fetchPage={clientsApi.list} fetchOne={clientsApi.get} getLabel={(c) => c.name} {...p} />
);
export const VendorPicker: React.FC<PickerProps> = ({ label = 'Vendor', ...p }) => (
  <EntityPicker<Vendor> label={label} queryKey={vendorsApi.keys.all} fetchPage={vendorsApi.list} fetchOne={vendorsApi.get} getLabel={(v) => v.name} {...p} />
);
