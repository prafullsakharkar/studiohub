import { z } from 'zod';
import type { FieldDef } from './types';

export type Values = Record<string, string | boolean>;

export const blank = (field: FieldDef): string | boolean => field.initial ?? (field.kind === 'checkbox' ? false : '');

/** Whether a field takes part in the form right now (see `visibleWhen`). */
export const isVisible = (field: FieldDef, values: Values): boolean => !field.visibleWhen || field.visibleWhen(values);

export function buildSchema(fields: ReadonlyArray<FieldDef>) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) shape[field.name] = field.kind === 'checkbox' ? z.boolean() : z.string();
  // Rules that depend on what is visible are checked together, so a hidden field is never required.
  return z.object(shape).superRefine((values, ctx) => {
    for (const field of fields) {
      if (field.kind === 'checkbox' || !isVisible(field, values as Values)) continue;
      const value = String(values[field.name] ?? '').trim();
      if (field.required && value === '') {
        ctx.addIssue({ code: 'custom', path: [field.name], message: field.kind === 'entity' || field.kind === 'select' ? `Choose a ${field.label.toLowerCase()}.` : `Enter ${field.label.toLowerCase()}.` });
      } else if (field.kind === 'number' && field.positive && value !== '' && !(Number(value) > 0)) {
        ctx.addIssue({ code: 'custom', path: [field.name], message: `${field.label} must be greater than zero.` });
      }
    }
  });
}

/** What goes on the wire for a field the user touched: '' clears numbers, dates and links with null, text with ''. */
export function wireValue(field: FieldDef, value: string | boolean): unknown {
  if (field.kind === 'checkbox') return value;
  if (value === '') return field.kind === 'number' || field.kind === 'date' || field.kind === 'entity' ? null : '';
  return field.kind === 'number' ? Number(value) : value;
}

export const fromRow = (fields: ReadonlyArray<FieldDef>, row: Record<string, unknown>): Values =>
  Object.fromEntries(
    fields.map((f) => {
      const value = row[f.rowKey ?? f.name];
      return [f.name, f.kind === 'checkbox' ? Boolean(value) : value === null || value === undefined ? '' : String(value)];
    })
  );

