import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { projectsApi } from '@/api/production/structure';
import { TEMPLATE_ENTITY_TYPES, taskTemplatesApi } from '@/api/production/work';
import type { TaskTemplate } from '@/api/production/work';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import type { DirectoryListConfig } from '@/modules/directory/types';
import { Field, FormBanner, inputClass } from '@/modules/identity/components/ui';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { listFetcher } from '@/shared/data/listing';
import { useServerForm } from '@/shared/forms/useServerForm';
import { ProjectPicker } from './pickers';

const taskTypes = listFetcher<{ id: string; code: string; name: string }>('/api/v1/platform/master-data/task-types');

export function useTemplatesListConfig(): DirectoryListConfig<TaskTemplate> {
  return {
    title: 'Task templates',
    noun: 'template',
    subtitle: 'The usual set of tasks for a shot or an asset. Studio templates are shared by every project; a project can keep its own.',
    queryKey: taskTemplatesApi.keys.lists(),
    fetchPage: taskTemplatesApi.list,
    // DELETE archives a template.
    remove: taskTemplatesApi.remove,
    deleteLabel: 'Archive',
    deletePermission: 'tasktemplate.delete',
    createPermission: 'tasktemplate.create',
    managePermission: 'tasktemplate.update',
    rowName: (row) => row.name,
    defaultOrdering: 'name',
    searchPlaceholder: 'Search templates',
    basePath: '/task-templates',
    rowLink: (row) => `/task-templates/${row.id}/edit`,
    filters: [
      { key: 'entity_type', label: 'For', options: TEMPLATE_ENTITY_TYPES.map((value) => ({ value, label: value })) },
      { key: 'studio', label: 'Scope', options: [{ value: 'true', label: 'Studio' }, { value: 'false', label: 'Project' }] },
      { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } },
    ],
    columns: [
      { header: 'Template', cell: (row) => row.name },
      { header: 'For', cell: (row) => row.entity_type },
      { header: 'Scope', cell: (row) => (row.scope === 'studio' ? 'Studio' : `Project ${row.project_code}`) },
      { header: 'Tasks', cell: (row) => row.items.map((i) => i.name).join(', ') || '—' },
      { header: 'State', cell: (row) => (row.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>) },
    ],
  };
}

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name.'),
  description: z.string(),
  entity_type: z.enum(TEMPLATE_ENTITY_TYPES),
  project_id: z.string(),
  is_active: z.boolean(),
  items: z.array(z.object({ task_type_id: z.string().min(1, 'Choose a task type.'), name: z.string().trim().min(1, 'Enter a name.'), default_bid_hours: z.string() })),
});
type Values = z.infer<typeof schema>;

/** A studio template copied into one project, so the project can change its copy without touching the shared one. */
const CopyToProject: React.FC<{ template: TaskTemplate; onCopied: (copy: TaskTemplate) => void }> = ({ template, onCopied }) => {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-lg border border-slate-800 p-3 space-y-2">
      <h2 className="text-xs font-semibold text-slate-200">Make a project copy</h2>
      <ProjectPicker label="Project" value={projectId} onChange={setProjectId} />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!projectId}
        isLoading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const copy = await taskTemplatesApi.copyToProject(template.id, { project_id: projectId as string });
            await queryClient.invalidateQueries({ queryKey: taskTemplatesApi.keys.all });
            notify.success(`Copied to ${copy.project_code}.`);
            onCopied(copy);
          } catch (error) {
            notify.error(serverMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        Copy to project
      </Button>
    </section>
  );
};

