import type React from 'react';
import { useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Clipboard,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { BulkOperationEngine } from './BulkOperationEngine';

export interface GridColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  placeholder?: string;
  required?: boolean;
  width?: string;
}

interface BulkImportGridProps {
  columns: GridColumn[];
  rows: Record<string, any>[];
  onChange: (rows: Record<string, any>[]) => void;
  sampleRows?: Record<string, any>[];
  className?: string;
}

export const BulkImportGrid: React.FC<BulkImportGridProps> = ({
  columns,
  rows,
  onChange,
  sampleRows,
  className = '',
}) => {
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedRawText, setPastedRawText] = useState('');

  const updateCell = (rowIndex: number, columnKey: string, value: any) => {
    const updated = [...rows];
    updated[rowIndex] = {
      ...updated[rowIndex],
      [columnKey]: value,
    };
    onChange(updated);
  };

  const addRow = () => {
    const emptyRow: Record<string, any> = {};
    columns.forEach((col) => {
      emptyRow[col.key] = col.type === 'number' ? undefined : '';
    });
    onChange([...rows, emptyRow]);
  };

  const duplicateRow = (index: number) => {
    const rowToDup = { ...rows[index] };
    if (rowToDup.code) {
      rowToDup.code = `${rowToDup.code}_COPY`;
    }
    const updated = [...rows];
    updated.splice(index + 1, 0, rowToDup);
    onChange(updated);
  };

  const removeRow = (index: number) => {
    const updated = rows.filter((_, i) => i !== index);
    onChange(updated);
  };

  const clearAll = () => {
    onChange([]);
  };

  const handleApplyPaste = () => {
    if (!pastedRawText.trim()) return;
    const parsed = BulkOperationEngine.parseInput(
      pastedRawText,
      columns[0]?.key || 'code',
      columns.map((c) => c.key)
    );
    onChange(parsed);
    setPastedRawText('');
    setPasteModalOpen(false);
  };

  const loadSample = () => {
    if (sampleRows && sampleRows.length > 0) {
      onChange(sampleRows);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Grid Action Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs font-mono"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setPasteModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-mono text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/10"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste TSV / CSV</span>
          </Button>

          {sampleRows && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={loadSample}
              className="flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-slate-200"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Load Template</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </span>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-mono text-slate-500 hover:text-rose-400 px-2 py-1 rounded transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Grid Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center text-slate-600">#</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="py-2.5 px-3 font-semibold text-slate-300"
                    style={{ width: col.width || 'auto' }}
                  >
                    {col.label} {col.required && <span className="text-rose-400">*</span>}
                  </th>
                ))}
                <th className="py-2.5 px-3 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="py-8 text-center text-slate-500 font-mono"
                  >
                    Grid is empty. Click "+ Add Row" or "Paste TSV / CSV" from spreadsheet.
                  </td>
                </tr>
              ) : (
                rows.map((row, rIdx) => {
                  // Check frame validation if applicable
                  const frameIn = row.frame_in !== undefined ? Number(row.frame_in) : undefined;
                  const frameOut = row.frame_out !== undefined ? Number(row.frame_out) : undefined;
                  const hasFrameError =
                    frameIn !== undefined && frameOut !== undefined && frameOut <= frameIn;

                  return (
                    <tr
                      key={rIdx}
                      className={`hover:bg-slate-900/40 transition-colors ${
                        hasFrameError ? 'bg-rose-950/20' : ''
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-2 px-3 text-center text-slate-600 font-mono text-[11px]">
                        {rIdx + 1}
                      </td>

                      {/* Columns */}
                      {columns.map((col) => {
                        const val = row[col.key] ?? '';
                        const isFrameCell = col.key === 'frame_in' || col.key === 'frame_out';

                        return (
                          <td key={col.key} className="py-1 px-2">
                            {col.type === 'select' && col.options ? (
                              <select
                                value={val}
                                onChange={(e) => updateCell(rIdx, col.key, e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="">Select...</option>
                                {col.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={col.type === 'number' ? 'number' : 'text'}
                                value={val}
                                placeholder={col.placeholder}
                                onChange={(e) => {
                                  const newVal =
                                    col.type === 'number'
                                      ? e.target.value === ''
                                        ? undefined
                                        : parseInt(e.target.value, 10)
                                      : e.target.value;
                                  updateCell(rIdx, col.key, newVal);
                                }}
                                className={`w-full bg-slate-900/80 border rounded px-2 py-1 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 ${
                                  isFrameCell && hasFrameError
                                    ? 'border-rose-500/60 bg-rose-950/30'
                                    : 'border-slate-800'
                                }`}
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Row Actions */}
                      <td className="py-1 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateRow(rIdx)}
                            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                            title="Duplicate Row"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(rIdx)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Delete Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paste Modal */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <h4 className="font-bold text-white text-base">Paste TSV / CSV Data</h4>
              </div>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Copy rows from Excel, Google Sheets, or a CSV file and paste them below.
              Tab and comma separated values will be mapped automatically.
            </p>

            <textarea
              rows={8}
              value={pastedRawText}
              onChange={(e) => setPastedRawText(e.target.value)}
              placeholder={`Code\tName\tFrame In\tFrame Out\nNK_010_010\tHero Dive\t1001\t1120\nNK_010_020\tAlley Pursuit\t1001\t1080`}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:ring-1 focus:ring-indigo-500"
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setPasteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={handleApplyPaste}
                disabled={!pastedRawText.trim()}
              >
                Import Rows
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
