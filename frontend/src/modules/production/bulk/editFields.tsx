import type React from 'react';
import { InputError } from '@/api/errors/serverMessage';
import { formatNumber } from '@/core/locale/studioLocale';
import type { BulkAction } from '@/modules/directory/types';
import { columnsFor } from './specs';
import type { BulkColumn, BulkSpec } from './specs';

/**
 * "Edit fields" on the selected rows (CR-48): the fields ticked here get the same value on every row, through
 * `bulk-update` with `atomic`, so either every row changes or none does. Offered once the list is on one project, so the
 * episode field shows only for an episodic one. The chosen fields travel as the action's input, JSON-encoded.
 */
export function editFieldsAction(spec: BulkSpec, episodicProjects: ReadonlySet<string> = new Set()): BulkAction {
  return {
    label: 'Edit fields',
    available: (filters) => Boolean(filters.project_id),
    confirm: (n) => `Set the ticked fields on ${formatNumber(n)} ${n === 1 ? spec.noun : spec.plural}. Either all change or none does.`,
    input: {
      label: 'Fields to change',
      required: true,
      render: ({ value, onChange, filters }) => (
        <FieldsEditor
          columns={editableColumns(spec, episodicProjects.has(String(filters.project_id ?? '')))}
          value={value}
          onChange={onChange}
        />
      ),
    },
    run: async (ids, input) => {
      const changes = JSON.parse(input ?? '{}') as Record<string, unknown>;
      const result = await spec.routes.updateIds(ids, changes, { dry_run: false, atomic: true });
      if (!result.committed) {
        const first = result.errors[0];
        const reason = first ? `${first.field ? `${first.field}: ` : ''}${first.message}` : 'a row was refused';
        throw new InputError(`Nothing changed: ${formatNumber(result.failed)} of ${formatNumber(result.processed)} rows were refused (${reason}).`);
      }
      return `${formatNumber(result.successful)} ${result.successful === 1 ? spec.noun : spec.plural} updated.`;
    },
  };
}

export const editableColumns = (spec: BulkSpec, episodic: boolean): BulkColumn[] =>
  columnsFor(spec, { episodic, mode: 'update' }).filter((column) => column.key !== 'code');

/** One row per field: a tick to change it, and its new value. Emits `{key: value}` as JSON, or "" when nothing is ticked. */
const FieldsEditor: React.FC<{ columns: BulkColumn[]; value: string; onChange: (value: string) => void }> = ({ columns, value, onChange }) => {
  const changes = (value ? JSON.parse(value) : {}) as Record<string, unknown>;
  const set = (next: Record<string, unknown>) => onChange(Object.keys(next).length ? JSON.stringify(next) : '');
  const toggle = (key: string, on: boolean) => {
    const next = { ...changes };
    if (on) next[key] = '';
    else delete next[key];
    set(next);
  };
  const edit = (column: BulkColumn, raw: string) => {
    const number = column.type === 'number' && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw;
    set({ ...changes, [column.key]: number });
  };
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Fields to change</legend>
      {columns.map((column) => {
        const on = column.key in changes;
        const current = on ? String(changes[column.key] ?? '') : '';
        return (
          <div key={column.key} className="grid grid-cols-[auto_9rem_1fr] items-center gap-2">
            <input type="checkbox" aria-label={`Change ${column.label}`} checked={on} onChange={(e) => toggle(column.key, e.target.checked)} />
            <span className="text-xs text-slate-300">{column.label}</span>
            {column.options ? (
              <select aria-label={column.label} disabled={!on} value={current} onChange={(e) => edit(column, e.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
                <option value="">—</option>
                {column.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={column.label}
                disabled={!on}
                type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
                value={current}
                onChange={(e) => edit(column, e.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
            )}
          </div>
        );
      })}
    </fieldset>
  );
};
