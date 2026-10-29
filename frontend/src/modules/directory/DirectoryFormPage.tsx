import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { evaluateAccess } from '@/core/permissions/access';
import { AuthContext } from '@/core/auth/AuthContext';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Button } from '@/shared/components/Button';
import { FormBanner } from '@/modules/identity/components/ui';
import { FieldInputs } from './FieldInputs';
import { type Values, blank, buildSchema, fromRow, wireValue } from './formModel';
import type { DirectoryFormConfig, FieldDef } from './types';

/** One create/edit screen for every directory entity; field errors from a 400 land on the matching input. */
export function DirectoryFormPage<T extends { id: string }>({ config }: { config: DirectoryFormConfig<T> }): React.ReactElement {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useContext(AuthContext)?.user ?? null;
  // Fields behind a permission (sensitive person data, client financials) are rendered, validated and sent only for callers who hold it.
  const fields = useMemo(() => config.fields.filter((f) => !f.permission || evaluateAccess(user, f.permission, {})), [config.fields, user]);
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const row = useQuery({ queryKey: [...config.queryKey, 'detail', id], queryFn: ({ signal }) => config.get(id as string, signal), enabled: editing });

  const {
    register,
    control,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useServerForm<Values>({ resolver: zodResolver(schema) as never, defaultValues: Object.fromEntries(fields.map((f) => [f.name, blank(f)])) });

  // Fill the form ONCE per record. A background refetch (window focus, an invalidation after another
  // save) hands back a new object for the same record; resetting then would discard what the user is typing.
  const filledFor = useRef<string | null>(null);
  useEffect(() => {
    if (row.data && filledFor.current !== row.data.id) {
      filledFor.current = row.data.id;
      reset(fromRow(fields, row.data as unknown as Record<string, unknown>));
    }
  }, [row.data, fields, reset]);

  const onSubmit = submit(async (values) => {
    const touched = (field: FieldDef) => !editing || Boolean((dirtyFields as Record<string, unknown>)[field.name]);
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      if (!touched(field)) continue;
      if (!editing && values[field.name] === '' && field.kind !== 'checkbox') continue; // leave optional blanks to the server defaults
      if (editing && config.immutableOnEdit?.includes(field.name)) continue;
      payload[field.name] = wireValue(field, values[field.name]);
    }
    const saved = editing ? await config.update(id as string, payload) : await config.create(payload);
    await queryClient.invalidateQueries({ queryKey: config.queryKey });
    notify.success(`${config.noun[0].toUpperCase()}${config.noun.slice(1)} ${editing ? 'saved' : 'created'}.`);
    navigate(config.afterSavePath ? config.afterSavePath(saved) : `${config.basePath}/${saved.id}`, { replace: true });
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 flex-1 min-h-0 w-full max-w-2xl">
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">{editing ? `Edit ${config.noun}` : `New ${config.noun}`}</h1>
      </div>
      <QueryBoundary isLoading={editing && row.isLoading} error={editing ? row.error : null} onRetry={() => void row.refetch()} entityName={config.noun}>
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <FormBanner error={serverError} />
          <FieldInputs fields={fields} editing={editing} immutableOnEdit={config.immutableOnEdit} register={register} control={control} errors={errors} clearServerError={clearServerError} />
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
