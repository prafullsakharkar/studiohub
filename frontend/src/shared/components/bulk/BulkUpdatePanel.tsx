import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Edit3,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Sparkles,
  ShieldAlert,
  Info,
} from 'lucide-react';
import type { BulkUpdateFieldConfig, BulkOperationResponse } from '@/types/production';
import { Button } from '@/shared/components/Button';
import { BulkOperationEngine } from './BulkOperationEngine';

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'tags';
  options?: string[];
  placeholder?: string;
  category?: string;
}

interface BulkUpdatePanelProps<T extends Record<string, any>> {
  entityType: 'Sequence' | 'Shot' | 'Asset' | 'Task' | string;
  selectedEntities: T[];
  fieldDefinitions: FieldDefinition[];
  onApplyUpdate: (changes: Partial<T>) => Promise<BulkOperationResponse<T>>;
  onClose: () => void;
  className?: string;
}

export const BulkUpdatePanel = <T extends Record<string, any>>({
  entityType,
  selectedEntities,
  fieldDefinitions,
  onApplyUpdate,
  onClose,
  className = '',
}: BulkUpdatePanelProps<T>) => {
  const [fieldConfigs, setFieldConfigs] = useState<BulkUpdateFieldConfig<T>[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultResponse, setResultResponse] = useState<BulkOperationResponse<T> | null>(null);

  // Initialize field configs with computed mixed states
  useEffect(() => {
    const rawConfigs = fieldDefinitions.map((def) => ({
      key: def.key,
      label: def.label,
      type: def.type,
      options: def.options,
      enabled: false,
      newValue: undefined,
    }));
    const computed = BulkOperationEngine.computeFieldMixedStates(selectedEntities, rawConfigs);
    setFieldConfigs(computed);
  }, [selectedEntities, fieldDefinitions]);

  const toggleFieldEnabled = (key: string | keyof T) => {
    setFieldConfigs((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const updateFieldValue = (key: string | keyof T, value: any) => {
    setFieldConfigs((prev) =>
      prev.map((f) => (f.key === key ? { ...f, newValue: value, enabled: true } : f))
    );
  };

  const activeChangesCount = fieldConfigs.filter((f) => f.enabled).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeChangesCount === 0) return;

    const changes: Partial<T> = {};
    fieldConfigs.forEach((f) => {
      if (f.enabled && f.newValue !== undefined) {
        changes[f.key as keyof T] = f.newValue;
      }
    });

    setIsSubmitting(true);
    try {
      const resp = await onApplyUpdate(changes);
      setResultResponse(resp);
    } catch (err) {
      console.error('Bulk update error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (resultResponse) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl space-y-4 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Bulk Update Complete</h3>
            <p className="text-slate-400">
              Successfully updated {resultResponse.summary.updatedCount} of {selectedEntities.length}{' '}
              {entityType.toLowerCase()}s.
            </p>
          </div>
        </div>
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <Button size="sm" variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-slate-900 border border-indigo-500/40 rounded-xl p-5 shadow-2xl space-y-4 text-xs font-mono ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Bulk Update {selectedEntities.length} {entityType}s
            </h3>
            <p className="text-slate-400 text-xs">
              Check the box next to any property you want to update across all selected {entityType.toLowerCase()}s.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white text-base"
        >
          ✕
        </button>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 bg-slate-950/60 max-h-96 overflow-y-auto">
          {fieldConfigs.map((field) => {
            const def = fieldDefinitions.find((d) => d.key === field.key);

            return (
              <div
                key={String(field.key)}
                className={`p-3 transition-colors ${
                  field.enabled ? 'bg-indigo-950/20' : 'hover:bg-slate-900/30'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`chk-${String(field.key)}`}
                      checked={field.enabled}
                      onChange={() => toggleFieldEnabled(field.key)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500"
                    />
                    <label
                      htmlFor={`chk-${String(field.key)}`}
                      className="font-bold text-slate-200 cursor-pointer select-none"
                    >
                      {field.label}
                    </label>
                  </div>

                  {field.currentMixed && (
                    <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Mixed Values
                    </span>
                  )}
                  {!field.currentMixed && field.currentCommonValue !== undefined && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      Current: {String(field.currentCommonValue)}
                    </span>
                  )}
                </div>

                {/* Input control */}
                <div className="pl-6">
                  {field.type === 'select' && field.options ? (
                    <select
                      disabled={!field.enabled}
                      value={field.newValue ?? ''}
                      onChange={(e) => updateFieldValue(field.key, e.target.value)}
                      className={`w-full bg-slate-900 border rounded px-3 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 ${
                        field.enabled
                          ? 'border-indigo-500/60 bg-slate-900'
                          : 'border-slate-800 opacity-50'
                      }`}
                    >
                      <option value="">
                        {field.currentMixed ? '(Keep Mixed / Select New)' : 'Select...'}
                      </option>
                      {field.options.map((opt) => {
                        const optKey = typeof opt === 'string' ? opt : opt.value;
                        const optLabel = typeof opt === 'string' ? opt : opt.label;
                        return (
                          <option key={optKey} value={optKey}>
                            {optLabel}
                          </option>
                        );
                      })}
                    </select>
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      disabled={!field.enabled}
                      value={field.newValue ?? ''}
                      placeholder={field.currentMixed ? 'Keep Mixed' : def?.placeholder}
                      onChange={(e) =>
                        updateFieldValue(
                          field.key,
                          e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                        )
                      }
                      className={`w-full bg-slate-900 border rounded px-3 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 ${
                        field.enabled
                          ? 'border-indigo-500/60 bg-slate-900'
                          : 'border-slate-800 opacity-50'
                      }`}
                    />
                  ) : (
                    <input
                      type="text"
                      disabled={!field.enabled}
                      value={field.newValue ?? ''}
                      placeholder={field.currentMixed ? 'Keep Mixed' : def?.placeholder}
                      onChange={(e) => updateFieldValue(field.key, e.target.value)}
                      className={`w-full bg-slate-900 border rounded px-3 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 ${
                        field.enabled
                          ? 'border-indigo-500/60 bg-slate-900'
                          : 'border-slate-800 opacity-50'
                      }`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={activeChangesCount === 0 || isSubmitting}
            className="flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Applying Updates...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  Apply to {selectedEntities.length} {entityType}s ({activeChangesCount} fields)
                </span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
