import type React from 'react';
import { useCallback } from 'react';
import { Plus, Trash2, Filter, RotateCcw, Check, Layers } from 'lucide-react';
import type {
  FieldDefinition,
  FilterCondition,
  FilterGroup,
  FilterOperator,
} from '@/types/common';
import { isFilterGroup } from './filterEvaluator';
import { Button } from '@/shared/components/Button';

export interface FilterBuilderProps {
  fields: FieldDefinition[];
  value: FilterGroup;
  onChange: (group: FilterGroup) => void;
  onApply?: () => void;
  onReset?: () => void;
  className?: string;
}

const DEFAULT_TEXT_OPERATORS: { label: string; value: FilterOperator }[] = [
  { label: 'contains', value: 'contains' },
  { label: 'does not contain', value: 'notContains' },
  { label: 'equals', value: 'equals' },
  { label: 'not equals', value: 'notEquals' },
  { label: 'starts with', value: 'startsWith' },
  { label: 'ends with', value: 'endsWith' },
  { label: 'is empty', value: 'isEmpty' },
  { label: 'is not empty', value: 'isNotEmpty' },
];

const NUMBER_OPERATORS: { label: string; value: FilterOperator }[] = [
  { label: '=', value: 'equals' },
  { label: '≠', value: 'notEquals' },
  { label: '>', value: 'greaterThan' },
  { label: '<', value: 'lessThan' },
  { label: '≥', value: 'greaterThanOrEqual' },
  { label: '≤', value: 'lessThanOrEqual' },
  { label: 'is empty', value: 'isEmpty' },
  { label: 'is not empty', value: 'isNotEmpty' },
];

const DATE_OPERATORS: { label: string; value: FilterOperator }[] = [
  { label: 'is on', value: 'equals' },
  { label: 'is before', value: 'before' },
  { label: 'is after', value: 'after' },
  { label: 'is empty', value: 'isEmpty' },
  { label: 'is not empty', value: 'isNotEmpty' },
];

const SELECT_OPERATORS: { label: string; value: FilterOperator }[] = [
  { label: 'is', value: 'equals' },
  { label: 'is not', value: 'notEquals' },
  { label: 'is empty', value: 'isEmpty' },
  { label: 'is not empty', value: 'isNotEmpty' },
];

function getOperatorsForField(field?: FieldDefinition): { label: string; value: FilterOperator }[] {
  if (!field) return DEFAULT_TEXT_OPERATORS;
  if (field.options && field.options.length > 0) return SELECT_OPERATORS;
  if (field.type === 'number') return NUMBER_OPERATORS;
  if (field.type === 'date') return DATE_OPERATORS;
  if (field.type === 'boolean') return [{ label: 'is', value: 'equals' }];
  return DEFAULT_TEXT_OPERATORS;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  fields,
  value,
  onChange,
  onApply,
  onReset,
  className = '',
}) => {
  const filterableFields = fields.filter((f) => f.filterable !== false);
  const defaultFieldKey = filterableFields[0]?.key || 'name';

  const handleLogicalOperatorChange = (op: 'AND' | 'OR') => {
    onChange({
      ...value,
      logicalOperator: op,
    });
  };

  const handleAddCondition = () => {
    const defaultField = filterableFields[0];
    const initialOp = getOperatorsForField(defaultField)[0]?.value || 'contains';
    const newCondition: FilterCondition = {
      id: `cond-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      field: defaultFieldKey,
      operator: initialOp,
      value: '',
    };

    onChange({
      ...value,
      conditions: [...value.conditions, newCondition],
    });
  };

  const handleAddGroup = () => {
    const newGroup: FilterGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      logicalOperator: 'AND',
      conditions: [
        {
          id: `cond-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          field: defaultFieldKey,
          operator: 'contains',
          value: '',
        },
      ],
    };

    onChange({
      ...value,
      conditions: [...value.conditions, newGroup],
    });
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...value.conditions];
    updated.splice(index, 1);
    onChange({
      ...value,
      conditions: updated,
    });
  };

  const handleConditionChange = (index: number, updatedCondition: FilterCondition) => {
    const updated = [...value.conditions];
    updated[index] = updatedCondition;
    onChange({
      ...value,
      conditions: updated,
    });
  };

  const handleSubGroupChange = (index: number, updatedGroup: FilterGroup) => {
    const updated = [...value.conditions];
    updated[index] = updatedGroup;
    onChange({
      ...value,
      conditions: updated,
    });
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onChange({
        id: value.id || 'root',
        logicalOperator: 'AND',
        conditions: [],
      });
    }
  };

  return (
    <div id="filter-builder-root" className={`space-y-4 text-slate-200 ${className}`}>
      {/* Header controls: match criteria and add condition buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Match
          </span>
          <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
            <button
              id="filter-builder-match-all"
              type="button"
              onClick={() => handleLogicalOperatorChange('AND')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                value.logicalOperator === 'AND'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ALL (AND)
            </button>
            <button
              id="filter-builder-match-any"
              type="button"
              onClick={() => handleLogicalOperatorChange('OR')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                value.logicalOperator === 'OR'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ANY (OR)
            </button>
          </div>
          <span className="text-xs text-slate-400">of the following conditions:</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="filter-builder-add-condition-btn"
            type="button"
            onClick={handleAddCondition}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add Condition</span>
          </button>
          <button
            id="filter-builder-add-group-btn"
            type="button"
            onClick={handleAddGroup}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Add Subgroup</span>
          </button>
        </div>
      </div>

      {/* Conditions list */}
      <div className="space-y-2.5 min-h-[120px] max-h-[420px] overflow-y-auto pr-1">
        {value.conditions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40">
            <Filter className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-300">No active filter conditions</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Add conditions above to filter records by specific fields, status, dates, or numeric thresholds.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCondition}
              className="mt-3 text-xs"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add First Condition
            </Button>
          </div>
        ) : (
          value.conditions.map((item, idx) => {
            const itemKey = item.id || `filter-item-${idx}`;

            if (isFilterGroup(item)) {
              return (
                <div
                  key={itemKey}
                  className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                      Nested Group ({item.logicalOperator})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded-md transition-colors"
                      title="Remove subgroup"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <FilterBuilder
                    fields={fields}
                    value={item}
                    onChange={(updatedGroup) => handleSubGroupChange(idx, updatedGroup)}
                  />
                </div>
              );
            }

            return (
              <ConditionRow
                key={itemKey}
                condition={item}
                fields={filterableFields}
                onChange={(updatedCond) => handleConditionChange(idx, updatedCond)}
                onRemove={() => handleRemoveItem(idx)}
              />
            );
          })
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <button
          id="filter-builder-reset-btn"
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All</span>
        </button>

        {onApply && (
          <Button
            id="filter-builder-apply-btn"
            variant="primary"
            size="sm"
            onClick={onApply}
            leftIcon={<Check className="w-4 h-4" />}
          >
            Apply Filters
          </Button>
        )}
      </div>
    </div>
  );
};

