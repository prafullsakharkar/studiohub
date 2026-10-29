import { type EntityResolutionItem, EntityResolutionState, type BulkUpdateFieldConfig } from '@/types/production';

export interface ParsedRow {
  [key: string]: any;
}

export class BulkOperationEngine {
  /**
   * Parse raw text (TSV, CSV, or line-delimited codes) into structured rows
   */
  static parseInput(
    rawText: string,
    defaultField: string = 'code',
    expectedHeaders?: string[]
  ): ParsedRow[] {
    if (!rawText || !rawText.trim()) return [];

    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return [];

    // Check if first line is a header
    const firstLine = lines[0];
    const isTabSeparated = firstLine.includes('\t');
    const isCommaSeparated = firstLine.includes(',');
    const delimiter = isTabSeparated ? '\t' : isCommaSeparated ? ',' : null;

    if (!delimiter) {
      // Simple line-by-line codes
      return lines.map((line) => ({
        [defaultField]: line.trim().toUpperCase(),
      }));
    }

    const firstRowTokens = firstLine.split(delimiter).map((t) => t.trim().toLowerCase().replace(/\s+/g, '_'));
    let headerTokens: string[] = [];
    let dataLines = lines;

    // Detect if first row looks like headers (e.g., contains 'code', 'shot', 'sequence', 'name', 'frame_in')
    const commonHeaderNames = ['code', 'shot_code', 'sequence_code', 'sequence', 'name', 'status', 'frame_in', 'frame_out', 'department', 'priority'];
    const hasHeaderMatch = firstRowTokens.some((t) => commonHeaderNames.includes(t));

    if (hasHeaderMatch) {
      headerTokens = firstRowTokens;
      dataLines = lines.slice(1);
    } else if (expectedHeaders && expectedHeaders.length > 0) {
      headerTokens = expectedHeaders;
    } else {
      headerTokens = [defaultField, 'name', 'description', 'frame_in', 'frame_out'];
    }

    return dataLines.map((line) => {
      const values = line.split(delimiter).map((v) => v.trim());
      const row: ParsedRow = {};
      headerTokens.forEach((header, idx) => {
        let val: any = values[idx] !== undefined ? values[idx] : '';
        // Type conversion
        if (header === 'frame_in' || header === 'frame_out' || header === 'start_frame' || header === 'end_frame' || header === 'handle_frames') {
          const num = parseInt(val, 10);
          val = !isNaN(num) ? num : undefined;
        }
        if (header === 'code' || header === 'shot_code' || header === 'sequence_code') {
          val = typeof val === 'string' ? val.toUpperCase() : val;
        }
        row[header] = val;
      });
      return row;
    });
  }

  /**
   * Deduplicate items within the same request and assign states
   */
  static analyzeRequestDuplicates<T = any>(
    items: Partial<T>[],
    codeSelector: (item: Partial<T>) => string
  ): { items: EntityResolutionItem<T>[]; duplicateCount: number } {
    const seenCodes = new Set<string>();
    let duplicateCount = 0;

    const analyzed: EntityResolutionItem<T>[] = items.map((item, idx) => {
      const rawCode = codeSelector(item) || '';
      const code = rawCode.trim().toUpperCase();

      if (!code) {
        return {
          code: '',
          state: 'INVALID',
          proposedData: item,
          errors: ['Entity code cannot be empty.'],
          userAction: 'skip',
          rowIndex: idx,
        };
      }

      if (seenCodes.has(code)) {
        duplicateCount++;
        return {
          code,
          state: 'DUPLICATE_IN_REQUEST',
          proposedData: item,
          warnings: [`Duplicate code '${code}' in this batch.`],
          userAction: 'skip',
          rowIndex: idx,
        };
      }

      seenCodes.add(code);
      return {
        code,
        state: 'NEW',
        proposedData: item,
        userAction: 'create',
        rowIndex: idx,
      };
    });

    return { items: analyzed, duplicateCount };
  }

  /**
   * Validate frame range logic: frame_out > frame_in
   */
  static validateFrameRanges(
    frameIn?: number,
    frameOut?: number
  ): { valid: boolean; error?: string } {
    if (frameIn === undefined || frameOut === undefined) return { valid: true };
    if (frameOut <= frameIn) {
      return {
        valid: false,
        error: `Frame Out (${frameOut}) must be greater than Frame In (${frameIn}).`,
      };
    }
    return { valid: true };
  }

  /**
   * Compute mixed-value status for bulk updates across an array of objects
   */
  static computeFieldMixedStates<T extends Record<string, any>>(
    entities: T[],
    fieldConfigs: Omit<BulkUpdateFieldConfig<T>, 'currentMixed' | 'currentCommonValue'>[]
  ): BulkUpdateFieldConfig<T>[] {
    if (!entities || entities.length === 0) {
      return fieldConfigs.map((f) => ({
        ...f,
        currentMixed: false,
        currentCommonValue: undefined,
      }));
    }

    return fieldConfigs.map((field) => {
      const values = entities.map((e) => e[field.key]);
      const firstVal = values[0];
      const allSame = values.every((v) => {
        if (Array.isArray(v) && Array.isArray(firstVal)) {
          return JSON.stringify(v.sort()) === JSON.stringify(firstVal.sort());
        }
        return v === firstVal;
      });

      return {
        ...field,
        currentMixed: !allSame,
        currentCommonValue: allSame ? firstVal : undefined,
        newValue: allSame ? firstVal : field.newValue,
      };
    });
  }
}
