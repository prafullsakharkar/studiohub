/**
 * StatusBadge is the only place a status gets a colour. It reads a status in any case or separator, shows the
 * text as the API sent it, and knows every status the backend can send (a new one fails the last test, so it
 * gets a colour on purpose instead of falling back to neutral unnoticed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DELIVERY_STATUSES } from '@/api/deliveries/deliveries';
import { JOB_STATUSES } from '@/api/publishing/publishing';
import { isKnownStatus, StatusBadge, toneOf } from '../StatusBadge';

afterEach(cleanup);

describe('toneOf', () => {
  it('folds case, underscores and dashes', () => {
    for (const s of ['In Progress', 'in progress', 'in_progress', 'IN-PROGRESS', '  In   Progress ']) expect(toneOf(s)).toBe('running');
    expect(toneOf('not_checked')).toBe('idle');
    expect(toneOf('Pre-Production')).toBe('preproduction');
  });

  it('gives each meaning its tone', () => {
    expect(['Approved', 'Completed', 'active', 'Exported', 'verified', 'pass', 'success'].map(toneOf)).toEqual(Array(7).fill('done'));
    expect(['Validating', 'Exporting', 'In Review', 'Booked', 'scheduled', 'running'].map(toneOf)).toEqual(Array(6).fill('running'));
    expect(['Ready', 'Validated'].map(toneOf)).toEqual(['ready', 'ready']);
    expect(['Pending', 'Pending Review', 'Submitted', 'Open', 'On Leave', 'Postponed', 'Deprecated'].map(toneOf)).toEqual(Array(7).fill('waiting'));
    expect(['Rejected', 'Retake', 'failed', 'fail', 'Revoked', 'mismatch', 'missing', 'Overbooked', 'Blocking'].map(toneOf)).toEqual(Array(9).fill('failed'));
    expect(['Not Started', 'Draft', 'archived', 'Inactive', 'disabled', 'Cancelled', 'Expired', 'declared'].map(toneOf)).toEqual(Array(8).fill('idle'));
    expect(toneOf('Signed Off')).toBe('signoff');
    expect(toneOf('On Hold')).toBe('held');
  });

  it('falls back to neutral for an unknown status, and does not read inherited keys', () => {
    expect(toneOf('Something new')).toBe('idle');
    expect(isKnownStatus('Something new')).toBe(false);
    expect(isKnownStatus('constructor')).toBe(false);
    expect(toneOf('toString')).toBe('idle');
    expect(toneOf(null)).toBe('idle');
  });
});

describe('StatusBadge', () => {
  it('shows the status as sent, coloured by its tone, with a dot', () => {
    const { container } = render(<StatusBadge status="in_progress" />);
    const badge = screen.getByText('in_progress').parentElement as HTMLElement;
    expect(badge.dataset.tone).toBe('running');
    expect(badge.className).toContain('dark:text-sky-400');
    expect(badge.className).toContain('text-sky-700');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows a label in place of the status, keeping the status colour', () => {
    render(<StatusBadge status="Approved" label="Comp: Approved" />);
    expect((screen.getByText('Comp: Approved').parentElement as HTMLElement).dataset.tone).toBe('done');
  });

  it('keeps the caller class', () => {
    render(<StatusBadge status="Active" className="ml-auto" />);
    expect((screen.getByText('Active').parentElement as HTMLElement).className).toContain('ml-auto');
  });
});

describe('every status the backend sends has a tone', () => {
  const generated = fs.readFileSync(path.resolve(process.cwd(), 'src/core/api/generated/openapi.ts'), 'utf8');
  const fromSchema = new Set<string>();
  for (const m of generated.matchAll(/\b(?:status|outcome|verdict|checksum_state|person_status|asset_status|job_status)\??: ((?:"[^"]+"\s*\|?\s*)+)/g)) {
    for (const v of m[1].matchAll(/"([^"]+)"/g)) fromSchema.add(v[1]);
  }

  it('reads the schema enums', () => {
    expect(fromSchema.size).toBeGreaterThan(30);
  });

  it.each([...fromSchema, ...DELIVERY_STATUSES, ...JOB_STATUSES].sort())('%s', (status) => {
    expect(isKnownStatus(status)).toBe(true);
  });
});
