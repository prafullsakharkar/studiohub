import React from 'react';
import { Plus, Trash2, Split, Check, X, Filter } from 'lucide-react';
import {
  FilterGroup,
  FilterCondition,
  FilterOperator,
  FieldDefinition,
} from '@/types/crud';
import { isFilterGroup } from './filterEvaluator';
import { Button } from '@/shared/components/Button';
import { AsyncEntitySelector } from '@/shared/relationships/AsyncEntitySelector';

interface FilterBuilderProps {
  fields: FieldDefinition[];
  value: FilterGroup;
  onChange: (value: FilterGroup) => void;
  onApply?: () => void;
  onReset?: () => void;
  className?: string;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'is equal to (=)',
  notEquals: 'is not equal to (≠)',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  endsWith: 'ends with',
  greaterThan: 'is greater than (>)',
  lessThan: 'is less than (<)',
  greaterThanOrEqual: 'is at least (≥)',
  lessThanOrEqual: 'is at most (≤)',
  before: 'is before (<)',
  after: 'is after (>)',
  in: 'is in list',
  notIn: 'is not in list',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

const OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  text: ['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
  number: ['equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'isEmpty', 'isNotEmpty'],
  select: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  status: ['equals', 'notEquals', 'in', 'notIn'],
  priority: ['equals', 'notEquals', 'in', 'notIn'],
  date: ['equals', 'before', 'after', 'isEmpty', 'isNotEmpty'],
  reference: ['equals', 'notEquals', 'in', 'isEmpty', 'isNotEmpty'],
  boolean: ['equals', 'notEquals'],
};

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  fields,
  value,
  onChange,
  onApply,
  onReset,
  className = '',
}) => {
  // Helper to generate unique IDs
  const createId = () => `f-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Default first condition if empty
  const defaultField = fields[0]?.key || '';

  const handleAddCondition = (groupId: string) => {
    const newCondition: FilterCondition = {
      id: createId(),
      field: defaultField,
      operator: 'equals',
      value: '',
    };

    const updateGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: [...group.conditions, newCondition],
        };
      }
      return {
        ...group,
        conditions: group.conditions.map((item) =>
          isFilterGroup(item) ? updateGroup(item) : item
        ),
      };
    };

    onChange(updateGroup(value));
  };

  const handleAddNestedGroup = (parentGroupId: string) => {
    const newNestedGroup: FilterGroup = {
      id: createId(),
      logicalOperator: 'AND',
      conditions: [
        {
          id: createId(),
          field: defaultField,
          operator: 'equals',
          value: '',
        },
      ],
    };

    const updateGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === parentGroupId) {
        return {
          ...group,
          conditions: [...group.conditions, newNestedGroup],
        };
      }
      return {
        ...group,
        conditions: group.conditions.map((item) =>
          isFilterGroup(item) ? updateGroup(item) : item
        ),
      };
    };

    onChange(updateGroup(value));
  };

  const handleToggleLogical = (groupId: string) => {
    const updateGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          logicalOperator: group.logicalOperator === 'AND' ? 'OR' : 'AND',
        };
      }
      return {
        ...group,
        conditions: group.conditions.map((item) =>
          isFilterGroup(item) ? updateGroup(item) : item
        ),
      };
    };

    onChange(updateGroup(value));
  };

  const handleUpdateCondition = (conditionId: string, updates: Partial<FilterCondition>) => {
    const updateGroup = (group: FilterGroup): FilterGroup => {
      return {
        ...group,
        conditions: group.conditions.map((item) => {
          if (isFilterGroup(item)) {
            return updateGroup(item);
          }
          if (item.id === conditionId) {
            return { ...item, ...updates };
          }
          return item;
        }),
      };
    };

    onChange(updateGroup(value));
  };

  const handleDeleteItem = (itemId: string) => {
    const updateGroup = (group: FilterGroup): FilterGroup => {
      return {
        ...group,
        conditions: group.conditions
          .filter((item) => item.id !== itemId)
          .map((item) => (isFilterGroup(item) ? updateGroup(item) : item)),
      };
    };

    onChange(updateGroup(value));
  };

  // Render a condition item
  const renderCondition = (condition: FilterCondition) => {
    const fieldDef = fields.find((f) => f.key === condition.field) || fields[0];
    const allowedOperators = OPERATORS_BY_TYPE[fieldDef?.type || 'text'] || OPERATORS_BY_TYPE.text;

    return (
      <div
        key={condition.id}
        className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
      >
        {/* Field Selector */}
        <select
          value={condition.field}
          onChange={(e) => {
            const nextKey = e.target.value;
            const nextField = fields.find((f) => f.key === nextKey);
            const ops = OPERATORS_BY_TYPE[nextField?.type || 'text'] || OPERATORS_BY_TYPE.text;
            handleUpdateCondition(condition.id, {
              field: nextKey,
              operator: ops[0] || 'equals',
              value: '',
            });
          }}
          className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
        >
          {fields.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Operator Selector */}
        <select
          value={condition.operator}
          onChange={(e) =>
            handleUpdateCondition(condition.id, {
              operator: e.target.value as FilterOperator,
            })
          }
          className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
        >
          {allowedOperators.map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op] || op}
            </option>
          ))}
        </select>

        {/* Value Input depending on field type and operator */}
        {condition.operator !== 'isEmpty' && condition.operator !== 'isNotEmpty' && (
          <div className="flex-1 min-w-[140px]">
            {fieldDef?.type === 'status' || fieldDef?.type === 'select' || fieldDef?.type === 'priority' ? (
              fieldDef.options && fieldDef.options.length > 0 ? (
                <select
                  value={condition.value}
                  onChange={(e) => handleUpdateCondition(condition.id, { value: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select option...</option>
                  {fieldDef.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => handleUpdateCondition(condition.id, { value: e.target.value })}
                  placeholder="Type value..."
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              )
            ) : fieldDef?.type === 'reference' && fieldDef.referenceType ? (
              <AsyncEntitySelector
                entityType={fieldDef.referenceType}
                value={condition.value}
                onChange={(val) => handleUpdateCondition(condition.id, { value: val })}
                placeholder={`Select ${fieldDef.label}...`}
              />
            ) : fieldDef?.type === 'date' ? (
              <input
                type="date"
                value={condition.value}
                onChange={(e) => handleUpdateCondition(condition.id, { value: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            ) : fieldDef?.type === 'number' ? (
              <input
                type="number"
                value={condition.value}
                onChange={(e) => handleUpdateCondition(condition.id, { value: e.target.value })}
                placeholder="Number value..."
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            ) : (
              <input
                type="text"
                value={condition.value}
                onChange={(e) => handleUpdateCondition(condition.id, { value: e.target.value })}
                placeholder="Type value (e.g. Netflix, Film A, Canada)..."
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>
        )}

        {/* Delete Button */}
        <button
          type="button"
          onClick={() => handleDeleteItem(condition.id)}
          className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Remove condition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  // Render a group recursively
  const renderGroup = (group: FilterGroup, isRoot = false) => {
    return (
      <div
        key={group.id}
        className={`space-y-3 rounded-xl ${
          isRoot
            ? 'p-4 bg-slate-950/60 border border-slate-800'
            : 'p-3 bg-slate-900/40 border border-indigo-500/20 ml-4 pl-4 border-l-2 border-l-indigo-500'
        }`}
      >
        {/* Group Header Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleLogical(group.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono transition-all ${
                group.logicalOperator === 'AND'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-amber-600 text-white shadow-sm'
              }`}
            >
              Match {group.logicalOperator} of:
            </button>
            <span className="text-[11px] text-slate-400">
              {group.logicalOperator === 'AND'
                ? 'All conditions in this group must match'
                : 'At least one condition in this group must match'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleAddCondition(group.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Add Condition</span>
            </button>

            {isRoot && (
              <button
                type="button"
                onClick={() => handleAddNestedGroup(group.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
              >
                <Split className="w-3.5 h-3.5 text-amber-400" />
                <span>Add Nested Group</span>
              </button>
            )}

            {!isRoot && (
              <button
                type="button"
                onClick={() => handleDeleteItem(group.id)}
                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Remove group"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Group Conditions / Nested Groups */}
        <div className="space-y-2">
          {group.conditions.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-500 italic">
              No filter conditions. Click "Add Condition" above.
            </div>
          ) : (
            group.conditions.map((item) =>
              isFilterGroup(item) ? renderGroup(item, false) : renderCondition(item)
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {renderGroup(value, true)}

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <div className="text-xs text-slate-400">
          Tip: Filter by Status, Client, Department, Country, Due Date, or Projects with nested logic.
        </div>
        <div className="flex items-center gap-2">
          {onReset && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onReset}
              className="text-xs py-1.5 px-3"
            >
              Reset Filters
            </Button>
          )}
          {onApply && (
            <Button
              variant="primary"
              size="sm"
              onClick={onApply}
              className="gap-1.5 text-xs py-1.5 px-4"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Filters</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
