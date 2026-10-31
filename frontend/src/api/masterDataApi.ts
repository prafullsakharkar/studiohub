import { ApiClient } from './client/ApiClient';
import {
  Client,
  Vendor,
  DepartmentEntity,
  Team,
  Office,
  ClientContact,
  ClientContract,
} from '@/types/masterData';
import { ListResult, PaginatedResponse } from '@/types/common';

const client = new ApiClient();

export const masterDataApi = {
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
};
