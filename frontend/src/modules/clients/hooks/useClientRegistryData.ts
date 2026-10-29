import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataApi } from '@/api/masterDataApi';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { ClientContact, ClientContract } from '@/types/masterData';

export const CLIENT_REGISTRY_QUERY_KEYS = {
  contacts: (clientId?: string) => ['client-contacts', clientId] as const,
  contracts: (clientId?: string) => ['client-contracts', clientId] as const,
};

export const useClientContacts = (clientId?: string) => {
  return useQuery({
    queryKey: CLIENT_REGISTRY_QUERY_KEYS.contacts(clientId),
    queryFn: () => masterDataApi.getClientContacts(clientId ? { client: clientId } : undefined),
    enabled: Boolean(clientId),
    staleTime: 1000 * 30,
  });
};

export const useClientContactMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createClientContact = useMutation({
    mutationFn: (data: Partial<ClientContact>) => masterDataApi.createClientContact(data),
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts'] });
      addNotification({
        type: 'success',
        title: 'Client Contact Added',
        message: `${contact.name} has been registered for this client studio.`,
      });
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Failed to Add Contact',
        message: 'The client contact could not be saved. Please try again.',
      });
    },
  });

  const deleteClientContact = useMutation({
    mutationFn: (id: string) => masterDataApi.deleteClientContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts'] });
      addNotification({
        type: 'success',
        title: 'Client Contact Removed',
        message: 'The client contact has been deleted.',
      });
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Failed to Remove Contact',
        message: 'The client contact could not be deleted. Please try again.',
      });
    },
  });

  return { createClientContact, deleteClientContact };
};

export const useClientContracts = (clientId?: string) => {
  return useQuery({
    queryKey: CLIENT_REGISTRY_QUERY_KEYS.contracts(clientId),
    queryFn: () => masterDataApi.getClientContracts(clientId ? { client: clientId } : undefined),
    enabled: Boolean(clientId),
    staleTime: 1000 * 30,
  });
};

export const useClientContractMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createClientContract = useMutation({
    mutationFn: (data: Partial<ClientContract>) => masterDataApi.createClientContract(data),
    onSuccess: (contract) => {
      queryClient.invalidateQueries({ queryKey: ['client-contracts'] });
      addNotification({
        type: 'success',
        title: 'Client Contract Registered',
        message: `Contract ${contract.contract_number} has been registered for this client studio.`,
      });
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Failed to Register Contract',
        message: 'The client contract could not be saved. Please try again.',
      });
    },
  });

  const deleteClientContract = useMutation({
    mutationFn: (id: string) => masterDataApi.deleteClientContract(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contracts'] });
      addNotification({
        type: 'success',
        title: 'Client Contract Removed',
        message: 'The client contract has been deleted.',
      });
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Failed to Remove Contract',
        message: 'The client contract could not be deleted. Please try again.',
      });
    },
  });

  return { createClientContract, deleteClientContract };
};
