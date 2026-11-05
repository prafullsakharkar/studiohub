import type React from 'react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { FormActions } from './FormActions';
import { FormBanner } from './FormParts';
import type { ServerFormError } from './serverErrors';

/** The wording every create/edit dialog uses (`New task type` / `Edit task type`, `Create task type` / `Save changes`). */
export function formDialogCopy(noun: string, editing: boolean) {
  const capital = `${noun[0].toUpperCase()}${noun.slice(1)}`;
  return {
    title: editing ? `Edit ${noun}` : `New ${noun}`,
    submitLabel: editing ? 'Save changes' : `Create ${noun}`,
    saved: `${capital} ${editing ? 'saved' : 'created'}.`,
  };
}

export interface FormDialogProps {
  title: string;
  subtitle?: string;
  /** Form dialogs are `lg`; a dialog with one or two fields may be `sm` or `md`. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Leave the dialog. Called by Cancel, the X, Escape and the backdrop once the guard lets them through, and the
   * caller's own submit handler calls it after a save.
   */
  onClose: () => void;
  /** The `submit(...)` of `useServerForm` (or any form submit handler). */
  onSubmit: (event?: React.BaseSyntheticEvent) => void | Promise<void>;
  isSubmitting: boolean;
  /** True when the user has typed something: closing then asks to discard. */
  isDirty: boolean;
  serverError?: ServerFormError | null;
  submitLabel: string;
  submitVariant?: 'primary' | 'danger';
  submitDisabled?: boolean;
  /** Text above the error banner (what the dialog is about). */
  intro?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The shell of a create/edit dialog, from the Catalog's `RowDialog`: `Dialog` > `<form noValidate>` with the error
 * banner, the fields and the Cancel / submit footer. Mount it only while it is open so every open starts from a fresh form.
 *
 * On top of the Catalog's behaviour: closing is ignored while a save is running, closing a form with typed-in changes
 * asks "Discard changes?", and focus starts on the first field.
 */
export const FormDialog: React.FC<FormDialogProps> = ({ title, subtitle, size = 'lg', onClose, onSubmit, isSubmitting, isDirty, serverError = null, submitLabel, submitVariant, submitDisabled, intro, children }) => {
  const [asking, setAsking] = useState(false);

  const requestClose = () => {
    if (isSubmitting) return;
    if (isDirty) setAsking(true);
    else onClose();
  };

  return (
    <>
      <Dialog isOpen onClose={requestClose} title={title} subtitle={subtitle} size={size}>
        <form noValidate data-autofocus onSubmit={onSubmit} className="space-y-4">
          {intro}
          <FormBanner error={serverError} />
          {children}
          <FormActions layout="dialog" submitLabel={submitLabel} isSubmitting={isSubmitting} submitVariant={submitVariant} submitDisabled={submitDisabled} onCancel={requestClose} />
        </form>
      </Dialog>
      <ConfirmDialog
        isOpen={asking}
        title="Discard changes?"
        message="What you typed in this form will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={onClose}
        onClose={() => setAsking(false)}
      />
    </>
  );
};
