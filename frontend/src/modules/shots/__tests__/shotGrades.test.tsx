import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewCopies, ReviewCopyDiffering, ReviewMedia, Version } from '@/api/production/review';
import type { GradeImport as GradeImportResult, Shot } from '@/api/production/work';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { fromRow, wireValue } from '@/modules/directory/formModel';
import { differingText, outOfDateText } from '@/modules/production/review/ReviewCopiesNotice';
import { copyNotes } from '@/modules/production/review/ReviewMoviePanel';
import { ShotGradeField, gradeText } from '@/modules/production/work/ShotGradeField';
import { shotsFormFields } from '@/modules/production/work/shots';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { GradeImport, importSummary } from '../components/GradeImport';

/** RP-20 (C-RP-52 to C-RP-54): the shot's grade on the form, the import and what review copies say, against _shot_grades_flow.json. */
type Captured<T> = { status: number; body: T };
interface Flow {
  shot_no_grade: Captured<Shot>;
  shot_imported: Captured<Shot>;
  import_dry_run_200: Captured<GradeImportResult>;
  import_apply_200: Captured<GradeImportResult>;
  import_doctype_400: Captured<Record<string, string[]>>;
  version_sequence_graded: Captured<Version>;
  version_sequence_regraded: Captured<Version>;
  version_sequence_no_grading_space: Captured<Version>;
  version_movie_not_graded: Captured<Version>;
  copies_other_grade: Captured<ReviewCopies>;
}
const flow = loadSample<Flow>('production/_shot_grades_flow.json');
/** A version's review copy; every version of this capture has one. */
const copyOf = (v: Version): ReviewMedia => {
  if (!v.review_media) throw new Error(`${v.code} has no review copy`);
  return v.review_media;
};
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const dryRun = flow.import_dry_run_200.body;
const imported = flow.shot_imported.body;
const row = (shot: Shot) => shot as unknown as Record<string, unknown>;
const importedGrade = (() => {
  if (!imported.grade) throw new Error('the imported shot has no grade');
  return imported.grade;
})();
const gradeField = shotsFormFields.find((f) => f.name === 'grade');

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(ui: React.ReactElement) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user: admin, refreshUser: vi.fn() } as unknown as AuthContextValue}>{ui}</AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('the grade on the shot form (C-RP-52)', () => {
  it('is an edit-only field whose wire value is the grade, blank as null', () => {
    expect(gradeField).toMatchObject({ kind: 'entity', jsonValue: true, onlyOnEdit: true });
    if (!gradeField) throw new Error('no grade field');
    const shown = fromRow([gradeField], row(imported))[gradeField.name];
    expect(wireValue(gradeField, shown)).toEqual(importedGrade);
    expect(fromRow([gradeField], row(flow.shot_no_grade.body))[gradeField.name]).toBe('');
    expect(wireValue(gradeField, '')).toBeNull();
  });

  /** In a form, as on the shot's edit page: none of the field's buttons may submit it (found by the live run). */
  const submitted = vi.fn((e: React.FormEvent) => e.preventDefault());
  function Harness({ initial }: { initial: string }) {
    const [value, setValue] = useState(initial);
    return (
      <form onSubmit={submitted}>
        <ShotGradeField value={value} onChange={setValue} />
        <output data-testid="value">{value}</output>
      </form>
    );
  }
  const held = () => screen.getByTestId('value').textContent ?? '';

  it('Add grade starts from the grade that changes nothing; each box sets its channel; Clear sends none', () => {
    mount(<Harness initial="" />);
    expect(screen.getByText(/No grade/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add grade' }));
    expect(JSON.parse(held())).toEqual({ slope: [1, 1, 1], offset: [0, 0, 0], power: [1, 1, 1], saturation: 1 });
    fireEvent.change(screen.getByLabelText('Slope R'), { target: { value: '1.1' } });
    fireEvent.change(screen.getByLabelText('Offset B'), { target: { value: '-0.01' } });
    fireEvent.change(screen.getByLabelText('Saturation'), { target: { value: '0.9' } });
    expect(JSON.parse(held())).toEqual({ slope: [1.1, 1, 1], offset: [0, 0, -0.01], power: [1, 1, 1], saturation: 0.9 });
    fireEvent.click(screen.getByRole('button', { name: 'Clear grade' }));
    expect(held()).toBe('');
    expect(submitted).not.toHaveBeenCalled();
  });

  it('shows a stored grade, and leaves text that is not a number for the server to name', () => {
    mount(<Harness initial={JSON.stringify(importedGrade)} />);
    expect((screen.getByLabelText('Power B') as HTMLInputElement).value).toBe('1.05');
    fireEvent.change(screen.getByLabelText('Power B'), { target: { value: '' } });
    expect(JSON.parse(held()).power).toEqual([1, 1, '']);
  });

  it('a grade in one line, as CDL files write it', () => {
    expect(gradeText(importedGrade)).toBe('slope 1.1 1 0.9 · offset 0.01 0 -0.01 · power 1 1 1.05 · sat 0.9');
  });
});

describe('Import grades… (C-RP-54)', () => {
  const isImport = (c: MockCall) => new URL(c.url).pathname.endsWith('/grades/import/');
  const choose = () => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['<x/>'], 'reel1.ccc')] } });
  };

  it('reads the file as a dry run, shows what would change, then applies it', async () => {
    const sent: string[] = [];
    mockFetch(async (c) => {
      if (!isImport(c)) return { status: 500 };
      const body = String(c.body ?? '');
      sent.push(body.includes('name="dry_run"\r\n\r\nfalse') ? 'apply' : 'dry run');
      return sent.at(-1) === 'apply' ? { status: 200, body: flow.import_apply_200.body } : { status: 200, body: dryRun };
    });
    mount(<GradeImport projectId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Import grades…' }));
    choose();
    await screen.findByText(importSummary(dryRun));
    expect(importSummary(dryRun)).toBe('5 corrections in reel1.ccc. 2 shots would get a new grade. 1 shot already has it. 1 match no shot you may change. 1 cannot be used.');
    expect(screen.getByRole('list', { name: 'New grades' }).textContent).toContain('RPG_SH0010 (from SH0010)');
    expect(screen.getByText(/SH9990/)).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Corrections that cannot be used' }).textContent).toContain('saturation must be from 0 up to 10.');
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 2 shots' }));
    await waitFor(() => expect(sent).toEqual(['dry run', 'apply']));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Apply to 2 shots' })).toBeNull());
  });

  it('a refused file says why, and nothing can be applied', async () => {
    mockFetch((c) => (isImport(c) ? { status: 400, body: flow.import_doctype_400.body } : { status: 500 }));
    mount(<GradeImport projectId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Import grades…' }));
    choose();
    expect((await screen.findByRole('alert')).textContent).toContain('declares a document type');
    expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('what review copies say (C-RP-53)', () => {
  const graded = copyOf(flow.version_sequence_graded.body);
  it('the panel says a copy was graded, and from which file, or why not', () => {
    expect(copyNotes(graded)).toContain("Graded with the shot's CDL from reel1.ccc (SH0010)");
    const regraded = copyOf(flow.version_sequence_regraded.body);
    expect(copyNotes(regraded)).toContain("Graded with the shot's CDL");
    const skipped = copyOf(flow.version_sequence_no_grading_space.body);
    expect(copyNotes(skipped)).toContain("not graded: the studio's colour config has no grading space (color_timing)");
    const movie = copyOf(flow.version_movie_not_graded.body);
    expect(copyNotes(movie).some((n) => n.includes('grad'))).toBe(false);
  });

  it('the notice names the shot’s grade as what differs', () => {
    const other = flow.copies_other_grade.body;
    expect(differingText(other.differing[0])).toMatch(/^grade differ · /);
    const both = { ...other.differing[0], why: ['burn_ins', 'colour', 'grade'] } as ReviewCopyDiffering;
    expect(differingText(both)).toMatch(/^burn-ins, colour and grade differ · /);
    expect(outOfDateText({ ...other, out_of_date: 2, grade_out_of_date: 2 })).toBe('2 review copies were made with other shot grades, colour or burn-in settings than the project has now.');
    expect(outOfDateText({ ...other, out_of_date: 1, grade_out_of_date: 0, colour_out_of_date: 1 })).toBe('1 review copy was made with other colour or burn-in settings than the project has now.');
  });
});
