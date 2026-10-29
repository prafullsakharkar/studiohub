export interface MasterDataEntityDef {
  id: string;
  label: string;
  singular: string;
  searchPlaceholder: string;
  permissions: {
    view: string | string[];
    create: string | string[];
    update: string | string[];
    archive: string | string[];
    restore: string | string[];
    delete: string | string[];
  };
  columns: { key: 'name' | 'code' | 'status'; header: string }[];
}

export const masterDataEntities = {
  statuses: {
    id: 'statuses',
    label: 'Statuses',
    singular: 'Status',
    searchPlaceholder: 'Search statuses…',
    permissions: {
      view: ['platform.status.view', 'platform.master_data.view'],
      create: ['platform.status.create', 'platform.master_data.create'],
      update: ['platform.status.update', 'platform.master_data.update'],
      archive: ['platform.status.archive', 'platform.master_data.archive'],
      restore: ['platform.status.restore', 'platform.master_data.restore'],
      delete: ['platform.status.delete', 'platform.master_data.delete'],
    },
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'code', header: 'Code' },
      { key: 'status', header: 'Status' },
    ],
  },
  taskTypes: {
    id: 'taskTypes',
    label: 'Task Types',
    singular: 'Task Type',
    searchPlaceholder: 'Search task types…',
    permissions: {
      view: ['platform.task_type.view', 'platform.master_data.view'],
      create: ['platform.task_type.create', 'platform.master_data.create'],
      update: ['platform.task_type.update', 'platform.master_data.update'],
      archive: ['platform.task_type.archive', 'platform.master_data.archive'],
      restore: ['platform.task_type.restore', 'platform.master_data.restore'],
      delete: ['platform.task_type.delete', 'platform.master_data.delete'],
    },
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'code', header: 'Code' },
      { key: 'status', header: 'Status' },
    ],
  },
  reviewTypes: {
    id: 'reviewTypes',
    label: 'Review Types',
    singular: 'Review Type',
    searchPlaceholder: 'Search review types…',
    permissions: {
      view: ['platform.review_type.view', 'platform.master_data.view'],
      create: ['platform.review_type.create', 'platform.master_data.create'],
      update: ['platform.review_type.update', 'platform.master_data.update'],
      archive: ['platform.review_type.archive', 'platform.master_data.archive'],
      restore: ['platform.review_type.restore', 'platform.master_data.restore'],
      delete: ['platform.review_type.delete', 'platform.master_data.delete'],
    },
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'code', header: 'Code' },
      { key: 'status', header: 'Status' },
    ],
  },
  fileTypes: {
    id: 'fileTypes',
    label: 'File Types',
    singular: 'File Type',
    searchPlaceholder: 'Search file types…',
    permissions: {
      view: ['platform.file_type.view', 'platform.master_data.view'],
      create: ['platform.file_type.create', 'platform.master_data.create'],
      update: ['platform.file_type.update', 'platform.master_data.update'],
      archive: ['platform.file_type.archive', 'platform.master_data.archive'],
      restore: ['platform.file_type.restore', 'platform.master_data.restore'],
      delete: ['platform.file_type.delete', 'platform.master_data.delete'],
    },
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'code', header: 'Code' },
      { key: 'status', header: 'Status' },
    ],
  },
  assetTypes: {
    id: 'assetTypes',
    label: 'Asset Types',
    singular: 'Asset Type',
    searchPlaceholder: 'Search asset types…',
    permissions: {
      view: ['platform.asset_type.view', 'platform.master_data.view'],
      create: ['platform.asset_type.create', 'platform.master_data.create'],
      update: ['platform.asset_type.update', 'platform.master_data.update'],
      archive: ['platform.asset_type.archive', 'platform.master_data.archive'],
      restore: ['platform.asset_type.restore', 'platform.master_data.restore'],
      delete: ['platform.asset_type.delete', 'platform.master_data.delete'],
    },
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'code', header: 'Code' },
      { key: 'status', header: 'Status' },
    ],
  },
  shotTypes: {
    id: 'shotTypes',
    label: 'Shot Types',
    singular: 'Shot Type',
    searchPlaceholder: 'Search shot types…',
    permissions: {
      view: ['platform.shot_type.view', 'platform.master_data.view'],
      create: ['platform.shot_type.create', 'platform.master_data.create'],
      update: ['platform.shot_type.update', 'platform.master_data.update'],
      archive: ['platform.shot_type.archive', 'platform.master_data.archive'],
      restore: ['platform.shot_type.restore', 'platform.master_data.restore'],
      delete: ['platform.shot_type.delete', 'platform.master_data.delete'],
    },
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'code', header: 'Code' },
      { key: 'status', header: 'Status' },
    ],
  },
  software: {
    id: 'software',
    label: 'Software',
    singular: 'Software',
    searchPlaceholder: 'Search DCC software…',
    permissions: {
      view: ['platform.software.view', 'platform.master_data.view'],
      create: ['platform.software.create', 'platform.master_data.create'],
      update: ['platform.software.update', 'platform.master_data.update'],
      archive: ['platform.software.archive', 'platform.master_data.archive'],
      restore: ['platform.software.restore', 'platform.master_data.restore'],
      delete: ['platform.software.delete', 'platform.master_data.delete'],
    },
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'code', header: 'Code' },
      { key: 'status', header: 'Status' },
    ],
  },
} satisfies Record<string, MasterDataEntityDef>;
