import type { components } from '@/core/api/generated/openapi';
import { resourceApi } from './resource';

type Schemas = components['schemas'];

// The list filters, search fields and orderings below are the backend's (docs/sync/00-backend-inventory.md,
// masterdata section); the viewsets ignore anything else, so the UI offers nothing else.

// ---------------------------------------------------------------- teams
/** `member_count` is the live memberships of the team (CR-33); it is newer than the generated schema snapshot, so it is added here and pinned in `directoryRowKeys.ts`. */
export type Team = Schemas['Team'] & { readonly member_count: number };
export type TeamInput = Pick<Team, 'code' | 'name' | 'department'> & Partial<Pick<Team, 'description' | 'lead' | 'focus_discipline' | 'current_project_code' | 'color' | 'capacity'>>;
export const teamsApi = resourceApi<Team, TeamInput>('teams', '/api/v1/teams/');
export const TEAM_ORDERING = ['name', 'code', 'created_at'] as const;

// ---------------------------------------------------------------- team memberships (CR-32)
/**
 * A person's membership of a team: a person can be in several teams. Hand-written from the captured responses
 * (`samples/masterdata/_team_memberships_flow.json`); the keys are pinned in `directoryRowKeys.ts`. The names are
 * read-only conveniences; a membership is added and removed, never edited. `Person.team` is the primary team.
 */
export interface TeamMembership {
  id: string;
  team: string;
  team_name: string;
  person: string;
  person_name: string;
  person_status: string;
  person_department_name: string;
  person_office_name: string;
  created_at: string;
  updated_at: string;
}
export interface TeamMembershipInput {
  team: string;
  person: string;
}
export const teamMembershipsApi = resourceApi<TeamMembership, TeamMembershipInput>('team-memberships', '/api/v1/team-memberships/');
export const TEAM_MEMBERSHIP_ORDERING = ['created_at'] as const;

// ---------------------------------------------------------------- offices
export type Office = Schemas['Office'];
export type OfficeInput = Pick<Office, 'code' | 'name' | 'office_type' | 'timezone' | 'country' | 'city'> &
  Partial<Pick<Office, 'description' | 'state' | 'address' | 'postal_code' | 'phone' | 'email' | 'manager' | 'working_hours' | 'workstations_count' | 'render_nodes_count' | 'is_active' | 'is_headquarters'>>;
export const officesApi = resourceApi<Office, OfficeInput>('offices', '/api/v1/offices/');
export const OFFICE_ORDERING = ['name', 'code', 'created_at'] as const;

// ---------------------------------------------------------------- positions
export type Position = Schemas['Position'];
export type PositionInput = Pick<Position, 'code' | 'name'> & Partial<Pick<Position, 'description' | 'department' | 'parent' | 'level' | 'is_managerial' | 'band_level' | 'salary_range' | 'employment_type'>>;
export const positionsApi = resourceApi<Position, PositionInput>('positions', '/api/v1/positions/');
export const POSITION_ORDERING = ['level', 'name', 'created_at'] as const;

// ---------------------------------------------------------------- people
export type Person = Schemas['Person'];
export type PersonStatus = NonNullable<Person['status']>;
export const PERSON_STATUSES: ReadonlyArray<{ value: PersonStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];
export type PersonInput = Pick<Person, 'name'> &
  Partial<Pick<Person, 'description' | 'role' | 'department' | 'team' | 'office' | 'seniority' | 'skills' | 'timezone' | 'availability_status' | 'email' | 'phone'>>;
/** Sensitive fields: only sent for callers holding `masterdata.person.view_sensitive`. */
export type PersonSensitiveInput = Partial<Pick<Person, 'security_clearance' | 'date_of_birth' | 'nationality'>>;
export const peopleApi = resourceApi<Person, PersonInput & PersonSensitiveInput>('people', '/api/v1/people/');
export const PERSON_ORDERING = ['name', 'created_at'] as const;
/** Lifecycle routes on `/people/{id}/`: deactivate / reactivate / restore (link-user lives in api/identity/users). */
export type PersonAction = 'deactivate' | 'reactivate' | 'restore';

// ---------------------------------------------------------------- clients and vendors
export type Client = Schemas['Client'];
export type ClientInput = Pick<Client, 'name' | 'code'> &
  Partial<Pick<Client, 'contact_name' | 'email' | 'phone' | 'studio_type' | 'contract_tier' | 'portal_access' | 'status' | 'logo_url' | 'headquarters'>>;
/** `total_billed_usd` is financial: only writable/visible with `masterdata.client.view_financial`. */
export const clientsApi = resourceApi<Client, ClientInput & Partial<Pick<Client, 'total_billed_usd'>>>('clients', '/api/v1/clients/');
export const CLIENT_ORDERING = ['name', 'code', 'created_at'] as const;

export type Vendor = Schemas['Vendor'];
export type VendorInput = Pick<Vendor, 'name' | 'code'> &
  Partial<Pick<Vendor, 'contact_name' | 'email' | 'specialization' | 'security_tier' | 'nda_signed' | 'rating' | 'location' | 'status' | 'logo_url' | 'bandwidth_gbps' | 'bandwidth_link'>>;
export const vendorsApi = resourceApi<Vendor, VendorInput>('vendors', '/api/v1/vendors/');
export const VENDOR_ORDERING = ['name', 'code', 'created_at'] as const;

// ---------------------------------------------------------------- contacts and contracts
export type ClientContact = Schemas['ClientContact'];
export type ClientContactInput = Pick<ClientContact, 'client' | 'name'> & Partial<Pick<ClientContact, 'role' | 'email' | 'phone' | 'timezone' | 'portal_access' | 'is_primary'>>;
export const clientContactsApi = resourceApi<ClientContact, ClientContactInput>('client-contacts', '/api/v1/client-contacts/');

export type VendorContact = Schemas['VendorContact'];
export type VendorContactInput = Pick<VendorContact, 'vendor' | 'name'> & Partial<Pick<VendorContact, 'role' | 'email' | 'phone' | 'timezone' | 'is_primary'>>;
export const vendorContactsApi = resourceApi<VendorContact, VendorContactInput>('vendor-contacts', '/api/v1/vendor-contacts/');
export const CONTACT_ORDERING = ['name', 'created_at'] as const;

export type ClientContract = Schemas['ClientContract'];
export type ClientContractInput = Pick<ClientContract, 'client' | 'contract_number' | 'title'> &
  Partial<Pick<ClientContract, 'type' | 'effective_date' | 'expiry_date' | 'value_usd' | 'currency' | 'status' | 'nda_signed' | 'document_url'>>;
export const clientContractsApi = resourceApi<ClientContract, ClientContractInput>('client-contracts', '/api/v1/client-contracts/');

export type VendorContract = Schemas['VendorContract'];
export type VendorContractInput = Pick<VendorContract, 'vendor' | 'contract_number' | 'title'> &
  Partial<Pick<VendorContract, 'type' | 'effective_date' | 'expiry_date' | 'total_value_usd' | 'currency' | 'nda_signed' | 'security_tier' | 'status'>>;
export const vendorContractsApi = resourceApi<VendorContract, VendorContractInput>('vendor-contracts', '/api/v1/vendor-contracts/');
export const CONTRACT_ORDERING = ['contract_number', 'created_at'] as const;
/** Contract lifecycle routes: `POST {id}/activate|terminate|adjust-end-date|restore/`. */
export type ContractAction = 'activate' | 'terminate' | 'adjust-end-date' | 'restore';
