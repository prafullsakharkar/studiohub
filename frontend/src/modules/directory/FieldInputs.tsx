import type React from 'react';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { Field, inputClass } from '@/modules/identity/components/ui';
import type { Values } from './formModel';
import type { FieldDef } from './types';

export interface FieldInputsProps {
  fields: ReadonlyArray<FieldDef>;
  parentId?: string;
  editing: boolean;
  immutableOnEdit?: ReadonlyArray<string>;
  register: UseFormRegister<Values>;
  control: Control<Values>;
  errors: FieldErrors<Values>;
  clearServerError: () => void;
}

/** Renders the inputs of a directory form from its field definitions. */
export const FieldInputs: React.FC<FieldInputsProps> = ({ fields, parentId, editing, immutableOnEdit, register, control, errors, clearServerError }) => {
  const err = (name: string) => (errors[name]?.message as string | undefined) ?? undefined;
  return (
    <>
          {fields.map((field) => {
            const readOnly = editing && immutableOnEdit?.includes(field.name);
            const id = `f-${field.name}`;
            if (field.kind === 'checkbox') {
              return (
                <label key={field.name} className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" {...register(field.name)} /> {field.label}
                </label>
              );
            }
            if (field.kind === 'entity') {
              return (
                <Controller
                  key={field.name}
                  control={control}
                  name={field.name}
                  render={({ field: f }) => <>{field.render({ parentId, value: String(f.value ?? ''), onChange: (v) => { clearServerError(); f.onChange(v); }, error: err(field.name) })}</>}
                />
              );
            }
            return (
              <Field key={field.name} id={id} label={`${field.label}${field.required ? ' *' : ''}`} error={err(field.name)} hint={readOnly ? 'Cannot be changed after creation.' : field.hint}>
                {field.kind === 'textarea' ? (
                  <textarea id={id} rows={3} disabled={readOnly} className={inputClass(Boolean(err(field.name)))} {...register(field.name, { onChange: clearServerError })} />
                ) : field.kind === 'select' ? (
                  <select id={id} disabled={readOnly} className={inputClass(Boolean(err(field.name)))} {...register(field.name, { onChange: clearServerError })}>
                    <option value="">{field.required ? 'Choose…' : '—'}</option>
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input id={id} type={field.kind === 'text' ? 'text' : field.kind} disabled={readOnly} maxLength={field.maxLength} className={inputClass(Boolean(err(field.name)))} {...register(field.name, { onChange: clearServerError })} />
                )}
              </Field>
            );
          })}
    </>
  );
};
