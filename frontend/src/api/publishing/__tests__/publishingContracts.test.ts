import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { FINAL_JOB_STATUSES, fileActionsFrom, isJobDeletable, isJobEditable, jobActionsFrom, JOB_ACTIONS } from '../publishingFlow';
import { JOB_STATUSES } from '../publishing';
import * as K from '../publishingRowKeys';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('publishing/_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const names = (list: ReadonlyArray<{ action: string }>) => list.map((a) => a.action);

describe('row types match the captured responses', () => {
  it.each([
    ['PublishRow', flow.jobs_list.body.results[0], K.PUBLISHROW_KEYS],
    ['Publish (the detail)', flow.jobs_detail_exported.body, K.PUBLISH_KEYS],
    ['PublishedFile', flow.files_detail.body, K.PUBLISHEDFILE_KEYS],
    ['StorageRoot', flow.roots_detail.body, K.STORAGEROOT_KEYS],
    ['PublishDestination', flow.destinations_detail.body, K.PUBLISHDESTINATION_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row)).toEqual(keys(expected));
  });
});

describe('export jobs', () => {
  it('`status` is a legacy word that calls Validated and Exported alike; `job_status` is the real one', () => {
    expect(flow.jobs_detail_validated.body).toMatchObject({ status: 'Published', job_status: 'Validated' });
    expect(flow.jobs_detail_exported.body).toMatchObject({ status: 'Published', job_status: 'Exported' });
    expect(flow.jobs_start_export.body).toMatchObject({ status: 'Publishing', job_status: 'Exporting' });
    expect(flow.jobs_republish.body).toMatchObject({ status: 'Queued', job_status: 'Pending' });
    expect(flow.jobs2_unpublish.body).toMatchObject({ status: 'Unpublished', job_status: 'Cancelled' });
    for (const key of Object.keys(flow)) if (flow[key].status === 200 && flow[key].body?.job_status) expect(JOB_STATUSES).toContain(flow[key].body.job_status);
  });

  it('each action moved the job the way the flow table says', () => {
    expect(flow.jobs_validate.body).toMatchObject({ success: true, status: 'Published' }); // the legacy word for Validated
    expect(flow.jobs_detail_validated.body.job_status).toBe('Validated');
    expect(flow.jobs_start_export.body.job_status).toBe('Exporting');
    expect(flow.jobs_complete.body.job_status).toBe('Exported');
    expect(flow.jobs2_fail.body).toMatchObject({ job_status: 'Failed', error_message: 'Render node went away' });
    expect(flow.jobs2_retry.body.job_status).toBe('Pending');
    expect(flow.jobs2_unpublish.body.job_status).toBe('Cancelled');
    expect(flow.jobs_republish.status).toBe(201);
  });

  it('a move the status does not allow is a 409 invalid_transition with from and to', () => {
    for (const key of ['jobs_start_export_pending', 'jobs_complete_pending', 'jobs_fail_pending', 'jobs_retry_pending', 'jobs_start_export_again', 'jobs_unpublish_exporting', 'jobs_unpublish_exported', 'jobs_retry_exported']) {
      expect(flow[key].status).toBe(409);
      expect(flow[key].body.code).toBe('invalid_transition');
      expect(flow[key].body).toHaveProperty('from');
    }
  });

  it('the action table agrees with the server', () => {
    const offered = (job: string) => names(jobActionsFrom(job));
    expect(offered('Pending')).toEqual(['validate', 'unpublish', 'republish']);
    expect(offered('Validated')).toEqual(['validate', 'startExport', 'unpublish', 'republish']);
    expect(offered('Exporting')).toEqual(['completeExport', 'fail', 'republish']);
    expect(offered('Failed')).toEqual(['retry', 'unpublish', 'republish']);
    expect(offered('Exported')).toEqual(['republish']);
    expect(offered('Cancelled')).toEqual(['republish']);
    expect(JOB_ACTIONS.every((a) => a.permission === 'publishing.update')).toBe(true);
    for (const s of FINAL_JOB_STATUSES) expect(offered(s)).toEqual(['republish']);
  });

  it('a failure needs a reason; the details change only before the export ran or after it failed', () => {
    expect(flow.jobs_complete_empty_fail.body.reason).toEqual(['This field is required.']);
    expect(flow.jobs_patch.status).toBe(200);
    expect(flow.jobs_patch_validated.status).toBe(409);
    expect(flow.jobs_patch_validated.body.error.code).toBe('job_not_editable');
    expect(flow.jobs2_patch_failed.status).toBe(200);
    expect(flow.jobs_patch_status.body.status).toEqual(['Cannot be set directly.']);
    expect(isJobEditable('Pending') && isJobEditable('Failed')).toBe(true);
    for (const s of ['Validating', 'Validated', 'Exporting', 'Exported', 'Cancelled']) expect(isJobEditable(s)).toBe(false);
  });

  it('validating with no rules configured passes with nothing checked', () => {
    expect(flow.jobs_validate.body).toMatchObject({ all_passed: true, counts: { passed: 0, failed: 0, warning: 0, not_checked: 0 }, validation_results: [] });
    expect(flow.jobs_detail_validated.body.validation_results.counts).toEqual({ failed: 0, not_checked: 0, passed: 0, warning: 0 });
    expect(flow.jobs_detail_pending.body.validation_results).toEqual({});
  });

  it('creating: a project, a tool, and a shot or asset (from a version) are needed', () => {
    expect(flow.jobs_create_empty.body.name).toBeTruthy();
    expect(flow.jobs_create_no_project.body.project_id).toEqual(['A project is required.']);
    expect(flow.jobs_create_unknown_project.body.project_id).toEqual(['Unknown project.']);
    expect(flow.jobs_create_foreign_project.body.project_id).toEqual(['Unknown project.']);
    expect(flow.jobs_create_unknown_version.body.version_id).toEqual(['Unknown version.']);
    expect(flow.jobs_create_bad_tool.status).toBe(400);
    expect(flow.jobs_create_blank_code.body.code).toMatch(/^PUB-/);
    expect(flow.jobs_create_duplicate_code.body.code).toEqual(['This code is already used.']);
    expect(flow.jobs_create_artist.status).toBe(403);
  });

  it('visibility: a stranger sees nothing; an artist reads and cannot write', () => {
    expect(flow.jobs_list_stranger.body.count).toBe(0);
    expect(flow.jobs_detail_stranger.status).toBe(404);
    expect(flow.jobs_detail_artist.status).toBe(200);
    for (const key of ['jobs_patch_artist', 'jobs_validate_artist']) expect(flow[key].status).toBe(403);
  });

  it('the job list filters nothing but search and ordering, and has no project route (CR-22)', () => {
    const base = flow.fp_jobs_baseline.body.count;
    for (const key of ['fp_jobs_by_status_Exported', 'fp_jobs_by_status_Failed', 'fp_jobs_by_job_status_Exported', 'fp_jobs_by_dcc_tool_Nuke', 'fp_jobs_by_entity_type_Shot', 'fp_jobs_by_nonsense_1']) expect(flow[key].body.count).toBe(base);
    expect(flow.fp_jobs_by_project_id_other.body.count).toBe(flow.fp_jobs_all.body.count);
    expect(flow.fp_jobs_by_search_Comp.body.count).toBeLessThan(base);
    expect(flow.jobs_project_route.status).toBe(404);
    expect(flow.jobs_list.body.results[0]).not.toHaveProperty('project');
    expect(flow.jobs_detail_pending.body).not.toHaveProperty('version_id');
  });

  it('delete: refused to a supervisor; the server deletes a job that has files, and in any status (CR-23)', () => {
    expect(flow.jobs3_delete_supervisor.status).toBe(403);
    expect(flow.jobs3_delete.status).toBe(204);
    expect(flow.jobs4_delete_with_file.status).toBe(204);
    expect(flow.jobs4_detail.status).toBe(404);
    expect(isJobDeletable('Pending') && isJobDeletable('Cancelled')).toBe(true);
    for (const s of ['Validating', 'Validated', 'Exporting', 'Exported', 'Failed']) expect(isJobDeletable(s)).toBe(false);
  });
});

