import { Save } from 'lucide-react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/Button';

export interface FormActionsProps {
  /** `dialog`: ghost Cancel + primary submit. `page`: outlined small Cancel + primary submit with a save icon, above a rule. */
  layout: 'dialog' | 'page';
  submitLabel: string;
  isSubmitting: boolean;
  submitVariant?: 'primary' | 'danger';
  submitDisabled?: boolean;
  /** Cancel runs this (dialog) ... */
  onCancel?: () => void;
  /** ... or links here (page). */
  cancelTo?: string;
  cancelLabel?: string;
}

/**
 * The footer of every create/edit form: Cancel on the left of the primary action, right-aligned.
 * Cancel is disabled while a save is running, as is the submit button (`isLoading`).
 */
export const FormActions: React.FC<FormActionsProps> = ({ layout, submitLabel, isSubmitting, submitVariant = 'primary', submitDisabled, onCancel, cancelTo, cancelLabel = 'Cancel' }) => {
  if (layout === 'page') {
    const cancel = (
      <Button variant="outline" size="sm" type="button" disabled={isSubmitting} onClick={cancelTo ? undefined : onCancel}>
        {cancelLabel}
      </Button>
    );
    return (
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
        {cancelTo ? <Link to={cancelTo}>{cancel}</Link> : cancel}
        <Button variant={submitVariant} size="sm" type="submit" isLoading={isSubmitting} disabled={submitDisabled} leftIcon={<Save className="w-4 h-4" />}>
          {submitLabel}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="submit" variant={submitVariant} isLoading={isSubmitting} disabled={submitDisabled}>
        {submitLabel}
      </Button>
    </div>
  );
};
