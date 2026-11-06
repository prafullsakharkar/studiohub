import { ChevronLeft, Pencil, Plus } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';
import { FormActions } from './FormActions';
import { FormBanner } from './FormParts';
import type { ServerFormError } from './serverErrors';

export interface FormPageProps {
  /** `New client` / `Edit client`. */
  title: string;
  description?: string;
  /** Shown in front of the title; defaults to a plus (create) or a pencil (edit). */
  icon?: React.ReactNode;
  editing: boolean;
  /** Where the back button and Cancel go (the list). */
  backTo: string;
  /** The list's name on the back button: `Clients`. */
  backLabel: string;
  onSubmit: (event?: React.BaseSyntheticEvent) => void | Promise<void>;
  isSubmitting: boolean;
  /** True when the user has typed something: leaving by the back button or Cancel asks first, and so does closing the tab. */
  isDirty: boolean;
  serverError?: ServerFormError | null;
  submitLabel: string;
  /** Edit forms wait for the record: its loading and error state. */
  loading?: { isLoading: boolean; error: unknown; onRetry: () => void; entityName: string };
  children: React.ReactNode;
}

/**
 * The page shell of a create/edit form, from the department form: a back button, an icon and title with a line
 * about the form, then one card holding the error banner, the fields (a two-column grid on wide screens, see
 * `FieldInputs grid`) and the Cancel / submit footer. Dialogs use `FormDialog`; both share `FormActions`,
 * `FormBanner` and the field parts. Like the dialog it asks before throwing away typed-in changes (back button, Cancel, closing the tab).
 */
export const FormPage: React.FC<FormPageProps> = ({ title, description, icon, editing, backTo, backLabel, onSubmit, isSubmitting, isDirty, serverError = null, submitLabel, loading, children }) => {
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const guarded = isDirty && !isSubmitting;

  // The browser's own prompt for a reload or a closed tab. Moving to another page from the menu cannot be intercepted
  // without a data router, so it is not guarded.
  useEffect(() => {
    if (!guarded) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [guarded]);

  const leave = (event: React.MouseEvent) => {
    if (!guarded) return;
    event.preventDefault();
    setAsking(true);
  };

  const form = (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(event);
      }}
      className="space-y-4"
    >
      <FormBanner error={serverError} />
      {children}
      <FormActions layout="page" submitLabel={submitLabel} isSubmitting={isSubmitting} cancelTo={backTo} onCancel={leave} />
    </form>
  );
  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 animate-in fade-in duration-200">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <Link to={backTo} onClick={leave}>
          <Button size="xs" variant="outline" leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>
            {backLabel}
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-indigo-400 [&>svg]:w-5 [&>svg]:h-5" aria-hidden="true">
              {icon ?? (editing ? <Pencil /> : <Plus />)}
            </span>
            {title}
          </h1>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
      </div>
      <Card>
        <CardBody>
          {loading ? (
            <QueryBoundary isLoading={loading.isLoading} error={loading.error} onRetry={loading.onRetry} entityName={loading.entityName}>
              {form}
            </QueryBoundary>
          ) : (
            form
          )}
        </CardBody>
      </Card>
      <ConfirmDialog
        isOpen={asking}
        title="Discard changes?"
        message="What you typed in this form will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => navigate(backTo)}
        onClose={() => setAsking(false)}
      />
    </div>
  );
};
