import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { Controller } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Button } from '@/shared/components/Button';
import { Field, FormBanner, inputClass } from '@/modules/identity/components/ui';
import type { DirectoryFormConfig, FieldDef } from './types';

type Values = Record<string, string | boolean>;

const blank = (field: FieldDef): string | boolean => (field.kind === 'checkbox' ? false : '');

function buildSchema(fields: ReadonlyArray<FieldDef>) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    if (field.kind === 'checkbox') shape[field.name] = z.boolean();
    else if (field.required) shape[field.name] = z.string().trim().min(1, field.kind === 'entity' || field.kind === 'select' ? `Choose a ${field.label.toLowerCase()}.` : `Enter ${field.label.toLowerCase()}.`);
    else shape[field.name] = z.string();
  }
  return z.object(shape);
}

/** What goes on the wire for a field the user touched: '' clears numbers, dates and links with null, text with ''. */
function wireValue(field: FieldDef, value: string | boolean): unknown {
  if (field.kind === 'checkbox') return value;
  if (value === '') return field.kind === 'number' || field.kind === 'date' || field.kind === 'entity' ? null : '';
  return field.kind === 'number' ? Number(value) : value;
}

const fromRow = (fields: ReadonlyArray<FieldDef>, row: Record<string, unknown>): Values =>
  Object.fromEntries(fields.map((f) => [f.name, f.kind === 'checkbox' ? Boolean(row[f.name]) : row[f.name] === null || row[f.name] === undefined ? '' : String(row[f.name])]));

/** One create/edit screen for every directory entity; field errors from a 400 land on the matching input. */
export function DirectoryFormPage<T extends { id: string }>({ config }: { config: DirectoryFormConfig<T> }): React.ReactElement {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const schema = useMemo(() => buildSchema(config.fields), [config.fields]);
  const row = useQuery({ queryKey: [...config.queryKey, 'detail', id], queryFn: ({ signal }) => config.get(id as string, signal), enabled: editing });

  const {
    register,
    control,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useServerForm<Values>({ resolver: zodResolver(schema) as never, defaultValues: Object.fromEntries(config.fields.map((f) => [f.name, blank(f)])) });

  useEffect(() => {
    if (row.data) reset(fromRow(config.fields, row.data as unknown as Record<string, unknown>));
  }, [row.data, config.fields, reset]);

  const onSubmit = submit(async (values) => {
    const touched = (field: FieldDef) => !editing || Boolean((dirtyFields as Record<string, unknown>)[field.name]);
    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      if (!touched(field)) continue;
      if (!editing && values[field.name] === '' && field.kind !== 'checkbox') continue; // leave optional blanks to the server defaults
      if (editing && config.immutableOnEdit?.includes(field.name)) continue;
      payload[field.name] = wireValue(field, values[field.name]);
    }
    const saved = editing ? await config.update(id as string, payload) : await config.create(payload);
    await queryClient.invalidateQueries({ queryKey: config.queryKey });
    notify.success(`${config.noun[0].toUpperCase()}${config.noun.slice(1)} ${editing ? 'saved' : 'created'}.`);
    navigate(`${config.basePath}/${saved.id}`, { replace: true });
  });

  const err = (name: string) => (errors[name]?.message as string | undefined) ?? undefined;

  return (
    <div className="p-4 sm:p-6 space-y-5 flex-1 min-h-0 w-full max-w-2xl">
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">{editing ? `Edit ${config.noun}` : `New ${config.noun}`}</h1>
      </div>
      <QueryBoundary isLoading={editing && row.isLoading} error={editing ? row.error : null} onRetry={() => void row.refetch()} entityName={config.noun}>
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <FormBanner error={serverError} />
          {config.fields.map((field) => {
            const readOnly = editing && config.immutableOnEdit?.includes(field.name);
            const id = `f-${field.name}`;
            if (field.kind === 'checkbox') {
              return (
                <label key={field.name} className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" {...register(field.name)} /> {field.label}
                </label>
              );
            }
            if (field.kind === 'entity') {
              return (
                <Controller
                  key={field.name}
                  control={control}
                  name={field.name}
                  render={({ field: f }) => <>{field.render({ value: String(f.value ?? ''), onChange: (v) => { clearServerError(); f.onChange(v); }, error: err(field.name) })}</>}
                />
              );
            }
            return (
              <Field key={field.name} id={id} label={`${field.label}${field.required ? ' *' : ''}`} error={err(field.name)} hint={readOnly ? 'Cannot be changed after creation.' : field.kind !== 'select' ? field.hint : undefined}>
                {field.kind === 'textarea' ? (
                  <textarea id={id} rows={3} disabled={readOnly} className={inputClass(Boolean(err(field.name)))} {...register(field.name, { onChange: clearServerError })} />
                ) : field.kind === 'select' ? (
                  <select id={id} disabled={readOnly} className={inputClass(Boolean(err(field.name)))} {...register(field.name, { onChange: clearServerError })}>
                    <option value="">{field.required ? 'Choose…' : '—'}</option>
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input id={id} type={field.kind === 'text' ? 'text' : field.kind} disabled={readOnly} maxLength={field.maxLength} className={inputClass(Boolean(err(field.name)))} {...register(field.name, { onChange: clearServerError })} />
                )}
              </Field>
            );
          })}
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editing ? 'Save changes' : `Create ${config.noun}`}
            </Button>
            <Link to={config.basePath}>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </QueryBoundary>
    </div>
  );
}