describe('registering files', () => {
  it('a file is registered once; an identical retry is a 200, different content under the same path is a 409', () => {
    expect(flow.files_register.status).toBe(201);
    expect(flow.files_register_again.status).toBe(200);
    expect(flow.files_register_again.body.id).toBe(flow.files_register.body.id);
    for (const key of ['files_register_conflict', 'files_register_conflict_version']) {
      expect(flow[key].status).toBe(409);
      expect(flow[key].body.error.code).toBe('path_already_registered');
    }
  });

  it('only a published version of a project the caller is in; the root must be active; unknown keys are refused', () => {
    for (const key of ['files_register_unknown_version', 'files_register_unpublished_version', 'files_register_other_project_version']) expect(flow[key].body.version_id).toEqual(['Unknown or unpublished version.']);
    for (const key of ['files_register_unknown_root', 'files_register_inactive_root']) expect(flow[key].body.storage_root).toEqual(['Unknown or inactive storage root.']);
    expect(flow.files_register_unknown_field.body.status).toEqual(['Unknown field.']);
    expect(flow.files_register_unknown_file_type.body.file_type).toBeTruthy();
    expect(flow.files_register_bad_sha.body.sha256).toEqual(['64 hexadecimal characters.']);
    expect(flow.files_register_negative_size.status).toBe(400);
    expect(flow.files_register_bad_role.body.role[0]).toMatch(/main, proxy, sidecar, thumbnail/);
  });

  it('every unsafe path is refused, each naming the rule it broke', () => {
    const refused = Object.keys(flow).filter((k) => k.startsWith('files_register_path_'));
    expect(refused).toHaveLength(9);
    for (const key of refused) {
      expect(flow[key].status).toBe(400);
      expect(flow[key].body.relative_path).toHaveLength(1);
    }
  });

  it('a frame range needs both frames, a pattern in the path and an end after the start', () => {
    expect(flow.files_register_sequence.body).toMatchObject({ frame_start: 1001, frame_end: 1096 });
    expect(flow.files_register_frame_start_only.body.frame_end[0]).toMatch(/both frame_start and/i);
    expect(flow.files_register_frames_reversed.body.frame_end[0]).toMatch(/before frame_start/i);
    expect(flow.files_register_frames_without_pattern.body.relative_path[0]).toMatch(/needs a/i);
  });

  it('the registry has no edit and no delete', () => {
    for (const key of ['files_put', 'files_patch', 'files_delete']) expect(flow[key].status).toBe(405);
  });

  it('who may register: the supervisor and the producer; the artist and the lead may not', () => {
    expect(flow.files_register_supervisor.status).toBe(201);
    expect(flow.files_register_artist.status).toBe(403);
    expect(flow.files_bulk_artist.status).toBe(403);
  });

  it('bulk register answers per item, 200 when all succeed and 207 otherwise', () => {
    expect(flow.files_bulk_all.status).toBe(200);
    expect(flow.files_bulk_partial.status).toBe(207);
    expect(flow.files_bulk_partial.body.results.map((r: any) => r.ok)).toEqual([true, false, true]);
    expect(flow.files_bulk_partial.body.results[1]).toMatchObject({ error: 'invalid', index: 1 });
    expect(flow.files_bulk_partial.body.results[1].fields.relative_path).toBeTruthy();
    expect(flow.files_bulk_empty_list.status).toBe(400);
  });
});

