import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { z } from 'zod';
import { auditKeys } from '@/api/audit/audit';
import { tasksApi, timelogsApi } from '@/api/production/work';
import { Dialog } from '@/components/ui/Dialog';
import { notify } from '@/core/notifications/notify';
import { Field, FormBanner, inputClass } from '@/modules/identity/components/ui';
import { Button } from '@/shared/components/Button';
import { useServerForm } from '@/shared/forms/useServerForm';
import { todayIso } from './format';

// CR-14: the server accepts negative hours on an ordinary entry; the form never sends them.
const schema = z.object({
  duration_hours: z.string().refine((v) => Number(v) > 0, 'Hours must be greater than zero.'),
  date: z.string().min(1, 'Choose a date.'),
  notes: z.string(),
  billable: z.boolean(),
});
type Values = z.infer<typeof schema>;

export interface LogTimeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  task: { id: string; code: string; title: string };
  /** Pre-filled hours, e.g. from the stopwatch. */
  hours?: number;
  notes?: string;
  billable?: boolean;
  onSaved?: () => void;
}

/** Log time on one task. The entry starts Submitted; a lead approves or rejects it from Time logs. */
export const LogTimeDialog: React.FC<LogTimeDialogProps> = ({ isOpen, onClose, task, hours = 1, notes = '', billable = true, onSaved }) => {
  const queryClient = useQueryClient();
  const {
    register,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<Values>({ resolver: zodResolver(schema), defaultValues: { duration_hours: String(hours), date: todayIso(), notes, billable } });

  const close = () => {
    reset();
    clearServerError();
    onClose();
  };

  const onSubmit = submit(async (values) => {
    await timelogsApi.create({ task_id: task.id, duration_hours: values.duration_hours, date: values.date, notes: values.notes, billable: values.billable });
    await Promise.all([timelogsApi.keys.all, tasksApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    notify.success(`Logged ${values.duration_hours}h on ${task.code}.`);
    reset();
    onSaved?.();
    onClose();
  });

  return (
    <Dialog isOpen={isOpen} onClose={close} title={`Log time on ${task.code}`} size="md">
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-xs text-slate-400">{task.title}</p>
        <FormBanner error={serverError} />
        <Field id="log-hours" label="Hours *" error={errors.duration_hours?.message}>
          <input id="log-hours" type="number" step="0.25" className={inputClass(Boolean(errors.duration_hours))} {...register('duration_hours', { onChange: clearServerError })} />
        </Field>
        <Field id="log-date" label="Date *" error={errors.date?.message}>
          <input id="log-date" type="date" className={inputClass(Boolean(errors.date))} {...register('date', { onChange: clearServerError })} />
        </Field>
        <Field id="log-notes" label="Notes" error={errors.notes?.message}>
          <textarea id="log-notes" rows={3} className={inputClass(Boolean(errors.notes))} {...register('notes')} />
        </Field>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" {...register('billable')} /> Billable
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Log time
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
