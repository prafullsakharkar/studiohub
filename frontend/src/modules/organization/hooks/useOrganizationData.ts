import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '../api/organizationApi';
import { useOrganization } from '@/core/organization/useOrganization';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Client, Vendor, Person } from '@/types/organization';

export const useOrganizationsList = () => {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationApi.getOrganizations(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useClients = (params?: Record<string, any>) => {
  const { currentOrganization } = useOrganization();
  return useQuery({
    queryKey: ['clients', currentOrganization.id, params],
    queryFn: () => organizationApi.getClients({ ...params, organization_id: currentOrganization.id }),
    staleTime: 1000 * 30,
  });
};

export const useClientMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  const { currentOrganization } = useOrganization();

  const createClient = useMutation({
    mutationFn: (data: Partial<Client>) =>
      organizationApi.createClient({ ...data, organization_id: currentOrganization.id }),
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      addNotification({
        type: 'success',
        title: 'Client Studio Added',
        message: `${newClient.name} [${newClient.code}] has been registered in the production roster.`,
      });
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Failed to Create Client',
        message: 'Could not complete client studio registration.',
      });
    },
  });

  return { createClient };
};

export const useVendors = (params?: Record<string, any>) => {
  const { currentOrganization } = useOrganization();
  return useQuery({
    queryKey: ['vendors', currentOrganization.id, params],
    queryFn: () => organizationApi.getVendors({ ...params, organization_id: currentOrganization.id }),
    staleTime: 1000 * 30,
  });
};

export const useVendorMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  const { currentOrganization } = useOrganization();

  const createVendor = useMutation({
    mutationFn: (data: Partial<Vendor>) =>
      organizationApi.createVendor({ ...data, organization_id: currentOrganization.id }),
    onSuccess: (newVendor) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      addNotification({
        type: 'success',
        title: 'Vendor Partner Enrolled',
        message: `${newVendor.name} [${newVendor.code}] added as approved outsourcing partner.`,
      });
    },
  });

  return { createVendor };
};

export const usePeople = (params?: Record<string, any>) => {
  const { currentOrganization } = useOrganization();
  return useQuery({
    queryKey: ['people', currentOrganization.id, params],
    queryFn: () => organizationApi.getPeople({ ...params, organization_id: currentOrganization.id }),
    staleTime: 1000 * 30,
  });
};

export const usePerson = (id: string) => {
  return useQuery({
    queryKey: ['person', id],
    queryFn: () => organizationApi.getPersonDetail(id),
    enabled: !!id,
  });
};

export const usePersonMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  const { currentOrganization } = useOrganization();

  const createPerson = useMutation({
    mutationFn: (data: Partial<Person>) =>
      organizationApi.createPerson({ ...data, organization_id: currentOrganization.id }),
    onSuccess: (newPerson) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      addNotification({
        type: 'success',
        title: 'Crew Member Added',
        message: `${newPerson.full_name} (${newPerson.role}) assigned to ${newPerson.department_name}.`,
      });
    },
  });

  const updatePerson = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Person> }) =>
      organizationApi.updatePerson(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['person', updated.id] });
      addNotification({
        type: 'success',
        title: 'Artist Profile Updated',
        message: `${updated.full_name}'s record has been updated.`,
      });
    },
  });

  const deletePerson = useMutation({
    mutationFn: (id: string) => organizationApi.deletePerson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      addNotification({
        type: 'info',
        title: 'Artist Removed',
        message: 'The crew member has been removed from the roster.',
      });
    },
  });

  return { createPerson, updatePerson, deletePerson };
};

export const useDepartments = () => {
  const { currentOrganization } = useOrganization();
  return useQuery({
    queryKey: ['departments', currentOrganization.id],
    queryFn: () => organizationApi.getDepartments(),
    staleTime: 1000 * 60 * 2,
  });
};

export const useDepartment = (id: string) => {
  return useQuery({
    queryKey: ['department', id],
    queryFn: () => organizationApi.getDepartmentDetail(id),
    enabled: !!id,
  });
};

