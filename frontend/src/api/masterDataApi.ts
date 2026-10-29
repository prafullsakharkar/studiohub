import { ApiClient } from './client/ApiClient';
import {
  PlatformOverviewStats,
  Software,
  SoftwareVersion,
  MasterStatus,
  MasterTaskType,
  MasterAssetType,
  MasterShotType,
  MasterReviewType,
  MasterFileType,
  Client,
  Vendor,
  DepartmentEntity,
  Team,
  Office,
  Position,
  ClientContact,
  VendorContact,
  ClientContract,
  VendorContract,
} from '@/types/masterData';
import { ListResult, PaginatedResponse } from '@/types/common';

const client = new ApiClient();

export const masterDataApi = {
  // ----------------------------------------------------
  // Platform Level (Centrally Managed Global Definitions)
  // ----------------------------------------------------
  getPlatformOverview: () => client.get<PlatformOverviewStats>('/api/v1/platform/overview'),

  // Software & DCCs
  getPlatformSoftware: () => client.get<Software[]>('/api/v1/platform/master-data/software'),
  createPlatformSoftware: (data: Partial<Software>) =>
    client.post<Software>('/api/v1/platform/master-data/software', data),
  updatePlatformSoftware: (id: string, data: Partial<Software>) =>
    client.patch<Software>(`/api/v1/platform/master-data/software/${id}`, data),
  archivePlatformSoftware: (id: string) =>
    client.post<{ success: boolean; data: Software }>(`/api/v1/platform/master-data/software/${id}/archive`),
  restorePlatformSoftware: (id: string) =>
    client.post<{ success: boolean; data: Software }>(`/api/v1/platform/master-data/software/${id}/restore`),
  deletePlatformSoftware: (id: string) =>
    client.delete<{ success: boolean }>(`/api/v1/platform/master-data/software/${id}`),

  // Software Versions
  getPlatformSoftwareVersions: (softwareId: string) =>
    client.get<SoftwareVersion[]>(`/api/v1/platform/master-data/software/${softwareId}/versions`),
  createPlatformSoftwareVersion: (softwareId: string, data: Partial<SoftwareVersion>) =>
    client.post<SoftwareVersion>(`/api/v1/platform/master-data/software/${softwareId}/versions`, data),
  updatePlatformSoftwareVersion: (softwareId: string, versionId: string, data: Partial<SoftwareVersion>) =>
    client.patch<SoftwareVersion>(`/api/v1/platform/master-data/software/${softwareId}/versions/${versionId}`, data),
  archivePlatformSoftwareVersion: (softwareId: string, versionId: string) =>
    client.post<{ success: boolean; data: SoftwareVersion }>(`/api/v1/platform/master-data/software/${softwareId}/versions/${versionId}/archive`),
  restorePlatformSoftwareVersion: (softwareId: string, versionId: string) =>
    client.post<{ success: boolean; data: SoftwareVersion }>(`/api/v1/platform/master-data/software/${softwareId}/versions/${versionId}/restore`),
  deletePlatformSoftwareVersion: (softwareId: string, versionId: string) =>
    client.delete<{ success: boolean }>(`/api/v1/platform/master-data/software/${softwareId}/versions/${versionId}`),

  // Statuses
  getPlatformStatuses: (entityType?: string) =>
    client.get<MasterStatus[]>('/api/v1/platform/master-data/statuses', {
      params: entityType ? { entity_type: entityType } : undefined,
    }),
  createPlatformStatus: (data: Partial<MasterStatus>) =>
    client.post<MasterStatus>('/api/v1/platform/master-data/statuses', data),
  updatePlatformStatus: (id: string, data: Partial<MasterStatus>) =>
    client.patch<MasterStatus>(`/api/v1/platform/master-data/statuses/${id}`, data),
  archivePlatformStatus: (id: string) =>
    client.post<{ success: boolean; data: MasterStatus }>(`/api/v1/platform/master-data/statuses/${id}/archive`),
  restorePlatformStatus: (id: string) =>
    client.post<{ success: boolean; data: MasterStatus }>(`/api/v1/platform/master-data/statuses/${id}/restore`),
  deletePlatformStatus: (id: string) =>
    client.delete<{ success: boolean }>(`/api/v1/platform/master-data/statuses/${id}`),

  // Task Types
  getPlatformTaskTypes: () => client.get<MasterTaskType[]>('/api/v1/platform/master-data/task-types'),
  createPlatformTaskType: (data: Partial<MasterTaskType>) =>
    client.post<MasterTaskType>('/api/v1/platform/master-data/task-types', data),
  updatePlatformTaskType: (id: string, data: Partial<MasterTaskType>) =>
    client.patch<MasterTaskType>(`/api/v1/platform/master-data/task-types/${id}`, data),
  archivePlatformTaskType: (id: string) =>
    client.post<{ success: boolean; data: MasterTaskType }>(`/api/v1/platform/master-data/task-types/${id}/archive`),
  restorePlatformTaskType: (id: string) =>
    client.post<{ success: boolean; data: MasterTaskType }>(`/api/v1/platform/master-data/task-types/${id}/restore`),
  deletePlatformTaskType: (id: string) =>
    client.delete<{ success: boolean }>(`/api/v1/platform/master-data/task-types/${id}`),

  // Asset Types
  getPlatformAssetTypes: () => client.get<MasterAssetType[]>('/api/v1/platform/master-data/asset-types'),
  createPlatformAssetType: (data: Partial<MasterAssetType>) =>
    client.post<MasterAssetType>('/api/v1/platform/master-data/asset-types', data),
  updatePlatformAssetType: (id: string, data: Partial<MasterAssetType>) =>
    client.patch<MasterAssetType>(`/api/v1/platform/master-data/asset-types/${id}`, data),
  archivePlatformAssetType: (id: string) =>
    client.post<{ success: boolean; data: MasterAssetType }>(`/api/v1/platform/master-data/asset-types/${id}/archive`),
  restorePlatformAssetType: (id: string) =>
    client.post<{ success: boolean; data: MasterAssetType }>(`/api/v1/platform/master-data/asset-types/${id}/restore`),
  deletePlatformAssetType: (id: string) =>
    client.delete<{ success: boolean }>(`/api/v1/platform/master-data/asset-types/${id}`),

  // Shot Types
  getPlatformShotTypes: () => client.get<MasterShotType[]>('/api/v1/platform/master-data/shot-types'),
  createPlatformShotType: (data: Partial<MasterShotType>) =>
    client.post<MasterShotType>('/api/v1/platform/master-data/shot-types', data),
  updatePlatformShotType: (id: string, data: Partial<MasterShotType>) =>
    client.patch<MasterShotType>(`/api/v1/platform/master-data/shot-types/${id}`, data),
  archivePlatformShotType: (id: string) =>
    client.post<{ success: boolean; data: MasterShotType }>(`/api/v1/platform/master-data/shot-types/${id}/archive`),
  restorePlatformShotType: (id: string) =>
    client.post<{ success: boolean; data: MasterShotType }>(`/api/v1/platform/master-data/shot-types/${id}/restore`),
  deletePlatformShotType: (id: string) =>
    client.delete<{ success: boolean }>(`/api/v1/platform/master-data/shot-types/${id}`),

  // Review Types
  getPlatformReviewTypes: () => client.get<MasterReviewType[]>('/api/v1/platform/master-data/review-types'),
  createPlatformReviewType: (data: Partial<MasterReviewType>) =>
    client.post<MasterReviewType>('/api/v1/platform/master-data/review-types', data),
  updatePlatformReviewType: (id: string, data: Partial<MasterReviewType>) =>
    client.patch<MasterReviewType>(`/api/v1/platform/master-data/review-types/${id}`, data),
  archivePlatformReviewType: (id: string) =>
    client.post<{ success: boolean; data: MasterReviewType }>(`/api/v1/platform/master-data/review-types/${id}/archive`),
  restorePlatformReviewType: (id: string) =>
    client.post<{ success: boolean; data: MasterReviewType }>(`/api/v1/platform/master-data/review-types/${id}/restore`),
  deletePlatformReviewType: (id: string) =>
    client.delete<{ success: boolean }>(`/api/v1/platform/master-data/review-types/${id}`),

  // File Types
  getPlatformFileTypes: () => client.get<MasterFileType[]>('/api/v1/platform/master-data/file-types'),
  createPlatformFileType: (data: Partial<MasterFileType>) =>
    client.post<MasterFileType>('/api/v1/platform/master-data/file-types', data),
  updatePlatformFileType: (id: string, data: Partial<MasterFileType>) =>
    client.patch<MasterFileType>(`/api/v1/platform/master-data/file-types/${id}`, data),
  archivePlatformFileType: (id: string) =>
    client.post<{ success: boolean; data: MasterFileType }>(`/api/v1/platform/master-data/file-types/${id}/archive`),
  restorePlatformFileType: (id: string) =>
    client.post<{ success: boolean; data: MasterFileType }>(`/api/v1/platform/master-data/file-types/${id}/restore`),
  deletePlatformFileType: (id: string) =>
    client.delete<{ success: boolean }>(`/api/v1/platform/master-data/file-types/${id}`),

  // ----------------------------------------------------
  // Platform Roles, Groups, Departments & Positions CRUD
  // ----------------------------------------------------
  // Org-free contract: roles/groups live on the identity RBAC API
  // (/api/v1/roles/, /api/v1/groups/), departments/positions on the flat
  // masterdata directory API (/api/v1/departments/, /api/v1/positions/).
  // The legacy org-era /api/v1/platform/{roles,groups,departments,positions}
  // routes were removed with the organization app, so the frontend now
  // targets the flat endpoints and unwraps paginated list responses.

  // Roles
  getPlatformRoles: async () => {
    const res = await client.get<any>('/api/v1/roles/');
    return Array.isArray(res) ? res : (res?.results ?? []);
  },
  createPlatformRole: (data: any) => client.post<any>('/api/v1/roles/', data),
  updatePlatformRole: (id: string, data: any) => client.patch<any>(`/api/v1/roles/${id}/`, data),
  deletePlatformRole: (id: string) => client.delete<{ success: boolean }>(`/api/v1/roles/${id}/`),

  // Groups
  getPlatformGroups: async () => {
    const res = await client.get<any>('/api/v1/groups/');
    return Array.isArray(res) ? res : (res?.results ?? []);
  },
  createPlatformGroup: (data: any) => client.post<any>('/api/v1/groups/', data),
  updatePlatformGroup: (id: string, data: any) => client.patch<any>(`/api/v1/groups/${id}/`, data),
  deletePlatformGroup: (id: string) => client.delete<{ success: boolean }>(`/api/v1/groups/${id}/`),

  // Departments
  getPlatformDepartments: async () => {
    const res = await client.get<any>('/api/v1/departments/');
    return Array.isArray(res) ? res : (res?.results ?? []);
  },
  createPlatformDepartment: (data: any) => client.post<any>('/api/v1/departments/', data),
  updatePlatformDepartment: (id: string, data: any) => client.patch<any>(`/api/v1/departments/${id}/`, data),
  deletePlatformDepartment: (id: string) => client.delete<{ success: boolean }>(`/api/v1/departments/${id}/`),

  // Positions
  getPlatformPositions: async () => {
    const res = await client.get<any>('/api/v1/positions/');
    return Array.isArray(res) ? res : (res?.results ?? []);
  },
  createPlatformPosition: (data: any) => client.post<any>('/api/v1/positions/', data),
  updatePlatformPosition: (id: string, data: any) => client.patch<any>(`/api/v1/positions/${id}/`, data),
  deletePlatformPosition: (id: string) => client.delete<{ success: boolean }>(`/api/v1/positions/${id}/`),
  // ----------------------------------------------------
  // Directory (flat /api/v1/... endpoints). Formerly part of the deleted
  // org module's API client; re-homed here because clients, vendors,
  // departments, teams, offices and positions are master-data resources
  // served by the backend masterdata app. No org dimension.
  // ----------------------------------------------------
  // Clients
  getClients: async (params?: Record<string, any>): Promise<ListResult<Client>> => {
    const res = await client.get<Client[] | PaginatedResponse<Client>>('/api/v1/clients/', { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  getClientDetail: async (id: string): Promise<Client> => {
    return client.get<Client>(`/api/v1/clients/${id}/`);
  },
  createClient: async (clientData: Partial<Client>): Promise<Client> => {
    return client.post<Client>('/api/v1/clients/', clientData);
  },
  updateClient: async (id: string, clientData: Partial<Client>): Promise<Client> => {
    return client.patch<Client>(`/api/v1/clients/${id}/`, clientData);
  },
  archiveClient: async (id: string): Promise<Client> => {
    return client.patch<Client>(`/api/v1/clients/${id}/`, { status: 'Archived', is_deleted: false });
  },
  restoreClient: async (id: string): Promise<Client> => {
    return client.patch<Client>(`/api/v1/clients/${id}/`, { status: 'Active', is_deleted: false, deleted_at: null });
  },
  deleteClient: async (id: string): Promise<Client | void> => {
    return client.delete<Client>(`/api/v1/clients/${id}/`);
  },
  softDeleteClient: async (id: string): Promise<Client> => {
    return client.patch<Client>(`/api/v1/clients/${id}/`, {
      status: 'Deleted',
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    });
  },

  // Vendors
  getVendors: async (params?: Record<string, any>): Promise<ListResult<Vendor>> => {
    const res = await client.get<Vendor[] | PaginatedResponse<Vendor>>('/api/v1/vendors/', { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  getVendorDetail: async (id: string): Promise<Vendor> => {
    return client.get<Vendor>(`/api/v1/vendors/${id}/`);
  },
  createVendor: async (vendor: Partial<Vendor>): Promise<Vendor> => {
    return client.post<Vendor>('/api/v1/vendors/', vendor);
  },
  updateVendor: async (id: string, vendor: Partial<Vendor>): Promise<Vendor> => {
    return client.patch<Vendor>(`/api/v1/vendors/${id}/`, vendor);
  },
  archiveVendor: async (id: string): Promise<Vendor> => {
    return client.patch<Vendor>(`/api/v1/vendors/${id}/`, { status: 'Archived' });
  },
  restoreVendor: async (id: string): Promise<Vendor> => {
    return client.patch<Vendor>(`/api/v1/vendors/${id}/`, { status: 'Approved Partner' });
  },
  deleteVendor: async (id: string): Promise<void> => {
    return client.delete<void>(`/api/v1/vendors/${id}/`);
  },

  // ----------------------------------------------------
  // Client & Vendor Contacts / Contracts (flat registry)
  // Contacts/contracts stay flat: filter with ?client= / ?vendor=.
  // ----------------------------------------------------
  getClientContacts: async (params?: Record<string, any>): Promise<ListResult<ClientContact>> => {
    const res = await client.get<ClientContact[] | PaginatedResponse<ClientContact>>('/api/v1/client-contacts/', { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  createClientContact: async (data: Partial<ClientContact>): Promise<ClientContact> => {
    return client.post<ClientContact>('/api/v1/client-contacts/', data);
  },
  deleteClientContact: async (id: string): Promise<void> => {
    return client.delete<void>(`/api/v1/client-contacts/${id}/`);
  },
  getVendorContacts: async (params?: Record<string, any>): Promise<ListResult<VendorContact>> => {
    const res = await client.get<VendorContact[] | PaginatedResponse<VendorContact>>('/api/v1/vendor-contacts/', { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  createVendorContact: async (data: Partial<VendorContact>): Promise<VendorContact> => {
    return client.post<VendorContact>('/api/v1/vendor-contacts/', data);
  },
  deleteVendorContact: async (id: string): Promise<void> => {
    return client.delete<void>(`/api/v1/vendor-contacts/${id}/`);
  },
  getClientContracts: async (params?: Record<string, any>): Promise<ListResult<ClientContract>> => {
    const res = await client.get<ClientContract[] | PaginatedResponse<ClientContract>>('/api/v1/client-contracts/', { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  createClientContract: async (data: Partial<ClientContract>): Promise<ClientContract> => {
    return client.post<ClientContract>('/api/v1/client-contracts/', data);
  },
  deleteClientContract: async (id: string): Promise<void> => {
    return client.delete<void>(`/api/v1/client-contracts/${id}/`);
  },
  getVendorContracts: async (params?: Record<string, any>): Promise<ListResult<VendorContract>> => {
    const res = await client.get<VendorContract[] | PaginatedResponse<VendorContract>>('/api/v1/vendor-contracts/', { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  createVendorContract: async (data: Partial<VendorContract>): Promise<VendorContract> => {
    return client.post<VendorContract>('/api/v1/vendor-contracts/', data);
  },
  deleteVendorContract: async (id: string): Promise<void> => {
    return client.delete<void>(`/api/v1/vendor-contracts/${id}/`);
  },

  // Departments
  getDepartments: async (params?: Record<string, any>): Promise<ListResult<DepartmentEntity>> => {
    const res = await client.get<DepartmentEntity[] | PaginatedResponse<DepartmentEntity>>('/api/v1/departments/', { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  getDepartmentDetail: async (id: string): Promise<DepartmentEntity> => {
    return client.get<DepartmentEntity>(`/api/v1/departments/${id}/`);
  },
  createDepartment: async (dept: Partial<DepartmentEntity>): Promise<DepartmentEntity> => {
    return client.post<DepartmentEntity>('/api/v1/departments/', dept);
  },
  updateDepartment: async (id: string, dept: Partial<DepartmentEntity>): Promise<DepartmentEntity> => {
    return client.patch<DepartmentEntity>(`/api/v1/departments/${id}/`, dept);
  },
  deleteDepartment: async (id: string): Promise<void> => {
    return client.delete<void>(`/api/v1/departments/${id}/`);
  },

  // Teams
  getTeams: async (params?: Record<string, any>): Promise<ListResult<Team>> => {
    const res = await client.get<any>(`/api/v1/teams/`, { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
      department_id: t.department_id ?? t.department,
      lead_id: t.lead_id ?? t.lead,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  getTeamDetail: async (id: string): Promise<Team> => {
    return client.get<Team>(`/api/v1/teams/${id}/`);
  },
  createTeam: async (team: Partial<Team>): Promise<Team> => {
    return client.post<Team>('/api/v1/teams/', team);
  },
  updateTeam: async (id: string, team: Partial<Team>): Promise<Team> => {
    return client.patch<Team>(`/api/v1/teams/${id}/`, team);
  },
  deleteTeam: async (id: string): Promise<void> => {
    return client.delete<void>(`/api/v1/teams/${id}/`);
  },

  // Offices
  getOffices: async (params?: Record<string, any>): Promise<ListResult<Office>> => {
    const res = await client.get<any>(`/api/v1/offices/`, { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((o: any) => ({
      ...o,
      id: o.id ?? o.uuid,
      manager_id: o.manager_id ?? o.manager,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  getOfficeDetail: async (id: string): Promise<Office> => {
    return client.get<Office>(`/api/v1/offices/${id}/`);
  },
  createOffice: async (office: Partial<Office>): Promise<Office> => {
    return client.post<Office>('/api/v1/offices/', office);
  },
  updateOffice: async (id: string, office: Partial<Office>): Promise<Office> => {
    return client.patch<Office>(`/api/v1/offices/${id}/`, office);
  },
  deleteOffice: async (id: string): Promise<void> => {
    return client.delete<void>(`/api/v1/offices/${id}/`);
  },

  // Positions
  getPositions: async (params?: Record<string, any>): Promise<ListResult<Position>> => {
    const res = await client.get<Position[] | PaginatedResponse<Position>>('/api/v1/positions/', { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  getPositionDetail: async (id: string): Promise<Position> => {
    return client.get<Position>(`/api/v1/positions/${id}/`);
  },
  createPosition: async (position: Partial<Position>): Promise<Position> => {
    return client.post<Position>('/api/v1/positions/', position);
  },
  updatePosition: async (id: string, position: Partial<Position>): Promise<Position> => {
    return client.patch<Position>(`/api/v1/positions/${id}/`, position);
  },
  deletePosition: async (id: string): Promise<void> => {
    return client.delete<void>(`/api/v1/positions/${id}/`);
  },
};
