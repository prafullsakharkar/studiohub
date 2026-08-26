import { FilterCondition, FilterGroup, FilterOperator, FieldDefinition } from '@/types/crud';

/**
 * Checks if a condition is a nested FilterGroup
 */
export function isFilterGroup(item: FilterCondition | FilterGroup): item is FilterGroup {
  return 'logicalOperator' in item && Array.isArray((item as FilterGroup).conditions);
}

/**
 * Evaluates a single filter condition against an entity item
 */
export function evaluateCondition(item: any, condition: FilterCondition): boolean {
  if (!item || !condition.field) return true;

  const rawValue = item[condition.field];
  const targetValue = condition.value;
  const op = condition.operator;

  // Handle empty / not empty checks
  if (op === 'isEmpty') {
    return rawValue === undefined || rawValue === null || rawValue === '' || (Array.isArray(rawValue) && rawValue.length === 0);
  }
  if (op === 'isNotEmpty') {
    return rawValue !== undefined && rawValue !== null && rawValue !== '' && (!Array.isArray(rawValue) || rawValue.length > 0);
  }

  // If targetValue is null or undefined and not empty check, ignore
  if (targetValue === undefined || targetValue === null || targetValue === '') {
    return true;
  }

  // String / Text comparisons
  if (typeof rawValue === 'string') {
    const val = rawValue.toLowerCase();
    const target = String(targetValue).toLowerCase();

    switch (op) {
      case 'equals':
        return val === target;
      case 'notEquals':
        return val !== target;
      case 'contains':
        return val.includes(target);
      case 'notContains':
        return !val.includes(target);
      case 'startsWith':
        return val.startsWith(target);
      case 'endsWith':
        return val.endsWith(target);
      case 'in':
        if (Array.isArray(targetValue)) {
          return targetValue.some((t) => String(t).toLowerCase() === val);
        }
        return val === target;
      case 'notIn':
        if (Array.isArray(targetValue)) {
          return !targetValue.some((t) => String(t).toLowerCase() === val);
        }
        return val !== target;
      case 'before':
      case 'lessThan':
        return val < target;
      case 'after':
      case 'greaterThan':
        return val > target;
      default:
        return true;
    }
  }

  // Number comparisons
  if (typeof rawValue === 'number') {
    const num = rawValue;
    const targetNum = Number(targetValue);

    switch (op) {
      case 'equals':
        return num === targetNum;
      case 'notEquals':
        return num !== targetNum;
      case 'greaterThan':
        return num > targetNum;
      case 'lessThan':
        return num < targetNum;
      case 'greaterThanOrEqual':
        return num >= targetNum;
      case 'lessThanOrEqual':
        return num <= targetNum;
      case 'in':
        return Array.isArray(targetValue) ? targetValue.map(Number).includes(num) : num === targetNum;
      default:
        return true;
    }
  }

  // Boolean comparisons
  if (typeof rawValue === 'boolean') {
    const boolTarget = targetValue === true || targetValue === 'true';
    if (op === 'equals') return rawValue === boolTarget;
    if (op === 'notEquals') return rawValue !== boolTarget;
    return true;
  }

  // Array / Multi-select comparisons (e.g. tags, skills, list of IDs)
  if (Array.isArray(rawValue)) {
    if (op === 'contains') {
      return rawValue.some((v) => String(v).toLowerCase().includes(String(targetValue).toLowerCase()));
    }
    if (op === 'in') {
      if (Array.isArray(targetValue)) {
        return rawValue.some((v) => targetValue.includes(v));
      }
      return rawValue.includes(targetValue);
    }
    return true;
  }

  // Fallback equality
  return rawValue === targetValue;
}

/**
 * Recursively evaluates a FilterGroup against an entity item
 */
export function evaluateFilterGroup(item: any, group: FilterGroup): boolean {
  if (!group || !group.conditions || group.conditions.length === 0) {
    return true;
  }

  const isAnd = group.logicalOperator === 'AND';

  for (const condition of group.conditions) {
    let result = false;
    if (isFilterGroup(condition)) {
      result = evaluateFilterGroup(item, condition);
    } else {
      result = evaluateCondition(item, condition);
    }

    if (isAnd && !result) {
      return false; // Short circuit AND
    }
    if (!isAnd && result) {
      return true; // Short circuit OR
    }
  }

  return isAnd;
}

/**
 * Applies search query and filter group to an array of items
 */
export function applyFiltersAndSearch<T>(
  items: T[],
  searchQuery: string,
  filterGroup?: FilterGroup,
  searchFields?: string[]
): T[] {
  let filtered = [...items];

  // 1. Text Search
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter((item: any) => {
      if (searchFields && searchFields.length > 0) {
        return searchFields.some((field) => {
          const val = item[field];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
        });
      }
      // Fallback: check all own string / number properties
      return Object.values(item).some((val) => {
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(q);
        }
        return false;
      });
    });
  }

  // 2. Filter Group
  if (filterGroup && filterGroup.conditions.length > 0) {
    filtered = filtered.filter((item) => evaluateFilterGroup(item, filterGroup));
  }

  return filtered;
}
