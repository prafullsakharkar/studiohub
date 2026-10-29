import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataApi } from '@/api/masterDataApi';
import {
  Software,
  SoftwareVersion,
  MasterStatus,
  MasterTaskType,
  MasterAssetType,
  MasterShotType,
  MasterReviewType,
  MasterFileType,
} from '@/types/masterData';

// ==========================================
// 1. PLATFORM MASTER DATA QUERY HOOKS
// ==========================================

export const usePlatformStats = () => {
  return useQuery({
    queryKey: ['platform', 'master-data', 'overview'],
    queryFn: () => masterDataApi.getPlatformOverview(),
    staleTime: 1000 * 60 * 5,
  });
};

export const usePlatformSoftwareList = () => {
  return useQuery({
    queryKey: ['platform', 'master-data', 'software'],
    queryFn: () => masterDataApi.getPlatformSoftware(),
    staleTime: 1000 * 60 * 5,
  });
};

export const usePlatformMasterStatuses = (entityType?: string) => {
  return useQuery({
    queryKey: ['platform', 'master-data', 'statuses', entityType],
    queryFn: () => masterDataApi.getPlatformStatuses(entityType),
    staleTime: 1000 * 60 * 5,
  });
};

export const usePlatformMasterTaskTypes = () => {
  return useQuery({
    queryKey: ['platform', 'master-data', 'task-types'],
    queryFn: () => masterDataApi.getPlatformTaskTypes(),
    staleTime: 1000 * 60 * 5,
  });
};

export const usePlatformMasterAssetTypes = () => {
  return useQuery({
    queryKey: ['platform', 'master-data', 'asset-types'],
    queryFn: () => masterDataApi.getPlatformAssetTypes(),
    staleTime: 1000 * 60 * 5,
  });
};

export const usePlatformMasterShotTypes = () => {
  return useQuery({
    queryKey: ['platform', 'master-data', 'shot-types'],
    queryFn: () => masterDataApi.getPlatformShotTypes(),
    staleTime: 1000 * 60 * 5,
  });
};

export const usePlatformMasterReviewTypes = () => {
  return useQuery({
    queryKey: ['platform', 'master-data', 'review-types'],
    queryFn: () => masterDataApi.getPlatformReviewTypes(),
    staleTime: 1000 * 60 * 5,
  });
};

export const usePlatformMasterFileTypes = () => {
  return useQuery({
    queryKey: ['platform', 'master-data', 'file-types'],
    queryFn: () => masterDataApi.getPlatformFileTypes(),
    staleTime: 1000 * 60 * 5,
  });
};

export const usePlatformSoftwareVersions = (softwareId: string) => {
  return useQuery({
    queryKey: ['platform', 'master-data', 'software', softwareId, 'versions'],
    queryFn: () => masterDataApi.getPlatformSoftwareVersions(softwareId),
    enabled: Boolean(softwareId),
    staleTime: 1000 * 60 * 5,
  });
};

// ==========================================
// 2. PLATFORM MASTER DATA MUTATION HOOKS
// ==========================================

