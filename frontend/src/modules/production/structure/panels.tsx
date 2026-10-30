import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { z } from 'zod';
import { projectScopedApi } from '@/api/production/structure';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Field, FormBanner, Table, formatDate, inputClass } from '@/modules/identity/components/ui';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { useServerForm } from '@/shared/forms/useServerForm';

const key = (projectId: string, name: string) => ['production', 'scoped', projectId, name] as const;

/** A label for rows whose shape the API does not document (resources, milestones). */
const labelOf = (item: unknown): string => {
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    return String(o.name ?? o.title ?? o.email ?? o.id ?? JSON.stringify(o));
  }
  return String(item);
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section aria-label={title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
    <h3 className="text-sm font-bold text-white">{title}</h3>
    {children}
  </section>
);

// ---------------------------------------------------------------- overview
export const OverviewPanel: React.FC<{ projectId: string }> = ({ projectId }) => {
  const summary = useQuery({ queryKey: key(projectId, 'summary'), queryFn: ({ signal }) => projectScopedApi.summary(projectId, signal) });
  const counts = summary.data?.counts;
  return (
    <QueryBoundary isLoading={summary.isLoading} error={summary.error} onRetry={() => void summary.refetch()} entityName="project summary">
      {counts && (
        <dl aria-label="Project counts" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(counts).map(([name, value]) => (
            <div key={name} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">{name.replace(/_/g, ' ')}</dt>
              <dd className="text-xl font-bold text-white">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </QueryBoundary>
  );
};

// ---------------------------------------------------------------- members
const memberSchema = z.object({ email: z.string().trim().min(1, 'Enter an email address').email('Enter a valid email address'), role: z.string().trim().min(1, 'Enter a role') });

export const MembersPanel: React.FC<{ projectId: string }> = ({ projectId }) => {
  const queryClient = useQueryClient();
  const canAdd = useCan('project.update');
  const members = useQuery({ queryKey: key(projectId, 'members'), queryFn: ({ signal }) => projectScopedApi.members(projectId, signal) });
  const {
    register,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<z.infer<typeof memberSchema>>({ resolver: zodResolver(memberSchema), defaultValues: { email: '', role: 'Artist' } });

  const onAdd = submit(async (values) => {
    // 404 "User not found." (unknown e-mail) is shown by the form; 200 means they were already a member.
    await projectScopedApi.addMember(projectId, values);
    reset({ email: '', role: values.role });
    await queryClient.invalidateQueries({ queryKey: key(projectId, 'members') });
    notify.success(`${values.email} is on the project.`);
  });

  return (
    <div className="space-y-4">
      {canAdd && (
        <form noValidate onSubmit={onAdd} className="space-y-3">
          <FormBanner error={serverError} />
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <Field id="member-email" label="Add a member by email" error={errors.email?.message}>
                <input id="member-email" type="email" className={inputClass(Boolean(errors.email))} {...register('email', { onChange: clearServerError })} />
              </Field>
            </div>
            <div className="sm:w-48">
              <Field id="member-role" label="Role" error={errors.role?.message}>
                <input id="member-role" className={inputClass(Boolean(errors.role))} {...register('role')} />
              </Field>
            </div>
            <Button type="submit" size="sm" variant="primary" isLoading={isSubmitting}>
              Add member
            </Button>
          </div>
        </form>
      )}
      <QueryBoundary
        isLoading={members.isLoading}
        error={members.error}
        onRetry={() => void members.refetch()}
        entityName="members"
        isEmpty={(members.data?.results ?? []).length === 0}
        empty={{ title: 'No members yet', description: 'Only members can see the project.' }}
      >
        <Table label="Project members" columns={['Name', 'Email', 'Role', 'Status', 'Added']}>
          {(members.data?.results ?? []).map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-2 text-slate-200">{m.name}</td>
              <td className="px-4 py-2 text-slate-400">{m.email}</td>
              <td className="px-4 py-2 text-slate-300">{m.roles.join(', ') || m.role}</td>
              <td className="px-4 py-2">
                <Badge variant={m.status === 'active' ? 'success' : 'neutral'}>{m.status}</Badge>
              </td>
              <td className="px-4 py-2 text-slate-400">{formatDate(m.created_at)}</td>
            </tr>
          ))}
        </Table>
      </QueryBoundary>
    </div>
  );
};

// ---------------------------------------------------------------- notes
const noteSchema = z.object({ subject: z.string().trim().min(1, 'Enter a subject'), body: z.string().optional() });

export const NotesPanel: React.FC<{ projectId: string }> = ({ projectId }) => {
  const queryClient = useQueryClient();
  const notes = useQuery({ queryKey: key(projectId, 'notes'), queryFn: ({ signal }) => projectScopedApi.notes(projectId, signal) });
  const {
    register,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<z.infer<typeof noteSchema>>({ resolver: zodResolver(noteSchema), defaultValues: { subject: '', body: '' } });

  const onAdd = submit(async (values) => {
    await projectScopedApi.addNote(projectId, { subject: values.subject, ...(values.body ? { body: values.body } : {}) });
    reset();
    await queryClient.invalidateQueries({ queryKey: key(projectId, 'notes') });
  });

  return (
    <div className="space-y-4">
      <form noValidate onSubmit={onAdd} className="space-y-3 max-w-xl">
        <FormBanner error={serverError} />
        <Field id="note-subject" label="Subject" error={errors.subject?.message}>
          <input id="note-subject" className={inputClass(Boolean(errors.subject))} {...register('subject', { onChange: clearServerError })} />
        </Field>
        <Field id="note-body" label="Note">
          <textarea id="note-body" rows={3} className={inputClass()} {...register('body')} />
        </Field>
        <Button type="submit" size="sm" variant="primary" isLoading={isSubmitting}>
          Add note
        </Button>
      </form>
      <QueryBoundary
        isLoading={notes.isLoading}
        error={notes.error}
        onRetry={() => void notes.refetch()}
        entityName="notes"
        isEmpty={(notes.data?.results ?? []).length === 0}
        empty={{ title: 'No notes', description: 'Notes on the project appear here.' }}
      >
        <ul className="space-y-2">
          {(notes.data?.results ?? []).map((n) => (
            <li key={n.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-slate-200">{n.subject}</span>
                <time dateTime={n.created_at} className="font-mono text-[10px] text-slate-500">
                  {formatDate(n.created_at)}
                </time>
              </div>
              {n.body && <p className="mt-1 text-slate-400 whitespace-pre-wrap">{n.body}</p>}
              <p className="mt-1 text-[11px] text-slate-500">{n.author_name}</p>
            </li>
          ))}
        </ul>
      </QueryBoundary>
    </div>
  );
};

// ---------------------------------------------------------------- pipeline, resources, schedule
export const PipelinePanel: React.FC<{ projectId: string }> = ({ projectId }) => {
  const pipeline = useQuery({ queryKey: key(projectId, 'pipeline'), queryFn: ({ signal }) => projectScopedApi.pipeline(projectId, signal) });
  const p = pipeline.data;
  return (
    <QueryBoundary isLoading={pipeline.isLoading} error={pipeline.error} onRetry={() => void pipeline.refetch()} entityName="pipeline">
      {p && (
        <div className="space-y-4">
          <Card title="Image settings">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                ['Frame rate', `${p.fps} fps`],
                ['Resolution', p.resolution],
                ['Aspect ratio', p.aspect_ratio],
                ['Color space', p.color_space],
                ['OCIO config', p.ocio_config],
                ['USD schema', p.usd_schema_version],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="text-slate-500">{term}</dt>
                  <dd className="text-slate-200 font-mono break-all">{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="DCC integrations">
            {p.dcc_integrations.length === 0 ? (
              <p className="text-xs text-slate-500">None configured.</p>
            ) : (
              <Table label="DCC integrations" columns={['Application', 'Plugin', 'Version']}>
                {p.dcc_integrations.map((d) => (
                  <tr key={d.name}>
                    <td className="px-4 py-2 text-slate-200">{d.name}</td>
                    <td className="px-4 py-2 text-slate-400">{d.plugin}</td>
                    <td className="px-4 py-2 font-mono text-slate-300">{d.version}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <Card title="Pipeline steps">
            {p.pipeline_steps.length === 0 ? <p className="text-xs text-slate-500">No steps defined.</p> : <ol className="list-decimal list-inside text-xs text-slate-300">{p.pipeline_steps.map((s, i) => <li key={`${i}-${labelOf(s)}`}>{labelOf(s)}</li>)}</ol>}
          </Card>
        </div>
      )}
    </QueryBoundary>
  );
};

export const ResourcesPanel: React.FC<{ projectId: string }> = ({ projectId }) => {
  const resources = useQuery({ queryKey: key(projectId, 'resources'), queryFn: ({ signal }) => projectScopedApi.resources(projectId, signal) });
  const r = resources.data;
  return (
    <QueryBoundary isLoading={resources.isLoading} error={resources.error} onRetry={() => void resources.refetch()} entityName="resources">
      {r && (
        <div className="space-y-4">
          <Card title="Artists">
            <p className="text-xs text-slate-400">{r.total_artists} artist{r.total_artists === 1 ? '' : 's'} on this project.</p>
            {r.artists.length > 0 && <ul className="text-xs text-slate-300 space-y-1">{r.artists.map((a, i) => <li key={`${i}-${labelOf(a)}`}>{labelOf(a)}</li>)}</ul>}
          </Card>
          <Card title="Departments">
            {r.departments.length === 0 ? <p className="text-xs text-slate-500">No departments are assigned yet.</p> : <ul className="text-xs text-slate-300 space-y-1">{r.departments.map((d, i) => <li key={`${i}-${labelOf(d)}`}>{labelOf(d)}</li>)}</ul>}
          </Card>
        </div>
      )}
    </QueryBoundary>
  );
};

/** The project's dates and, unless `milestones` is false, the read-only list the production route returns. */
export const SchedulePanel: React.FC<{ projectId: string; milestones?: boolean }> = ({ projectId, milestones = true }) => {
  const schedule = useQuery({ queryKey: key(projectId, 'schedule'), queryFn: ({ signal }) => projectScopedApi.schedule(projectId, signal) });
  const s = schedule.data;
  return (
    <QueryBoundary isLoading={schedule.isLoading} error={schedule.error} onRetry={() => void schedule.refetch()} entityName="schedule">
      {s && (
        <div className="space-y-4">
          <Card title="Dates">
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">Start</dt>
                <dd className="text-slate-200">{s.start_date ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Delivery</dt>
                <dd className="text-slate-200">{s.delivery_date ?? '—'}</dd>
              </div>
            </dl>
          </Card>
          {milestones && <Card title="Milestones">
            {s.milestones.length === 0 ? <p className="text-xs text-slate-500">No milestones.</p> : <ul className="text-xs text-slate-300 space-y-1">{s.milestones.map((m, i) => <li key={`${i}-${labelOf(m)}`}>{labelOf(m)}</li>)}</ul>}
          </Card>}
        </div>
      )}
    </QueryBoundary>
  );
};