interface ConditionRowProps {
  condition: FilterCondition;
  fields: FieldDefinition[];
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
}

const ConditionRow: React.FC<ConditionRowProps> = ({
  condition,
  fields,
  onChange,
  onRemove,
}) => {
  const currentField = fields.find((f) => f.key === condition.field) || fields[0];
  const operators = getOperatorsForField(currentField);
  const isValueDisabled = condition.operator === 'isEmpty' || condition.operator === 'isNotEmpty';

  const handleFieldSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFieldKey = e.target.value;
    const newField = fields.find((f) => f.key === newFieldKey);
    const newOps = getOperatorsForField(newField);
    onChange({
      ...condition,
      field: newFieldKey,
      operator: newOps[0]?.value || 'contains',
      value: '',
    });
  };

  const handleOperatorSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...condition,
      operator: e.target.value as FilterOperator,
    });
  };

  const handleValueChange = (newVal: any) => {
    onChange({
      ...condition,
      value: newVal,
    });
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors">
      {/* Field Selector */}
      <select
        value={condition.field}
        onChange={handleFieldSelect}
        className="w-40 shrink-0 bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500 font-medium"
      >
        {fields.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label || f.key}
          </option>
        ))}
      </select>

      {/* Operator Selector */}
      <select
        value={condition.operator}
        onChange={handleOperatorSelect}
        className="w-36 shrink-0 bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-cyan-500"
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value Input */}
      <div className="flex-1 min-w-[120px]">
        {isValueDisabled ? (
          <div className="px-2.5 py-1.5 text-xs text-slate-500 italic bg-slate-900/40 rounded-md border border-slate-800/50">
            (no value required)
          </div>
        ) : currentField?.options && currentField.options.length > 0 ? (
          <select
            value={condition.value ?? ''}
            onChange={(e) => handleValueChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500"
          >
            <option value="">Select option...</option>
            {currentField.options.map((opt) => (
              <option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : currentField?.type === 'boolean' ? (
          <select
            value={condition.value === true || condition.value === 'true' ? 'true' : 'false'}
            onChange={(e) => handleValueChange(e.target.value === 'true')}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500"
          >
            <option value="true">True (Yes)</option>
            <option value="false">False (No)</option>
          </select>
        ) : currentField?.type === 'date' ? (
          <input
            type="date"
            value={condition.value ?? ''}
            onChange={(e) => handleValueChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500"
          />
        ) : currentField?.type === 'number' ? (
          <input
            type="number"
            value={condition.value ?? ''}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Enter number..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
          />
        ) : (
          <input
            type="text"
            value={condition.value ?? ''}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Enter filter value..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
          />
        )}
      </div>

      {/* Remove Condition Button */}
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-md transition-colors shrink-0"
        title="Remove condition"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
