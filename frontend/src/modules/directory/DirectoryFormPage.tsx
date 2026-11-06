import { auditKeys } from '@/api/audit/audit';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { evaluateAccess } from '@/core/permissions/access';
import { AuthContext } from '@/core/auth/AuthContext';
import { notify } from '@/core/notifications/notify';
import { useProjectCode } from '@/modules/production/hooks/useProjectCode';
import { withProjectPrefix } from '@/modules/production/codePrefix';
import { FormPage } from '@/shared/forms/FormPage';
import { formDialogCopy } from '@/shared/forms/FormDialog';
import { useServerForm } from '@/shared/forms/useServerForm';
import { FieldInputs } from './FieldInputs';
import { type Values, blank, buildSchema, fromRow, isVisible, wireValue } from './formModel';
import type { DirectoryFormConfig, FieldDef } from './types';

/** One create/edit screen for every directory entity; field errors from a 400 land on the matching input. */
export function DirectoryFormPage<T extends { id: string }>({ config }: { config: DirectoryFormConfig<T> }): React.ReactElement {
  const { id } = useParams();
  const editing = Boolean(id);
  const copy = formDialogCopy(config.noun, editing);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  // Fields behind a permission (sensitive person data, client financials) are rendered, validated and sent only for callers who hold it.
  const fields = useMemo(() => config.fields.filter((f) => !f.permission || evaluateAccess(user, f.permission, {})), [config.fields, user]);
  const schema = useMemo(() => buildSchema(fields, editing), [fields, editing]);
  const row = useQuery({ queryKey: [...config.queryKey, 'detail', id], queryFn: ({ signal }) => config.get(id as string, signal), enabled: editing });

  const {
    register,
    control,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useServerForm<Values>({ resolver: zodResolver(schema) as never, defaultValues: Object.fromEntries(fields.map((f) => [f.name, !editing && searchParams.get(f.name) !== null ? (searchParams.get(f.name) as string) : blank(f)])) });
  // A field with `projectPrefix` (the code of a sequence, shot, asset, task) starts with the chosen project's code.
  const prefixed = !editing && fields.some((f) => f.kind === 'text' && f.projectPrefix);
  const chosenProject = String(useWatch({ control, name: 'project' }) ?? '');
  const { projectCode, code: codeOfChosenProject } = useProjectCode(chosenProject, prefixed);
  // A new record can be pre-filled from the address (`/tasks/new?project=…&entity_type=Shot`): a parameter named like a field fills it.

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
    const held: Values = editing && row.data ? fromRow(fields, row.data as unknown as Record<string, unknown>) : {};
    for (const field of fields) {
      if (editing && field.clearWhenHidden && !isVisible(field, values) && held[field.name]) {
        payload[field.name] = wireValue(field, '');
        continue;
      }
      if (!touched(field) && !(!editing && searchParams.get(field.name) !== null)) continue;
      if (!isVisible(field, values)) continue;
      if (!editing && values[field.name] === '' && field.kind !== 'checkbox') continue; // leave optional blanks to the server defaults
      if (editing && config.immutableOnEdit?.includes(field.name)) continue;
      const wire = wireValue(field, values[field.name]);
      payload[field.name] = !editing && field.kind === 'text' && field.projectPrefix ? withProjectPrefix(await codeOfChosenProject(), wire) : wire;
    }
    const saved = editing ? await config.update(id as string, payload) : await config.create(payload);
    // The server made the caller a member of what they just created; /auth/me must say so before the detail route checks it.
    if (!editing && config.refreshSessionOnCreate) {
      try {
        await auth?.refreshUser();
      } catch {
        // The record is saved; a failed reload must not turn that into an error. The next /auth/me catches up.
      }
    }
    await Promise.all([queryClient.invalidateQueries({ queryKey: config.queryKey }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]); // a write adds a history entry
    notify.success(copy.saved);
    // An update may answer without the id (a project's PATCH does): after an edit the record is the one opened.
    navigate(config.afterSavePath ? config.afterSavePath(saved) : `${config.basePath}/${editing ? id : saved.id}`, { replace: true });
  });

  return (
    <FormPage
      title={copy.title}
      description={editing ? `Change the details of this ${config.noun}.` : `Fill in the details to create a ${config.noun}.`}
      editing={editing}
      backTo={config.basePath}
      backLabel={config.listTitle}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      isDirty={isDirty}
      serverError={serverError}
      submitLabel={copy.submitLabel}
      loading={{ isLoading: editing && row.isLoading, error: editing ? row.error : null, onRetry: () => void row.refetch(), entityName: config.noun }}
    >
      <FieldInputs grid projectCode={projectCode} fields={fields} editing={editing} immutableOnEdit={config.immutableOnEdit} register={register} control={control} errors={errors} clearServerError={clearServerError} />
    </FormPage>
  );
}
