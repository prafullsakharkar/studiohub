import { z } from 'zod';
import type { FieldDef } from './types';

export type Values = Record<string, string | boolean>;

export const blank = (field: FieldDef): string | boolean => (field.kind === 'checkbox' ? false : '');

export function buildSchema(fields: ReadonlyArray<FieldDef>) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    if (field.kind === 'checkbox') shape[field.name] = z.boolean();
    else if (field.required) shape[field.name] = z.string().trim().min(1, field.kind === 'entity' || field.kind === 'select' ? `Choose a ${field.label.toLowerCase()}.` : `Enter ${field.label.toLowerCase()}.`);
    else shape[field.name] = z.string();
  }
  return z.object(shape);
}

/** What goes on the wire for a field the user touched: '' clears numbers, dates and links with null, text with ''. */
export function wireValue(field: FieldDef, value: string | boolean): unknown {
  if (field.kind === 'checkbox') return value;
  if (value === '') return field.kind === 'number' || field.kind === 'date' || field.kind === 'entity' ? null : '';
  return field.kind === 'number' ? Number(value) : value;
}

export const fromRow = (fields: ReadonlyArray<FieldDef>, row: Record<string, unknown>): Values =>
  Object.fromEntries(fields.map((f) => [f.name, f.kind === 'checkbox' ? Boolean(row[f.name]) : row[f.name] === null || row[f.name] === undefined ? '' : String(row[f.name])]));

