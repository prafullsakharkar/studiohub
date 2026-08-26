import { apiClient } from '@/api/client/ApiClient';
import {
  Organization,
  Client,
  Vendor,
  Person,
  DepartmentEntity,
  Team,
  Office,
  PublishedVersion,
  StudioBilling,
  ProductionReport,
  StudioNotification,
} from '@/types/organization';
import { PaginatedResponse } from '@/types/drf';

export const organizationApi = {
  // Organizations
  getOrganizations: async (params?: Record<string, any>): Promise<Organization[]> => {
    return apiClient.get<Organization[]>('/api/v1/organizations/', { params });
  },
  getOrganizationsPaginated: async (params?: Record<string, any>): Promise<PaginatedResponse<Organization>> => {
    return apiClient.get<PaginatedResponse<Organization>>('/api/v1/organizations/', { params: { ...params, page_size: params?.page_size || 10 } });
  },
  getOrganizationDetail: async (id: string): Promise<Organization> => {
    return apiClient.get<Organization>(`/api/v1/organizations/${id}/`);
  },
  createOrganization: async (org: Partial<Organization>): Promise<Organization> => {
    return apiClient.post<Organization>('/api/v1/organizations/', org);
  },
  updateOrganization: async (id: string, org: Partial<Organization>): Promise<Organization> => {
    return apiClient.patch<Organization>(`/api/v1/organizations/${id}/`, org);
  },
  archiveOrganization: async (id: string): Promise<Organization> => {
    return apiClient.patch<Organization>(`/api/v1/organizations/${id}/`, { status: 'Archived' });
  },
  restoreOrganization: async (id: string): Promise<Organization> => {
    return apiClient.patch<Organization>(`/api/v1/organizations/${id}/`, { status: 'Active' });
  },
  deleteOrganization: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/organizations/${id}/`);
  },

  // Clients
  getClients: async (params?: Record<string, any>): Promise<PaginatedResponse<Client>> => {
    return apiClient.get<PaginatedResponse<Client>>('/api/v1/clients/', { params });
  },
  getClientDetail: async (id: string): Promise<Client> => {
    return apiClient.get<Client>(`/api/v1/clients/${id}/`);
  },
  createClient: async (client: Partial<Client>): Promise<Client> => {
    return apiClient.post<Client>('/api/v1/clients/', client);
  },
  updateClient: async (id: string, client: Partial<Client>): Promise<Client> => {
    return apiClient.patch<Client>(`/api/v1/clients/${id}/`, client);
  },
  archiveClient: async (id: string): Promise<Client> => {
    return apiClient.patch<Client>(`/api/v1/clients/${id}/`, { status: 'Archived' });
  },
  restoreClient: async (id: string): Promise<Client> => {
    return apiClient.patch<Client>(`/api/v1/clients/${id}/`, { status: 'Active' });
  },
  deleteClient: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/clients/${id}/`);
  },

  // Vendors
  getVendors: async (params?: Record<string, any>): Promise<PaginatedResponse<Vendor>> => {
    return apiClient.get<PaginatedResponse<Vendor>>('/api/v1/vendors/', { params });
  },
  getVendorDetail: async (id: string): Promise<Vendor> => {
    return apiClient.get<Vendor>(`/api/v1/vendors/${id}/`);
  },
  createVendor: async (vendor: Partial<Vendor>): Promise<Vendor> => {
    return apiClient.post<Vendor>('/api/v1/vendors/', vendor);
  },
  updateVendor: async (id: string, vendor: Partial<Vendor>): Promise<Vendor> => {
    return apiClient.patch<Vendor>(`/api/v1/vendors/${id}/`, vendor);
  },
  archiveVendor: async (id: string): Promise<Vendor> => {
    return apiClient.patch<Vendor>(`/api/v1/vendors/${id}/`, { status: 'Archived' });
  },
  restoreVendor: async (id: string): Promise<Vendor> => {
    return apiClient.patch<Vendor>(`/api/v1/vendors/${id}/`, { status: 'Approved Partner' });
  },
  deleteVendor: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/vendors/${id}/`);
  },

  // People
  getPeople: async (params?: Record<string, any>): Promise<PaginatedResponse<Person>> => {
    return apiClient.get<PaginatedResponse<Person>>('/api/v1/people/', { params });
  },
  getPersonDetail: async (id: string): Promise<Person> => {
    return apiClient.get<Person>(`/api/v1/people/${id}/`);
  },
  createPerson: async (person: Partial<Person>): Promise<Person> => {
    return apiClient.post<Person>('/api/v1/people/', person);
  },
  updatePerson: async (id: string, person: Partial<Person>): Promise<Person> => {
    return apiClient.patch<Person>(`/api/v1/people/${id}/`, person);
  },
  deletePerson: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/people/${id}/`);
  },

  // Departments
  getDepartments: async (): Promise<DepartmentEntity[]> => {
    return apiClient.get<DepartmentEntity[]>('/api/v1/departments/');
  },
  getDepartmentDetail: async (id: string): Promise<DepartmentEntity> => {
    return apiClient.get<DepartmentEntity>(`/api/v1/departments/${id}/`);
  },
  createDepartment: async (dept: Partial<DepartmentEntity>): Promise<DepartmentEntity> => {
    return apiClient.post<DepartmentEntity>('/api/v1/departments/', dept);
  },
  updateDepartment: async (id: string, dept: Partial<DepartmentEntity>): Promise<DepartmentEntity> => {
    return apiClient.patch<DepartmentEntity>(`/api/v1/departments/${id}/`, dept);
  },
  deleteDepartment: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/departments/${id}/`);
  },

  // Teams
  getTeams: async (): Promise<Team[]> => {
    return apiClient.get<Team[]>('/api/v1/teams/');
  },
  getTeamDetail: async (id: string): Promise<Team> => {
    return apiClient.get<Team>(`/api/v1/teams/${id}/`);
  },
  createTeam: async (team: Partial<Team>): Promise<Team> => {
    return apiClient.post<Team>('/api/v1/teams/', team);
  },
  updateTeam: async (id: string, team: Partial<Team>): Promise<Team> => {
    return apiClient.patch<Team>(`/api/v1/teams/${id}/`, team);
  },
  deleteTeam: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/teams/${id}/`);
  },

  // Offices
  getOffices: async (): Promise<Office[]> => {
    return apiClient.get<Office[]>('/api/v1/offices/');
  },
  getOfficeDetail: async (id: string): Promise<Office> => {
    return apiClient.get<Office>(`/api/v1/offices/${id}/`);
  },
  createOffice: async (office: Partial<Office>): Promise<Office> => {
    return apiClient.post<Office>('/api/v1/offices/', office);
  },
  updateOffice: async (id: string, office: Partial<Office>): Promise<Office> => {
    return apiClient.patch<Office>(`/api/v1/offices/${id}/`, office);
  },
  deleteOffice: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/offices/${id}/`);
  },

  // Published Versions
  getVersions: async (params?: Record<string, any>): Promise<PaginatedResponse<PublishedVersion>> => {
    return apiClient.get<PaginatedResponse<PublishedVersion>>('/api/v1/versions/', { params });
  },

  // Billing
  getBilling: async (): Promise<StudioBilling> => {
    return apiClient.get<StudioBilling>('/api/v1/billing/');
  },

  // Reports
  getReports: async (): Promise<ProductionReport[]> => {
    return apiClient.get<ProductionReport[]>('/api/v1/reports/');
  },

  // Notifications
  getNotifications: async (): Promise<StudioNotification[]> => {
    return apiClient.get<StudioNotification[]>('/api/v1/notifications/');
  },
};
