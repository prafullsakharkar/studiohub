import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import * as K from '../publishingRowKeys';

/**
 * Review pipeline RP-4 (C-RP-16 to C-RP-18), against `_dependencies_flow.json` captured by
 * `docs/sync/tools/test_capture_publishing_depth.py`. The published-file shape is pinned here: `_flow.json` predates
 * `upstream_count` and `downstream_count`.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('publishing/_dependencies_flow.json');
const keys = (o: object) => Object.keys(o).sort();

describe('row types match the captured responses', () => {
  it.each([
    ['PublishedFile', flow.file_detail_downstream.body, K.PUBLISHEDFILE_KEYS],
    ['PublishedFile (list row)', flow.files_list.body.results[0], K.PUBLISHEDFILE_KEYS],
    ['FileDependencyRow', flow.dependencies_of_downstream.body.upstream[0], K.FILEDEPENDENCYROW_KEYS],
    ['PathTemplate', flow.template_create_studio.body, K.PATHTEMPLATE_KEYS],
    ['PathTemplate (list row)', flow.templates_list.body.results[0], K.PATHTEMPLATE_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row)).toEqual(keys(expected));
  });
});

describe('dependencies (C-RP-16)', () => {
  it('are written with the file and read both ways, with counts on the file', () => {
    const { upstream, downstream } = flow.ids as unknown as { upstream: string; downstream: string };
    expect(flow.register_with_upstream.status).toBe(201);
    expect(flow.register_with_upstream.body).toMatchObject({ upstream_count: 1, downstream_count: 0 });
    expect(flow.dependencies_of_downstream.body.upstream.map((r: any) => r.id)).toEqual([upstream]);
    expect(flow.dependencies_of_downstream.body.downstream).toEqual([]);
    expect(flow.dependencies_of_upstream.body.downstream.map((r: any) => r.id)).toEqual([downstream]);
  });

  it('an unknown or repeated upstream is a field error on upstream_ids, and a retry with other upstreams a 409', () => {
    expect(flow.register_upstream_unknown_400.status).toBe(400);
    expect(flow.register_upstream_unknown_400.body.upstream_ids[0]).toMatch(/^Unknown upstream file: /);
    expect(flow.register_upstream_twice_400.body.upstream_ids).toEqual(['A file is listed twice.']);
    expect(flow.retry_other_upstreams_409.status).toBe(409);
    expect(flow.retry_other_upstreams_409.body.error.code).toBe('path_already_registered');
  });

  it('a revoked upstream is refused; revoking one later shows on the downstream read, which is unchanged', () => {
    expect(flow.register_revoked_upstream_400.body.upstream_ids[0]).toMatch(/^The upstream file is revoked: /);
    expect(flow.dependencies_after_upstream_revoked.body.upstream[0].status).toBe('Revoked');
  });
});

describe('the loader (C-RP-17)', () => {
  it('latest is the newest version of the stream; approved and hero pick theirs', () => {
    const latest = flow.loader_latest.body;
    expect(latest).toHaveLength(1);
    expect(latest[0].version).toMatchObject({ version_index: 2, status: 'Pending Review', is_hero: false });
    expect(latest[0].task).toMatchObject({ code: 'RPD_T_COMP' });
    expect(flow.loader_approved.body[0].version).toMatchObject({ version_index: 1, status: 'Approved' });
    expect(flow.loader_hero_task.body.every((row: any) => row.version.is_hero)).toBe(true);
    expect(keys(latest[0])).toEqual(keys({ ...K.PUBLISHEDFILE_KEYS, version: true, task: true }));
  });

  it('needs exactly one entity; an unknown one is a 404', () => {
    expect(flow.loader_no_entity_400.status).toBe(400);
    expect(flow.loader_unknown_404.status).toBe(404);
  });
});

describe('path templates (C-RP-18)', () => {
  it('a studio template, then the project’s own wins in resolve-path', () => {
    expect(flow.template_create_studio.body).toMatchObject({ project_id: null, enforce: false, is_active: true, file_type: 'EXR', storage_root: 'PROJECTS' });
    expect(flow.resolve_path_studio.body.relative_path).toBe('RPD/RPD_SH0010/RPD_T_COMP/v002/{name}.%04d.exr');
    expect(flow.resolve_path_project.body).toMatchObject({ enforce: true, relative_path: 'RPD/RPD_SQ010/RPD_SH0010/RPD_T_COMP/v002/{name}.%04d.exr' });
    expect(flow.resolve_path_none_404.status).toBe(404);
  });

  it('only producers and studio admins write; bad patterns, duplicates and key changes are field errors; no delete', () => {
    expect(flow.template_create_by_supervisor_403.status).toBe(403);
    expect(flow.template_create_bad_token_400.body.pattern).toEqual(['Unknown token {shoot}.']);
    expect(flow.template_create_duplicate_400.status).toBe(400);
    expect(flow.template_patch_key_400.body.role[0]).toMatch(/^Cannot be changed/);
    expect(flow.template_patch_enforce_off.body.enforce).toBe(false);
    expect(flow.template_delete_405.status).toBe(405);
  });

  it('an enforcing template refuses another path with a field error naming the expected one', () => {
    expect(flow.register_mismatch_400.status).toBe(400);
    expect(flow.register_mismatch_400.body.relative_path).toEqual(['Does not match the path template: RPD/RPD_SQ010/RPD_SH0010/RPD_T_COMP/v002/{name}.%04d.exr']);
    expect(flow.register_match_201.status).toBe(201);
  });

  it('a project’s list holds its own templates only', () => {
    const projectId = (flow.ids as unknown as { project: string }).project;
    expect(flow.templates_list_project.body.results.every((row: any) => row.project_id === projectId)).toBe(true);
    expect(flow.templates_list.body.results.some((row: any) => row.project_id === null)).toBe(true);
  });
});