// Software Mutations
export const useCreatePlatformSoftware = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Software>) => masterDataApi.createPlatformSoftware(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useUpdatePlatformSoftware = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Software> }) =>
      masterDataApi.updatePlatformSoftware(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useArchivePlatformSoftware = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.archivePlatformSoftware(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useRestorePlatformSoftware = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.restorePlatformSoftware(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useDeletePlatformSoftware = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformSoftware(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

// Software Version Mutations
export const useCreatePlatformSoftwareVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ softwareId, data }: { softwareId: string; data: Partial<SoftwareVersion> }) =>
      masterDataApi.createPlatformSoftwareVersion(softwareId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software', variables.softwareId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useUpdatePlatformSoftwareVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ softwareId, versionId, data }: { softwareId: string; versionId: string; data: Partial<SoftwareVersion> }) =>
      masterDataApi.updatePlatformSoftwareVersion(softwareId, versionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software', variables.softwareId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useArchivePlatformSoftwareVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ softwareId, versionId }: { softwareId: string; versionId: string }) =>
      masterDataApi.archivePlatformSoftwareVersion(softwareId, versionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software', variables.softwareId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useRestorePlatformSoftwareVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ softwareId, versionId }: { softwareId: string; versionId: string }) =>
      masterDataApi.restorePlatformSoftwareVersion(softwareId, versionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software', variables.softwareId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useDeletePlatformSoftwareVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ softwareId, versionId }: { softwareId: string; versionId: string }) =>
      masterDataApi.deletePlatformSoftwareVersion(softwareId, versionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software', variables.softwareId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'software'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

// Status Mutations
export const useCreatePlatformStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MasterStatus>) => masterDataApi.createPlatformStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'statuses'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useUpdatePlatformStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MasterStatus> }) =>
      masterDataApi.updatePlatformStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'statuses'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useArchivePlatformStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.archivePlatformStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'statuses'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useRestorePlatformStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.restorePlatformStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'statuses'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useDeletePlatformStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'statuses'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

// Task Type Mutations
export const useCreatePlatformTaskType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MasterTaskType>) => masterDataApi.createPlatformTaskType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'task-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useUpdatePlatformTaskType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MasterTaskType> }) =>
      masterDataApi.updatePlatformTaskType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'task-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useArchivePlatformTaskType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.archivePlatformTaskType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'task-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useRestorePlatformTaskType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.restorePlatformTaskType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'task-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useDeletePlatformTaskType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformTaskType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'task-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

// Asset Type Mutations
export const useCreatePlatformAssetType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MasterAssetType>) => masterDataApi.createPlatformAssetType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'asset-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useUpdatePlatformAssetType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MasterAssetType> }) =>
      masterDataApi.updatePlatformAssetType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'asset-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useArchivePlatformAssetType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.archivePlatformAssetType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'asset-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useRestorePlatformAssetType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.restorePlatformAssetType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'asset-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useDeletePlatformAssetType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformAssetType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'asset-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

// Shot Type Mutations
export const useCreatePlatformShotType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MasterShotType>) => masterDataApi.createPlatformShotType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'shot-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useUpdatePlatformShotType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MasterShotType> }) =>
      masterDataApi.updatePlatformShotType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'shot-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useArchivePlatformShotType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.archivePlatformShotType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'shot-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useRestorePlatformShotType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.restorePlatformShotType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'shot-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useDeletePlatformShotType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformShotType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'shot-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

// Review Type Mutations
export const useCreatePlatformReviewType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MasterReviewType>) => masterDataApi.createPlatformReviewType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'review-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useUpdatePlatformReviewType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MasterReviewType> }) =>
      masterDataApi.updatePlatformReviewType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'review-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useArchivePlatformReviewType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.archivePlatformReviewType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'review-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useRestorePlatformReviewType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.restorePlatformReviewType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'review-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useDeletePlatformReviewType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformReviewType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'review-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

// File Type Mutations
export const useCreatePlatformFileType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MasterFileType>) => masterDataApi.createPlatformFileType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'file-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useUpdatePlatformFileType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MasterFileType> }) =>
      masterDataApi.updatePlatformFileType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'file-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useArchivePlatformFileType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.archivePlatformFileType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'file-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useRestorePlatformFileType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.restorePlatformFileType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'file-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

export const useDeletePlatformFileType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformFileType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'file-types'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'master-data', 'overview'] });
    },
  });
};

// ==========================================
// 3. PLATFORM ROLES, GROUPS, DEPARTMENTS, POSITIONS HOOKS
// ==========================================

// Roles
export const usePlatformRoles = () => {
  return useQuery({
    queryKey: ['platform', 'roles'],
    queryFn: () => masterDataApi.getPlatformRoles(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreatePlatformRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => masterDataApi.createPlatformRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] });
    },
  });
};

export const useUpdatePlatformRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => masterDataApi.updatePlatformRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] });
    },
  });
};

export const useDeletePlatformRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] });
    },
  });
};