describe('the file lifecycle', () => {
  it('Registered ⇄ Deprecated, and Revoked is final', () => {
    expect(flow.files_deprecate.body.status).toBe('Deprecated');
    expect(flow.files_restore.body.status).toBe('Registered');
    expect(flow.files_revoke.body.status).toBe('Revoked');
    expect(flow.files_deprecate_again.status).toBe(409);
    expect(flow.files_restore_again.status).toBe(409);
    expect(flow.files_revoke_again.status).toBe(409);
    expect(fileActionsFrom('Registered').map((a) => a.action)).toEqual(['deprecate', 'revoke']);
    expect(fileActionsFrom('Deprecated').map((a) => a.action)).toEqual(['restore', 'revoke']);
    expect(fileActionsFrom('Revoked')).toEqual([]);
  });

  it('leaving Revoked needs an override code that no role holds, even a superuser', () => {
    expect(flow.files_restore_revoked.body.override_reason).toBeTruthy();
    expect(flow.files_override_without_code.status).toBe(403);
    expect(flow.files_restore_admin.status).toBe(403);
    expect(flow.files_restore_admin.body.error.code).toBe('transition_not_permitted');
  });

  it('revoking needs a reason and publishing.revoke (supervisor and producer hold it, a lead and an artist do not); deprecating needs publishing.deprecate', () => {
    expect(flow.files_revoke_empty.body.reason).toEqual(['This field is required.']);
    expect(flow.files_revoke_supervisor.status).toBe(200);
    for (const key of ['files_revoke_lead', 'files_revoke_artist', 'files_deprecate_artist']) expect(flow[key].status).toBe(403);
  });

  it('the reason for a revocation is for those who may revoke', () => {
    expect(flow.files_detail_revoked.body.revoke_reason).toBe('Wrong plate');
    expect(flow.files_detail_revoked_artist.body.revoke_reason).toBe('');
  });

  it('visibility: a stranger sees no files', () => {
    expect(flow.files_list_stranger.body.count).toBe(0);
    expect(flow.files_detail_stranger.status).toBe(404);
  });

  it('the files list filters by project, status, role and version, and can show the latest of each role', () => {
    const base = flow.fp_files_baseline.body.count;
    expect(flow.fp_files_by_project_id_other.body.count).toBe(0);
    expect(flow.fp_files_by_status_Revoked.body.count).toBeGreaterThan(0);
    expect(flow.fp_files_by_status_Revoked.body.results.every((r: any) => r.status === 'Revoked')).toBe(true);
    expect(flow.fp_files_by_role_proxy.body.results.every((r: any) => r.role === 'proxy')).toBe(true);
    expect(flow.fp_files_by_latest_true.body.count).toBeLessThan(base);
    const versionKey = Object.keys(flow).find((k) => k.startsWith('fp_files_by_version_id_'))!;
    expect(flow[versionKey].body.count).toBeLessThan(base);
    expect(flow.fp_files_by_nonsense_1.body.count).toBe(base);
    expect(flow.fp_files_by_search_plate.body.count).toBe(base); // there is no search on files
  });
});

