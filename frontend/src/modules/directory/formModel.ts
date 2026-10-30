import { z } from 'zod';
import type { FieldDef } from './types';

export type Values = Record<string, string | boolean>;

const pad = (n: number) => String(n).padStart(2, '0');

/** A moment from the API (UTC, `Z`) as the browser's local `datetime-local` text; '' when it is not a date. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The local `datetime-local` text as a UTC instant with a zone, which is what the scheduling API demands (a naive date-time is a 400). */
export function fromLocalInput(text: string): string {
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? text : d.toISOString();
}

export const blank = (field: FieldDef): string | boolean => field.initial ?? (field.kind === 'checkbox' ? false : '');

/** Whether a field takes part in the form right now (see `visibleWhen`). */
export const isVisible = (field: FieldDef, values: Values): boolean => !field.visibleWhen || field.visibleWhen(values);

/** Why `text` is not a JSON array/object (or undefined when it is one). */
function jsonProblem(shape: 'array' | 'object', text: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 'is not valid JSON.';
  }
  const ok = shape === 'array' ? Array.isArray(parsed) : parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
  return ok ? undefined : `must be a JSON ${shape === 'array' ? 'array' : 'object'}.`;
}

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
      } else if (field.kind === 'json' && value !== '') {
        const problem = jsonProblem(field.shape, value);
        if (problem) ctx.addIssue({ code: 'custom', path: [field.name], message: `${field.label} ${problem}` });
      } else if (field.kind === 'number' && field.positive && value !== '' && !(Number(value) > 0)) {
        ctx.addIssue({ code: 'custom', path: [field.name], message: `${field.label} must be greater than zero.` });
      }
    }
  });
}

/** What goes on the wire for a field the user touched: '' clears numbers, dates and links with null, text with ''. */
export function wireValue(field: FieldDef, value: string | boolean): unknown {
  if (field.kind === 'checkbox') return value;
  if (field.kind === 'json') return value === '' ? (field.shape === 'array' ? [] : {}) : JSON.parse(String(value));
  if (value === '') return field.kind === 'number' || field.kind === 'date' || field.kind === 'datetime' || field.kind === 'entity' ? null : '';
  if (field.kind === 'datetime') return fromLocalInput(String(value));
  return field.kind === 'number' ? Number(value) : value;
}

export const fromRow = (fields: ReadonlyArray<FieldDef>, row: Record<string, unknown>): Values =>
  Object.fromEntries(
    fields.map((f) => {
      const value = row[f.rowKey ?? f.name];
      if (f.kind === 'json') return [f.name, value === null || value === undefined ? '' : JSON.stringify(value, null, 2)];
      if (f.kind === 'datetime') return [f.name, typeof value === 'string' ? toLocalInput(value) : ''];
      return [f.name, f.kind === 'checkbox' ? Boolean(value) : value === null || value === undefined ? '' : String(value)];
    })
  );