// Groups
export const usePlatformGroups = () => {
  return useQuery({
    queryKey: ['platform', 'groups'],
    queryFn: () => masterDataApi.getPlatformGroups(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreatePlatformGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => masterDataApi.createPlatformGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'groups'] });
    },
  });
};

export const useUpdatePlatformGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => masterDataApi.updatePlatformGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'groups'] });
    },
  });
};

export const useDeletePlatformGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'groups'] });
    },
  });
};

// Departments
export const usePlatformDepartments = () => {
  return useQuery({
    queryKey: ['platform', 'departments'],
    queryFn: () => masterDataApi.getPlatformDepartments(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreatePlatformDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => masterDataApi.createPlatformDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
};

export const useUpdatePlatformDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => masterDataApi.updatePlatformDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
};

export const useDeletePlatformDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
};

// Positions
export const usePlatformPositions = () => {
  return useQuery({
    queryKey: ['platform', 'positions'],
    queryFn: () => masterDataApi.getPlatformPositions(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreatePlatformPosition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => masterDataApi.createPlatformPosition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });
};

export const useUpdatePlatformPosition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => masterDataApi.updatePlatformPosition(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });
};

export const useDeletePlatformPosition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterDataApi.deletePlatformPosition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });
};

// ==========================================
// 5. MOCK → BACKEND SEED (roles, groups, departments, positions)
// ==========================================

export interface PlatformOrgSeedSyncCounts {
  created: number;
  skipped: number;
}

export interface SeedPlatformOrgStructureResult {
  roles: PlatformOrgSeedSyncCounts;
  groups: PlatformOrgSeedSyncCounts;
  departments: PlatformOrgSeedSyncCounts;
  positions: PlatformOrgSeedSyncCounts;
}

/**
 * Push canonical platform structure records into the backend (REST mode).
 * Idempotent: records whose `code` already exists are skipped, so re-running
 * is safe. In mock mode this writes into the MSW mock DB instead.
 */
export const useSeedPlatformOrgStructure = () => {
  const queryClient = useQueryClient();
  return useMutation<SeedPlatformOrgStructureResult, Error, void>({
    mutationFn: async (): Promise<SeedPlatformOrgStructureResult> => {
      // REST-only: canonical platform structure seed ships via backend.
      // Former dynamic import('@/mocks/db/platformOrgSeed') removed with mock engine.
      const seeds = { roles: [], groups: [], departments: [], positions: [] } as unknown as {
        roles: { code: string }[];
        groups: { code: string }[];
        departments: { code: string }[];
        positions: { code: string }[];
      };
      const selectMissingSeeds = <T,>(existing: unknown[], records: T[], _key: (s: T) => string): T[] => {
        void existing;
        void _key;
        return [];
      };

      interface CodedSeed {
        code: string;
      }
      const syncEntity = async (
        records: CodedSeed[],
        list: () => Promise<unknown>,
        create: (data: CodedSeed) => Promise<unknown>,
      ): Promise<PlatformOrgSeedSyncCounts> => {
        const existing = (await list()) as Array<{
          code?: string;
          name?: string;
          title?: string;
        }>;
        const missing = selectMissingSeeds(
          Array.isArray(existing) ? existing : [],
          records,
          (s) => s.code,
        );
        for (const record of missing) {
          await create(record);
        }
        return { created: missing.length, skipped: records.length - missing.length };
      };

      const roles = await syncEntity(
        seeds.roles,
        () => masterDataApi.getPlatformRoles(),
        (d) => masterDataApi.createPlatformRole(d),
      );
      const groups = await syncEntity(
        seeds.groups,
        () => masterDataApi.getPlatformGroups(),
        (d) => masterDataApi.createPlatformGroup(d),
      );
      const departments = await syncEntity(
        seeds.departments,
        () => masterDataApi.getPlatformDepartments(),
        (d) => masterDataApi.createPlatformDepartment(d),
      );
      const positions = await syncEntity(
        seeds.positions,
        () => masterDataApi.getPlatformPositions(),
        (d) => masterDataApi.createPlatformPosition(d),
      );
      return { roles, groups, departments, positions };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'groups'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });
};

