import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { auditKeys } from '@/api/audit/audit';
import { projectsApi } from '@/api/production/structure';
import type { Project, ProjectInput } from '@/api/production/structure';
import { notify } from '@/core/notifications/notify';
import { Field, inputClass } from '@/modules/identity/components/ui';
import { FormDialog } from '@/shared/forms/FormDialog';
import { useServerForm } from '@/shared/forms/useServerForm';

const schema = z.object({ name: z.string().trim().min(1, 'Enter a name'), code: z.string().trim().min(1, 'Enter a code') });
type Values = z.infer<typeof schema>;

/**
 * A new project with this one's settings. Its shots, assets, members and files are not copied.
 * Mounted only while open, so it starts from the suggested name and code every time.
 */
export const CloneProjectDialog: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting, isDirty },
  } = useServerForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: `${project.name} (Copy)`, code: `${project.code}_CLONE` } });

  const onSubmit = submit(async (values) => {
    const settings: ProjectInput = {
      code: values.code,
      name: values.name,
      type: project.type,
      workflow_type: project.workflow_type,
      description: project.description,
      fps: Number(project.fps),
      resolution: project.resolution,
      aspect_ratio: project.aspect_ratio,
      color_space: project.color_space,
      ...(project.client_id ? { client_id: project.client_id } : {}),
    };
    const cloned = await projectsApi.create(settings);
    await Promise.all([queryClient.invalidateQueries({ queryKey: projectsApi.keys.all }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
    notify.success(`${cloned.name} was created from ${project.code}.`);
    onClose();
    navigate(`/projects/${cloned.id}`);
  });

  return (
    <FormDialog
      title="Duplicate project"
      subtitle={`Create a project with the settings of ${project.code}`}
      onClose={onClose}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      isDirty={isDirty}
      serverError={serverError}
      submitLabel="Duplicate project"
    >
      <Field id="clone-name" label="New project name *" error={errors.name?.message}>
        <input id="clone-name" className={inputClass(Boolean(errors.name))} {...register('name', { onChange: clearServerError })} />
      </Field>
      <Field id="clone-code" label="New project code *" error={errors.code?.message}>
        <input id="clone-code" className={`${inputClass(Boolean(errors.code))} font-mono uppercase`} {...register('code', { onChange: clearServerError, setValueAs: (v) => String(v ?? '').toUpperCase() })} />
      </Field>
      <p className="text-[11px] text-slate-400">The new project gets this one's type, workflow, color space, resolution, frame rate and client. Its shots, assets, members and files are not copied.</p>
    </FormDialog>
  );
};