/** Create or edit a template: its details and the list of tasks it creates. */
export const TaskTemplateForm: React.FC = () => {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const row = useQuery({ queryKey: taskTemplatesApi.keys.detail(id ?? ''), queryFn: ({ signal }) => taskTemplatesApi.get(id as string, signal), enabled: editing });
  const canCreate = useCan('tasktemplate.create');
  const types = useQuery({ queryKey: ['catalog', 'task-types', 'all'], queryFn: ({ signal }) => taskTypes({ page_size: 500 }, signal), staleTime: 60_000 });
  const {
    register,
    control,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', description: '', entity_type: 'Shot', project_id: '', is_active: true, items: [] } });
  const items = useFieldArray({ control, name: 'items' });

  const filledFor = useRef<string | null>(null);
  useEffect(() => {
    if (row.data && filledFor.current !== row.data.id) {
      filledFor.current = row.data.id;
      reset({ name: row.data.name, description: row.data.description, entity_type: row.data.entity_type as Values['entity_type'], project_id: row.data.project_id ?? '', is_active: row.data.is_active, items: row.data.items.map((i) => ({ task_type_id: i.task_type_id, name: i.name, default_bid_hours: String(i.default_bid_hours) })) });
    }
  }, [row.data, reset]);

  const onSubmit = submit(async (values) => {
    const payload = {
      name: values.name,
      description: values.description,
      entity_type: values.entity_type,
      is_active: values.is_active,
      ...(values.project_id && !editing ? { project_id: values.project_id } : {}),
      items: values.items.map((item, index) => ({ task_type_id: item.task_type_id, name: item.name, order: index + 1, ...(item.default_bid_hours !== '' ? { default_bid_hours: item.default_bid_hours } : {}) })),
    };
    if (editing) await taskTemplatesApi.update(id as string, payload);
    else await taskTemplatesApi.create(payload);
    await Promise.all([queryClient.invalidateQueries({ queryKey: taskTemplatesApi.keys.all }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
    notify.success(`Template ${editing ? 'saved' : 'created'}.`);
    navigate('/task-templates', { replace: true });
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 flex-1 min-h-0 w-full max-w-2xl">
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">{editing ? 'Edit template' : 'New template'}</h1>
      </div>
      <QueryBoundary isLoading={editing && row.isLoading} error={editing ? row.error : null} onRetry={() => void row.refetch()} entityName="template">
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <FormBanner error={serverError} />
          <Field id="tpl-name" label="Name *" error={errors.name?.message}>
            <input id="tpl-name" className={inputClass(Boolean(errors.name))} {...register('name', { onChange: clearServerError })} />
          </Field>
          <Field id="tpl-for" label="For *" error={errors.entity_type?.message}>
            <select id="tpl-for" className={inputClass(Boolean(errors.entity_type))} {...register('entity_type')}>
              {TEMPLATE_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          {!editing && (
            <Controller
              control={control}
              name="project_id"
              render={({ field }) => (
                <div className="space-y-1">
                  <ProjectPicker label="Project (leave empty for a studio template)" value={field.value || null} onChange={(projectId) => { clearServerError(); field.onChange(projectId ?? ''); }} />
                  <p className="text-[11px] text-slate-500">A studio template is shared by every project and needs the studio-template permission.</p>
                </div>
              )}
            />
          )}
          <Field id="tpl-desc" label="Description" error={errors.description?.message}>
            <textarea id="tpl-desc" rows={2} className={inputClass(false)} {...register('description')} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" {...register('is_active')} /> Active
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-mono text-slate-400">Tasks this template creates</legend>
            {items.fields.map((field, index) => (
              <div key={field.id} className="space-y-1">
              <div className="grid grid-cols-[1fr_1fr_6rem_auto] gap-2 items-start">
                <select aria-label={`Task type ${index + 1}`} className={inputClass(Boolean(errors.items?.[index]?.task_type_id))} {...register(`items.${index}.task_type_id`, { onChange: clearServerError })}>
                  <option value="">Task type…</option>
                  {(types.data?.results ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input aria-label={`Task name ${index + 1}`} placeholder="Task name" className={inputClass(Boolean(errors.items?.[index]?.name))} {...register(`items.${index}.name`, { onChange: clearServerError })} />
                <input aria-label={`Bid hours ${index + 1}`} type="number" min={0} step="0.5" placeholder="Hours" className={inputClass(false)} {...register(`items.${index}.default_bid_hours`)} />
                <button type="button" aria-label={`Remove task ${index + 1}`} className="p-2 text-rose-400 hover:text-rose-300" onClick={() => items.remove(index)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {(errors.items?.[index]?.task_type_id?.message || errors.items?.[index]?.name?.message) && (
                <p role="alert" className="text-[11px] text-rose-400">
                  {errors.items?.[index]?.task_type_id?.message ?? errors.items?.[index]?.name?.message}
                </p>
              )}
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => items.append({ task_type_id: '', name: '', default_bid_hours: '' })}>
              Add a task
            </Button>
          </fieldset>

          {editing && row.data?.scope === 'studio' && canCreate && <CopyToProject template={row.data} onCopied={(copy) => navigate(`/task-templates/${copy.id}/edit`)} />}

          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editing ? 'Save changes' : 'Create template'}
            </Button>
            <Link to="/task-templates">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </QueryBoundary>
    </div>
  );
};
