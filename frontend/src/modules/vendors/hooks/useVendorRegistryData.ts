import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataApi } from '@/api/masterDataApi';
import { trackEntityMutation } from '@/shared/hooks/trackEntityMutation';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { VendorContact, VendorContract } from '@/types/masterData';

export const VENDOR_REGISTRY_QUERY_KEYS = {
  contacts: (vendorId?: string) => ['vendor-contacts', vendorId] as const,
  contracts: (vendorId?: string) => ['vendor-contracts', vendorId] as const,
};

export const useVendorContacts = (vendorId?: string) => {
  return useQuery({
    queryKey: VENDOR_REGISTRY_QUERY_KEYS.contacts(vendorId),
    queryFn: () => masterDataApi.getVendorContacts(vendorId ? { vendor: vendorId } : undefined),
    enabled: Boolean(vendorId),
    staleTime: 1000 * 30,
  });
};

export const useVendorContactMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createVendorContact = useMutation({
    mutationFn: (data: Partial<VendorContact>) => masterDataApi.createVendorContact(data),
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-contacts'] });
      addNotification({
        type: 'success',
        title: 'Vendor Contact Added',
        message: `${contact.name} has been registered for this vendor studio.`,
      });
      trackEntityMutation(queryClient, {
        action: 'created',
        actionLabel: 'Vendor Contact Created',
        resourceType: 'vendor_contact',
        resourceId: contact.id,
        resourceName: contact.name,
        description: `Created vendor contact ${contact.name}.`,
        tags: ['Vendor', 'Contact', 'Creation'],
        auditAction: 'CREATE',
        auditEntityType: 'VendorContact',
      });
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Failed to Add Contact',
        message: 'The vendor contact could not be saved. Please try again.',
      });
    },
  });

  const deleteVendorContact = useMutation({
    mutationFn: (id: string) => masterDataApi.deleteVendorContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-contacts'] });
      addNotification({
        type: 'success',
        title: 'Vendor Contact Removed',
        message: 'The vendor contact has been deleted.',
      });
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Failed to Remove Contact',
        message: 'The vendor contact could not be deleted. Please try again.',
      });
    },
  });

  return { createVendorContact, deleteVendorContact };
};

export const useVendorContracts = (vendorId?: string) => {
  return useQuery({
    queryKey: VENDOR_REGISTRY_QUERY_KEYS.contracts(vendorId),
    queryFn: () => masterDataApi.getVendorContracts(vendorId ? { vendor: vendorId } : undefined),
    enabled: Boolean(vendorId),
    staleTime: 1000 * 30,
  });
};

export const useVendorContractMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createVendorContract = useMutation({
    mutationFn: (data: Partial<VendorContract>) => masterDataApi.createVendorContract(data),
    onSuccess: (contract) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-contracts'] });
      addNotification({
        type: 'success',
        title: 'Vendor Contract Registered',
        message: `Contract ${contract.contract_number} has been registered for this vendor studio.`,
      });
      trackEntityMutation(queryClient, {
        action: 'created',
        actionLabel: 'Vendor Contract Created',
        resourceType: 'vendor_contract',
        resourceId: contract.id,
        resourceName: contract.title,
        resourceCode: contract.contract_number,
        description: `Created vendor contract ${contract.contract_number} — ${contract.title}.`,
        tags: ['Vendor', 'Contract', 'Creation'],
        auditAction: 'CREATE',
        auditEntityType: 'VendorContract',
      });
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Failed to Register Contract',
        message: 'The vendor contract could not be saved. Please try again.',
      });
    },
  });

  const deleteVendorContract = useMutation({
    mutationFn: (id: string) => masterDataApi.deleteVendorContract(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-contracts'] });
      addNotification({
        type: 'success',
        title: 'Vendor Contract Removed',
        message: 'The vendor contract has been deleted.',
      });
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Failed to Remove Contract',
        message: 'The vendor contract could not be deleted. Please try again.',
      });
    },
  });

  return { createVendorContract, deleteVendorContract };
};