describe('storage roots and destinations', () => {
  it('only a platform administrator manages storage roots; everyone with publishing.view reads them', () => {
    for (const key of ['roots_create_artist', 'roots_create_supervisor', 'roots_create_producer', 'roots_patch_supervisor']) expect(flow[key].status).toBe(403);
    expect(flow.roots_create.status).toBe(201);
    expect(flow.roots_artist_list.status).toBe(200);
  });

  it('a code is unique in any case and fixed once files use it; a root with files is retired, not deleted', () => {
    expect(flow.roots_create_bad_code.body.code[0]).toMatch(/Use letters, digits/);
    expect(flow.roots_create_duplicate.body.code).toEqual(['This code is already used.']);
    expect(flow.roots_patch_code.body.code[0]).toMatch(/Cannot be changed/);
    expect(flow.roots_delete_with_files.status).toBe(400); // a 400, not a 409
    expect(String(flow.roots_delete_with_files.body.detail)).toMatch(/Retire it instead/);
    expect(flow.roots_deactivate_second.body.is_active).toBe(false);
    expect(flow.roots_delete_empty.status).toBe(204);
  });

  it('destinations: a name is unique in any case, a new default moves the old one, a protocol is required, the type is not checked (CR-24)', () => {
    expect(flow.destinations_create_empty.body.protocol).toBeTruthy();
    expect(flow.destinations_create_duplicate.body.name[0]).toMatch(/already exists/);
    expect((flow.destinations_list.body.results as any[]).filter((r) => r.is_default)).toHaveLength(1);
    expect(flow.destinations_create_bad_type.status).toBe(201); // "S3" is not one of the seven types
    expect(flow.destinations_artist_create.status).toBe(403);
    expect(flow.destinations_supervisor_create.status).toBe(201);
    expect(flow.destinations_supervisor_delete.status).toBe(403);
  });
});
