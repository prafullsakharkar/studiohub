import React, { useState } from 'react';
import { FieldDefinition } from '@/types/crud';
import { RelationshipSelector } from '@/shared/relationships/RelationshipSelector';
import { Button } from '@/shared/components/Button';

interface EntityFormProps<T = any> {
  fields: FieldDefinition<T>[];
  initialValues?: Partial<T>;
  onSubmit: (values: T) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  className?: string;
}

export function EntityForm<T extends Record<string, any>>({
  fields,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save Record',
  isSubmitting = false,
  className = '',
}: EntityFormProps<T>) {
  const [formValues, setFormValues] = useState<Partial<T>>(() => ({ ...initialValues }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      const val = formValues[field.key];
      if (field.required && (val === undefined || val === null || val === '')) {
        newErrors[field.key] = `${field.label} is required`;
      } else if (field.validation) {
        const customErr = field.validation(val, formValues);
        if (customErr) newErrors[field.key] = customErr;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await onSubmit(formValues as T);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field) => {
          const val = formValues[field.key] ?? field.defaultValue ?? '';
          const err = errors[field.key];

          // Allow custom input renderer
          if (field.renderFormInput) {
            return (
              <div key={field.key} className="col-span-2">
                {field.renderFormInput(val, (v) => handleFieldChange(field.key, v), formValues)}
                {err && <p className="text-[11px] text-rose-400 mt-1">{err}</p>}
              </div>
            );
          }

          // Entity Reference selector
          if (field.type === 'reference' && field.referenceType) {
            return (
              <div key={field.key} className="col-span-1">
                <RelationshipSelector
                  label={field.label}
                  targetType={field.referenceType}
                  value={val}
                  required={field.required}
                  description={field.description}
                  onChange={(nextId) => handleFieldChange(field.key, nextId)}
                />
                {err && <p className="text-[11px] text-rose-400 mt-1">{err}</p>}
              </div>
            );
          }

          // Select dropdown
          if (field.type === 'select' || field.type === 'status' || field.type === 'priority') {
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  {field.label} {field.required && <span className="text-rose-400">*</span>}
                </label>
                <select
                  value={val}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className={`w-full px-3 py-2 bg-slate-900 border ${
                    err ? 'border-rose-500 ring-1 ring-rose-500/20' : 'border-slate-800'
                  } rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500`}
                >
                  <option value="">Select {field.label}...</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {err && <p className="text-[11px] text-rose-400">{err}</p>}
              </div>
            );
          }

          // Boolean toggle
          if (field.type === 'boolean') {
            return (
              <div key={field.key} className="flex items-center gap-3 pt-4">
                <input
                  type="checkbox"
                  id={`field-${field.key}`}
                  checked={Boolean(val)}
                  onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <label
                  htmlFor={`field-${field.key}`}
                  className="text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  {field.label}
                </label>
              </div>
            );
          }

          // Date input
          if (field.type === 'date') {
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  {field.label} {field.required && <span className="text-rose-400">*</span>}
                </label>
                <input
                  type="date"
                  value={val}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className={`w-full px-3 py-2 bg-slate-900 border ${
                    err ? 'border-rose-500 ring-1 ring-rose-500/20' : 'border-slate-800'
                  } rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono`}
                />
                {err && <p className="text-[11px] text-rose-400">{err}</p>}
              </div>
            );
          }

          // Numeric input
          if (field.type === 'number' || field.type === 'progress' || field.type === 'currency') {
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  {field.label} {field.required && <span className="text-rose-400">*</span>}
                </label>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => handleFieldChange(field.key, Number(e.target.value))}
                  placeholder={field.placeholder || '0'}
                  className={`w-full px-3 py-2 bg-slate-900 border ${
                    err ? 'border-rose-500 ring-1 ring-rose-500/20' : 'border-slate-800'
                  } rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono`}
                />
                {err && <p className="text-[11px] text-rose-400">{err}</p>}
              </div>
            );
          }

          // Default Text / String input
          return (
            <div key={field.key} className={field.key === 'description' ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
              <label className="block text-xs font-semibold text-slate-300">
                {field.label} {field.required && <span className="text-rose-400">*</span>}
              </label>
              {field.key === 'description' ? (
                <textarea
                  rows={3}
                  value={val}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                  className={`w-full px-3 py-2 bg-slate-900 border ${
                    err ? 'border-rose-500 ring-1 ring-rose-500/20' : 'border-slate-800'
                  } rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500`}
                />
              ) : (
                <input
                  type="text"
                  value={val}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                  className={`w-full px-3 py-2 bg-slate-900 border ${
                    err ? 'border-rose-500 ring-1 ring-rose-500/20' : 'border-slate-800'
                  } rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500`}
                />
              )}
              {err && <p className="text-[11px] text-rose-400">{err}</p>}
            </div>
          );
        })}
      </div>

      {/* Form Action Controls */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
