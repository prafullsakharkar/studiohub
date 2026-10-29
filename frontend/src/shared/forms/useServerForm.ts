import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldValues, SubmitHandler, UseFormProps, UseFormReturn } from 'react-hook-form';
import { applyServerErrors, knownFieldPaths } from './serverErrors';
import type { ApplyServerErrorsOptions, ServerFormError } from './serverErrors';

export interface UseServerFormOptions<T extends FieldValues> extends UseFormProps<T>, ApplyServerErrorsOptions {}

export interface UseServerFormReturn<T extends FieldValues> extends UseFormReturn<T> {
  /** Last submit failure that is not attached to a field (null when clean). */
  serverError: ServerFormError | null;
  clearServerError: () => void;
  /**
   * `handleSubmit` plus error mapping: if `onValid` throws, field errors go inline and the rest
   * to `serverError`. The error is swallowed (it has been displayed); use `onError` to react.
   */
  submit: (onValid: SubmitHandler<T>, onError?: (error: unknown) => void) => (event?: React.BaseSyntheticEvent) => Promise<void>;
}

export function useServerForm<T extends FieldValues>(options: UseServerFormOptions<T> = {}): UseServerFormReturn<T> {
  const { fieldMap, ...formProps } = options;
  const form = useForm<T>(formProps);
  const [serverError, setServerError] = useState<ServerFormError | null>(null);
  const { handleSubmit, setError, getValues } = form;

  const submit = useCallback<UseServerFormReturn<T>['submit']>(
    (onValid, onError) =>
      handleSubmit(async (values, event) => {
        setServerError(null);
        try {
          await onValid(values, event);
        } catch (error) {
          const result = applyServerErrors<T>(error, setError, knownFieldPaths(getValues()), { fieldMap });
          setServerError(result.banner || result.details.length ? result : null);
          onError?.(error);
        }
      }),
    [handleSubmit, setError, getValues, fieldMap]
  );

  const clearServerError = useCallback(() => setServerError(null), []);

  return { ...form, serverError, clearServerError, submit };
}