export const useDepartmentMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  const { currentOrganization } = useOrganization();

  const createDepartment = useMutation({
    mutationFn: (data: Partial<DepartmentEntity>) =>
      organizationApi.createDepartment({ ...data, organization_id: currentOrganization.id }),
    onSuccess: (dept) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      addNotification({
        type: 'success',
        title: 'Department Created',
        message: `${dept.name} [${dept.code}] initialized in pipeline.`,
      });
    },
  });

  const updateDepartment = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DepartmentEntity> }) =>
      organizationApi.updateDepartment(id, data),
    onSuccess: (dept) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['department', dept.id] });
      addNotification({
        type: 'success',
        title: 'Department Updated',
        message: `${dept.name} settings saved.`,
      });
    },
  });

  const deleteDepartment = useMutation({
    mutationFn: (id: string) => organizationApi.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      addNotification({
        type: 'info',
        title: 'Department Deleted',
        message: 'Department removed from pipeline.',
      });
    },
  });

  return { createDepartment, updateDepartment, deleteDepartment };
};

export const useTeams = () => {
  const { currentOrganization } = useOrganization();
  return useQuery({
    queryKey: ['teams', currentOrganization.id],
    queryFn: () => organizationApi.getTeams(),
    staleTime: 1000 * 60 * 2,
  });
};

export const useTeam = (id: string) => {
  return useQuery({
    queryKey: ['team', id],
    queryFn: () => organizationApi.getTeamDetail(id),
    enabled: !!id,
  });
};

export const useTeamMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  const { currentOrganization } = useOrganization();

  const createTeam = useMutation({
    mutationFn: (data: Partial<Team>) =>
      organizationApi.createTeam({ ...data, organization_id: currentOrganization.id }),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      addNotification({
        type: 'success',
        title: 'Team Squad Assembled',
        message: `${team.name} has been created.`,
      });
    },
  });

  const updateTeam = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Team> }) =>
      organizationApi.updateTeam(id, data),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team', team.id] });
      addNotification({
        type: 'success',
        title: 'Team Updated',
        message: `${team.name} updated successfully.`,
      });
    },
  });

  const deleteTeam = useMutation({
    mutationFn: (id: string) => organizationApi.deleteTeam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      addNotification({
        type: 'info',
        title: 'Team Deleted',
        message: 'Team squad removed.',
      });
    },
  });

  return { createTeam, updateTeam, deleteTeam };
};

export const useOffices = () => {
  const { currentOrganization } = useOrganization();
  return useQuery({
    queryKey: ['offices', currentOrganization.id],
    queryFn: () => organizationApi.getOffices(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useOffice = (id: string) => {
  return useQuery({
    queryKey: ['office', id],
    queryFn: () => organizationApi.getOfficeDetail(id),
    enabled: !!id,
  });
};

export const useOfficeMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();
  const { currentOrganization } = useOrganization();

  const createOffice = useMutation({
    mutationFn: (data: Partial<Office>) =>
      organizationApi.createOffice({ ...data, organization_id: currentOrganization.id }),
    onSuccess: (office) => {
      queryClient.invalidateQueries({ queryKey: ['offices'] });
      addNotification({
        type: 'success',
        title: 'Facility Hub Registered',
        message: `${office.name} [${office.city}] online.`,
      });
    },
  });

  const updateOffice = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Office> }) =>
      organizationApi.updateOffice(id, data),
    onSuccess: (office) => {
      queryClient.invalidateQueries({ queryKey: ['offices'] });
      queryClient.invalidateQueries({ queryKey: ['office', office.id] });
      addNotification({
        type: 'success',
        title: 'Facility Hub Updated',
        message: `${office.name} configuration saved.`,
      });
    },
  });

  const deleteOffice = useMutation({
    mutationFn: (id: string) => organizationApi.deleteOffice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offices'] });
      addNotification({
        type: 'info',
        title: 'Facility Hub Removed',
        message: 'Facility hub has been decommissioned.',
      });
    },
  });

  return { createOffice, updateOffice, deleteOffice };
};

export const usePublishedVersions = (params?: Record<string, any>) => {
  const { currentOrganization } = useOrganization();
  return useQuery({
    queryKey: ['versions', currentOrganization.id, params],
    queryFn: () => organizationApi.getVersions(params),
    staleTime: 1000 * 20,
  });
};

export const useStudioBilling = () => {
  const { currentOrganization } = useOrganization();
  return useQuery({
    queryKey: ['billing', currentOrganization.id],
    queryFn: () => organizationApi.getBilling(),
    staleTime: 1000 * 60,
  });
};

export const useProductionReports = () => {
  const { currentOrganization } = useOrganization();
  return useQuery({
    queryKey: ['reports', currentOrganization.id],
    queryFn: () => organizationApi.getReports(),
    staleTime: 1000 * 60,
  });
};
