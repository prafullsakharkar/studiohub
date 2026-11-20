import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import type { Project } from '../structure';
import type { GradeImport, Shot } from '../work';
import { gradeExportName } from '../work';

/**
 * Exporting shot grades (RP-27, docs/review-pipeline/CONTRACTS.md C-RP-62), pinned to the capture:
 * docs/sync/samples/production/_grade_export_flow.json.
 */
type Captured<T> = { status: number; body: T; headers?: Record<string, string> };
interface Flow {
  export_project: Captured<string>;
  export_sequence: Captured<string>;
  export_sequence_unknown: Captured<string>;
  export_sequence_malformed: Captured<string>;
  export_as_vendor: Captured<string>;
  export_as_client: Captured<string>;
  export_without_shot_view_403: Captured<{ detail: string; error: { code: string } }>;
  export_outside_404: Captured<{ detail: string }>;
  shot_imported: Captured<Shot>;
  shot_ungraded: Captured<Shot>;
  me_supervisor: Captured<User>;
  me_without_shot_view: Captured<User>;
  project: Captured<Project>;
  reimport_dry_run: Captured<GradeImport>;
  audit_of_exports: Captured<{ count: number; results: Array<{ action: string; changes_diff: Record<string, unknown> }> }>;
}
const flow = loadSample<Flow>('production/_grade_export_flow.json');
const ids = (xml: string) => [...xml.matchAll(/<ColorCorrection id="([^"]+)"/g)].map((m) => m[1]);

describe('C-RP-62: GET projects/{id}/grades/export/', () => {
  it('a .ccc attachment, named as gradeExportName says, never cached', () => {
    expect(flow.export_project.headers).toEqual({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${gradeExportName(flow.project.body.code)}"`,
      'Cache-Control': 'no-store',
    });
    expect(flow.export_project.body.startsWith("<?xml version='1.0' encoding='utf-8'?>\n<ColorCorrectionCollection xmlns=\"urn:ASC:CDL:v1.01\">")).toBe(true);
  });

  it('the graded live shots by code; the ungraded one is left out; an imported grade names its file', () => {
    expect(ids(flow.export_project.body)).toEqual(['REX_SH0010', 'REX_SH0020', 'REX_SH0030']);
    expect(flow.shot_ungraded.body.grade).toBeNull();
    expect(ids(flow.export_project.body)).not.toContain(flow.shot_ungraded.body.code);
    expect(flow.shot_imported.body.grade_source).toContain('client_reel1.ccc');
    expect(flow.export_project.body).toContain(`<Description>${flow.shot_imported.body.grade_source}</Description>`);
  });

  it('one sequence; an unknown or malformed sequence is an empty collection, never a 400', () => {
    expect(ids(flow.export_sequence.body)).toEqual(['REX_SH0010', 'REX_SH0020']);
    for (const c of [flow.export_sequence_unknown, flow.export_sequence_malformed]) {
      expect(c.status).toBe(200);
      expect(ids(c.body)).toEqual([]);
    }
  });

  it('a vendor member gets their task’s shot; a client member none', () => {
    expect(ids(flow.export_as_vendor.body)).toEqual(['REX_SH0020']);
    expect(ids(flow.export_as_client.body)).toEqual([]);
  });

  it('without shot.view 403; outside the project 404, both as JSON errors', () => {
    expect(flow.export_without_shot_view_403.status).toBe(403);
    expect(flow.export_without_shot_view_403.body.error.code).toBe('permission_denied');
    expect(flow.export_outside_404.status).toBe(404);
    expect(flow.me_supervisor.body.permissions).toContain('shot.view');
    expect(flow.me_without_shot_view.body.permissions).not.toContain('shot.view');
  });

  it('the exported file imported again changes nothing', () => {
    const again = flow.reimport_dry_run.body;
    expect(again.matched).toEqual([]);
    expect(again.unmatched).toEqual([]);
    expect(again.invalid).toEqual([]);
    expect(again.unchanged.map((u) => u.shot.code).sort()).toEqual(ids(flow.export_project.body));
  });

  it('each export is an audit row with the file, the sequence and the count; the refusals are not', () => {
    const rows = flow.audit_of_exports.body.results;
    expect(flow.audit_of_exports.body.count).toBe(6);
    expect(rows.every((r) => r.action === 'export')).toBe(true);
    expect(Object.keys(rows[0].changes_diff).sort()).toEqual(['file_name', 'operation', 'sequence_id', 'shots']);
    expect(rows.map((r) => r.changes_diff.shots).sort()).toEqual([0, 0, 0, 1, 2, 3]);
  });
});
