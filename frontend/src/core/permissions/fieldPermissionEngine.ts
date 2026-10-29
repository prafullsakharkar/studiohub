import { User } from '@/types/identity';
import { PermissionEvaluationContext } from '@/types/identity';
import { evaluateUserPermission, isBreakGlass } from './rbac';

export interface SensitiveFieldDefinition {
  entityType: string;
  field: string;
  viewPermission: string;
  editPermission: string;
  description: string;
  maskedPlaceholder?: string | number | null;
}

export const SENSITIVE_FIELDS_REGISTRY: Record<string, SensitiveFieldDefinition[]> = {
  project: [
    {
      entityType: 'project',
      field: 'budget',
      viewPermission: 'field.project.budget.view',
      editPermission: 'field.project.budget.edit',
      description: 'Project financial budget allocation and expenditures',
      maskedPlaceholder: '[RESTRICTED_BUDGET]',
    },
    {
      entityType: 'project',
      field: 'billing',
      viewPermission: 'field.project.billing.view',
      editPermission: 'field.project.billing.edit',
      description: 'Client billing milestones, rates, and invoicing terms',
      maskedPlaceholder: '[RESTRICTED_BILLING]',
    },
  ],
  task: [
    {
      entityType: 'task',
      field: 'cost',
      viewPermission: 'field.task.cost.view',
      editPermission: 'field.task.cost.edit',
      description: 'Internal craft labor cost and hourly burn rate',
      maskedPlaceholder: null,
    },
    {
      entityType: 'task',
      field: 'internal_rate',
      viewPermission: 'field.task.cost.view',
      editPermission: 'field.task.cost.edit',
      description: 'Departmental billing rate for task allocation',
      maskedPlaceholder: null,
    },
  ],
  people: [
    {
      entityType: 'people',
      field: 'compensation',
      viewPermission: 'field.people.compensation.view',
      editPermission: 'field.people.compensation.view',
      description: 'Artist and staff employee payroll compensation',
      maskedPlaceholder: '[CONFIDENTIAL]',
    },
    {
      entityType: 'people',
      field: 'salary',
      viewPermission: 'field.people.compensation.view',
      editPermission: 'field.people.compensation.view',
      description: 'Annual salary figures',
      maskedPlaceholder: '[CONFIDENTIAL]',
    },
    {
      entityType: 'people',
      field: 'day_rate',
      viewPermission: 'field.people.compensation.view',
      editPermission: 'field.people.compensation.view',
      description: 'Freelance day rate',
      maskedPlaceholder: null,
    },
  ],
  artist: [
    {
      entityType: 'artist',
      field: 'rate',
      viewPermission: 'field.artist.rate.view',
      editPermission: 'field.artist.rate.view',
      description: 'Artist billing rate per hour or day',
      maskedPlaceholder: null,
    },
  ],
  vendor: [
    {
      entityType: 'vendor',
      field: 'rate',
      viewPermission: 'field.vendor.rate.view',
      editPermission: 'field.vendor.rate.view',
      description: 'Vendor outsourcing contract rate card',
      maskedPlaceholder: '[RESTRICTED_RATE]',
    },
    {
      entityType: 'vendor',
      field: 'contract_amount',
      viewPermission: 'field.vendor.rate.view',
      editPermission: 'field.vendor.rate.view',
      description: 'Vendor master services agreement amount',
      maskedPlaceholder: null,
    },
  ],
  client: [
    {
      entityType: 'client',
      field: 'contract_value',
      viewPermission: 'field.client.contract_value.view',
      editPermission: 'field.client.contract_value.view',
      description: 'Total client commercial production agreement value',
      maskedPlaceholder: '[CONFIDENTIAL]',
    },
  ],
};

/**
 * Checks if a user is permitted to view or edit a specific field on an entity
 */
export function canAccessField(
  user: User | null,
  entityType: string,
  field: string,
  action: 'view' | 'edit' = 'view',
  context?: PermissionEvaluationContext
): boolean {
  if (!user) return false;

  // Platform break-glass override (strict superuser-only)
  if (isBreakGlass(user)) {
    return true;
  }

  const entityKey = entityType.toLowerCase();
  const sensitiveDefs = SENSITIVE_FIELDS_REGISTRY[entityKey];
  const fieldDef = sensitiveDefs?.find((f) => f.field.toLowerCase() === field.toLowerCase());

  // If the field is not in the sensitive registry, access is granted if the user can view/update the entity
  if (!fieldDef) {
    const baseAction = action === 'edit' ? `${entityKey}.update` : `${entityKey}.view`;
    return evaluateUserPermission(user, baseAction, context);
  }

  // Executive roles automatically have access to financial and operational fields
  const executiveRoles = [
    'Executive Producer',
    'Producer',
    'Production Finance',
    'Finance Manager',
  ];
  if (user.role && executiveRoles.includes(user.role)) {
    return true;
  }

  const requiredCode = action === 'edit' ? fieldDef.editPermission : fieldDef.viewPermission;

  // Direct check
  if (evaluateUserPermission(user, requiredCode, context)) {
    return true;
  }

  // Wildcard checks: field.* or field.<entity>.*
  if (
    evaluateUserPermission(user, 'field.*', context) ||
    evaluateUserPermission(user, `field.${entityKey}.*`, context)
  ) {
    return true;
  }

  return false;
}

/**
 * Clones the input entity and masks or nullifies sensitive fields if the user lacks view authorization
 */
export function maskSensitiveFields<T extends Record<string, any>>(
  user: User | null,
  entityType: string,
  entity: T,
  context?: PermissionEvaluationContext
): T {
  if (!entity || typeof entity !== 'object') return entity;

  const entityKey = entityType.toLowerCase();
  const sensitiveDefs = SENSITIVE_FIELDS_REGISTRY[entityKey] || [];
  if (sensitiveDefs.length === 0) return entity;

  const copy = { ...entity };

  for (const def of sensitiveDefs) {
    if (def.field in copy) {
      const allowed = canAccessField(user, entityKey, def.field, 'view', context);
      if (!allowed) {
        copy[def.field as keyof T] = (def.maskedPlaceholder !== undefined
          ? def.maskedPlaceholder
          : '[RESTRICTED]') as any;
      }
    }
  }

  return copy;
}

/**
 * Applies field masking to an array of entities
 */
export function filterEntitiesFields<T extends Record<string, any>>(
  user: User | null,
  entityType: string,
  entities: T[],
  context?: PermissionEvaluationContext
): T[] {
  return entities.map((item) => maskSensitiveFields(user, entityType, item, context));
}
