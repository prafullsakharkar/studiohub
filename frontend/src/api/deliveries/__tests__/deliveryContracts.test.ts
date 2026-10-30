import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { DELIVERY_ACTIONS, deliveryActionsFrom, isDeletable, isEditable, requiredPermission } from '../deliveryFlow';
import { DELIVERY_STATUSES, deliveryStatusLabel } from '../deliveries';
import * as K from '../deliveryRowKeys';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('deliveries/_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const bareItems = (c: Captured) => c.body.items as any[];

describe('delivery row types match the captured responses', () => {
  it.each([
    ['DeliveryRow', flow.list.body.results.find((r: any) => 'client_name' in r), K.DELIVERYROW_KEYS],
    ['Delivery (the detail)', flow.detail_submitted.body, K.DELIVERY_KEYS],
    ['DeliveryItem', flow.detail_submitted.body.versions[0], K.DELIVERYITEM_KEYS],
    ['DeliveryItemFile', flow.detail_submitted.body.versions[0].files[0], K.DELIVERYITEMFILE_KEYS],
    ['DeliveryStatusChange', bareItems(flow.history_complete)[0], K.DELIVERYSTATUSCHANGE_KEYS],
    ['DeliveryQCCheck', bareItems(flow.qc_passed)[0], K.DELIVERYQCCHECK_KEYS],
    ['DeliveryDestination', flow.destinations_detail.body, K.DELIVERYDESTINATION_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row)).toEqual(keys(expected));
  });

  it('the list and the detail answer the same shape from every route that lists deliveries', () => {
    expect(keys(flow.project_route.body.results.find((r: any) => 'client_name' in r))).toEqual(keys(K.DELIVERYROW_KEYS));
    expect(keys(flow.create.body)).toEqual(['client_id', 'client_notes', 'code', 'delivery_destination', 'delivery_method', 'destination_id', 'expires_at', 'id', 'name', 'notes', 'project_id']); // create answers its own, smaller shape
  });

  it('client_name is absent, not empty, when a delivery has no client', () => {
    const without = flow.list.body.results.find((r: any) => !('client_name' in r));
    expect(without).toBeTruthy();
    expect(keys(without)).toEqual(keys(K.DELIVERYROW_KEYS).filter((k) => k !== 'client_name'));
  });

  it('history and QC are bare arrays (not paginated)', () => {
    expect(flow.history_complete.body._bare_list).toBe(true);
    expect(flow.qc_passed.body._bare_list).toBe(true);
  });
});

describe('statuses', () => {
  it('every status a read showed is one the screens know; history rows word two of them differently', () => {
    const seen = new Set<string>();
    for (const [key, c] of Object.entries(flow)) if (key.startsWith('detail_') && c.status === 200) seen.add(c.body.status);
    for (const s of seen) expect(DELIVERY_STATUSES).toContain(s);
    const history = new Set(bareItems(flow.history_complete).flatMap((r) => [r.from_status, r.to_status]).filter(Boolean));
    expect(history.has('Prepared')).toBe(true);
    expect(deliveryStatusLabel('Prepared')).toBe('Ready');
    expect(deliveryStatusLabel('Complete')).toBe('Completed');
    expect(deliveryStatusLabel('Draft')).toBe('Draft');
  });
});

describe('the lifecycle and who may drive it', () => {
  it('each action moved the delivery the way the flow table says', () => {
    expect(flow.validate.body.status).toBe('Validating');
    expect(flow.prepare.body.status).toBe('Ready');
    expect(flow.sign_off.body.status).toBe('Signed Off');
    expect(flow.reopen_supervisor.body.status).toBe('Ready');
    expect(flow.submit.body.status).toBe('Submitted');
    expect(flow.approve.body.status).toBe('Approved');
    expect(flow.complete.body.status).toBe('Completed');
    expect(flow.reject.body.status).toBe('Rejected');
    expect(flow.revise.body.status).toBe('Draft');
    expect(flow.revise.body.revision_of).toBeTruthy();
    expect(flow.cancel.body.status).toBe('Cancelled');
  });

  it('an action the status does not allow is a 409 invalid_transition with from and to', () => {
    for (const key of ['sign_off_draft', 'submit_before_sign_off', 'submit_again', 'sign_off_again', 'cancel_again', 'cancel_submitted', 'complete_submitted', 'reject_approved']) {
      expect(flow[key].status).toBe(409);
      expect(flow[key].body.code).toBe('invalid_transition');
      expect(flow[key].body).toHaveProperty('from');
      expect(flow[key].body).toHaveProperty('to');
    }
  });

  it('who may do what: sign-off and reopen need delivery.approve; send, the client’s answer and revise need delivery.send', () => {
    expect(flow.sign_off_lead.status).toBe(403); // view only
    expect(flow.reopen_supervisor.status).toBe(200); // a supervisor holds delivery.approve
    expect(flow.submit_supervisor.status).toBe(403); // but not delivery.send
    expect(flow.approve_supervisor.status).toBe(403);
    expect(flow.revise_supervisor.status).toBe(403);
    expect(flow.prepare_artist.status).toBe(403);
    expect(flow.cancel_lead.status).toBe(403);
    expect(flow.bulk_cancel_lead.status).toBe(403);
  });

  it('the preparer cannot sign off, and a reason does not change that (the override code is held by no role)', () => {
    for (const key of ['sign_off_preparer', 'sign_off_override_without_code']) {
      expect(flow[key].status).toBe(403);
      expect(flow[key].body.error.code).toBe('separation_of_duties');
    }
    expect(flow.sign_off.status).toBe(200); // someone else
  });

  it('the action table agrees with the server: the permission and the status each action succeeded from', () => {
    const offered = (action: string, status: string) => deliveryActionsFrom(status).some((a) => a.action === action);
    expect(offered('validate', 'Draft')).toBe(true);
    expect(offered('prepare', 'Draft') && offered('prepare', 'Validating')).toBe(true);
    expect(offered('signOff', 'Ready')).toBe(true);
    expect(offered('signOff', 'Draft')).toBe(false);
    expect(offered('submit', 'Ready')).toBe(false); // sending needs the sign-off first
    expect(offered('submit', 'Signed Off')).toBe(true);
    expect(offered('approve', 'Submitted') && offered('reject', 'Submitted')).toBe(true);
    expect(offered('complete', 'Approved')).toBe(true);
    expect(offered('revise', 'Rejected')).toBe(true);
    expect(deliveryActionsFrom('Completed')).toEqual([]);
    expect(deliveryActionsFrom('Cancelled')).toEqual([]);
    expect(deliveryActionsFrom('Submitted').some((a) => a.action === 'cancel')).toBe(false); // 409 on a sent delivery
    const byName = Object.fromEntries(DELIVERY_ACTIONS.map((a) => [a.action, a.permission]));
    expect(byName).toMatchObject({ signOff: 'delivery.approve', reopen: 'delivery.approve', submit: 'delivery.send', approve: 'delivery.send', reject: 'delivery.send', revise: 'delivery.send', prepare: 'delivery.update', cancel: 'delivery.update' });
    const cancel = DELIVERY_ACTIONS.find((a) => a.action === 'cancel')!;
    expect(requiredPermission(cancel, 'Signed Off')).toBe('delivery.approve');
    expect(requiredPermission(cancel, 'Draft')).toBe('delivery.update');
  });

  it('a rejection needs a reason (reason or rejection_reason); both spellings of a note at once are refused; a client approval keeps client_notes', () => {
    expect(flow.reject_empty.status).toBe(400);
    expect(flow.reject_empty.body.rejection_reason).toEqual(['This field is required.']);
    expect(flow.reject.status).toBe(200);
    expect(flow.reject.body.rejection_reason).toBe('Colour is off in reel 2');
    expect(flow.approve_both_spellings.status).toBe(400);
    expect(flow.approve.body.client_notes).toBe('Client accepted by email');
    expect(flow.cancel.body.cancellation_reason).toBe('Client postponed');
  });

  it('send records the transfer reference and answers the action shape, not the detail', () => {
    expect(flow.submit.body).toMatchObject({ success: true, status: 'Submitted' });
    expect(flow.submit.body.submission_result.transfer_reference).toBe('ASPERA-1');
    expect(flow.detail_submitted.body.sent_at).toBeTruthy();
    expect(flow.detail_submitted.body.transfer_reference).toBe('ASPERA-1');
  });

  it('a revision is a new Draft with the same versions and says what could not be carried over', () => {
    expect(flow.revise.status).toBe(201);
    expect(flow.revise.body.skipped_versions).toEqual([]);
    expect(flow.revise.body.versions).toHaveLength(1);
    expect(flow.revise_again.status).toBe(409);
    expect(flow.revise_again.body.error.code).toBe('already_revised');
  });
});

describe('items and checks', () => {
  it('only a published version of the delivery’s project with registered files can be added; the reason comes back as a code', () => {
    expect(flow.add_first.status).toBe(201);
    expect(flow.add_unpublished.body.reason).toEqual(['not_published']);
    expect(flow.add_no_files.body.reason).toEqual(['no_registered_files']);
    expect(flow.add_other_project.body.reason).toEqual(['unknown_version']);
    expect(flow.add_again.status).toBe(400);
    expect(flow.add_first.body.versions[0].file_path).not.toBe('ignored'); // snapshot keys in the body are ignored
  });

  it('removing needs item_id (the uid); a checked item can be removed, which clears the checks until they run again (CR-20, applied)', () => {
    expect(flow.remove_empty.status).toBe(400);
    expect(flow.remove_second.status).toBe(200);
    expect(flow.qcremove_validate.status).toBe(200);
    expect(flow.qcremove_remove.status).toBe(200);
    expect(flow.qcremove_detail.body.versions).toHaveLength(0);
    expect(flow.qcremove_qc.body.items).toEqual([]);
    expect(flow.qcremove_prepare.status).toBe(409); // an empty delivery cannot be prepared
    expect(flow.qcremove_prepare.body.checks[0].check).toBe('has_items');
  });

  it('a failed check on prepare is a 409 qc_failed listing the checks, and the run is kept', () => {
    expect(flow.prepare_qc_failed.status).toBe(409);
    expect(flow.prepare_qc_failed.body.code).toBe('qc_failed');
    expect(flow.prepare_qc_failed.body.checks[0]).toMatchObject({ check: 'checksum_ok' });
    expect(bareItems(flow.qc_failed).some((c) => c.outcome === 'fail')).toBe(true);
    expect(bareItems(flow.qc_passed).every((c) => c.outcome !== 'fail')).toBe(true);
  });

  it('validate answers per-item results with the checks', () => {
    expect(flow.validate.body.all_valid).toBe(true);
    expect(flow.validate.body.validation_results[0].checks.map((c: any) => c.check)).toEqual(expect.arrayContaining(['same_project', 'version_published', 'files_present', 'checksum_ok']));
  });

  it('a sent delivery freezes its files', () => {
    expect(flow.detail_prepared.body.versions[0].files[0].frozen_at).toBeNull();
    expect(flow.detail_submitted.body.versions[0].files[0].frozen_at).toBeTruthy();
    expect(flow.patch_signed_off.status).toBe(409);
    expect(flow.patch_signed_off.body.error.code).toBe('delivery_not_editable');
  });
});

describe('creating and editing', () => {
  it('a project is required, unknown and foreign ones read alike, the client must exist, a code is server-made when blank', () => {
    expect(flow.create_no_project.body.project_id).toEqual(['A project is required.']);
    expect(flow.create_unknown_project.body.project_id).toEqual(['Unknown project.']);
    expect(flow.create_foreign_project.body.project_id).toEqual(['Unknown project.']);
    expect(flow.create_unknown_client.body.client_id).toEqual(['Unknown client.']);
    expect(flow.create_blank_code.body.code).toMatch(/^DLV-/);
    expect(flow.create_duplicate_code.status).toBe(400);
    expect(flow.create_lead.status).toBe(403);
  });

  it('status is read-only; a free destination text is refused while a destination is chosen', () => {
    expect(flow.patch_status.body.status).toEqual(['Cannot be set directly.']);
    expect(flow.create_destination_text_mismatch.status).toBe(400);
    expect(flow.patch_notes.status).toBe(200);
    expect(flow.patch_lead.status).toBe(403);
  });
});

describe('visibility and the passcode', () => {
  it('a stranger sees nothing: lists are empty, ids are 404, the passcode is 403', () => {
    expect(flow.list_stranger.body.count).toBe(0);
    expect(flow.detail_stranger.status).toBe(404);
    expect(flow.history_stranger.status).toBe(404);
    expect(flow.project_route_stranger.status).toBe(404);
  });

  it('the detail never carries the passcode; holders of delivery.view_secret read it from its own route', () => {
    expect(flow.detail_draft.body).not.toHaveProperty('passcode');
    expect(flow.detail_draft.body.has_passcode).toBe(true);
    expect(flow.passcode_view.status).toBe(200);
    expect(flow.passcode_view.body).toHaveProperty('passcode');
    for (const key of ['passcode_supervisor', 'passcode_artist', 'passcode_stranger']) expect(flow[key].status).toBe(403);
  });
});

describe('lists', () => {
  it('the list filters by status (read or stored words), client, project, destination and method (CR-17, applied); search still narrows too', () => {
    const base = flow.fp_deliveries_baseline.body.count;
    const statusesOf = (key: string) => flow[key].body.results.map((r: any) => r.status);
    expect(flow.fp_deliveries_by_status_Ready.body.count).toBe(1);
    expect(statusesOf('fp_deliveries_by_status_Ready')).toEqual(['Ready']);
    expect(flow.fp_deliveries_by_status_Prepared.body.count).toBe(1); // the stored word
    expect(flow.fp_deliveries_by_status_ready.body.count).toBe(1); // any case
    expect(statusesOf('fp_deliveries_by_status_Completed')).toEqual(['Completed']);
    expect(statusesOf('fp_deliveries_by_status_Cancelled').every((s: string) => s === 'Cancelled')).toBe(true);
    expect(flow.fp_deliveries_by_status_Bogus.body.count).toBe(0);
    const clientKey = Object.keys(flow).find((k) => k.startsWith('fp_deliveries_by_client_id_'))!;
    expect(flow[clientKey].body.count).toBeLessThan(base);
    expect(flow.fp_deliveries_by_client_status_Approved.body.count).toBe(1);
    const destinationKey = Object.keys(flow).find((k) => k.startsWith('fp_deliveries_by_destination_id_'))!;
    expect(flow[destinationKey].body.count).toBeLessThan(base);
    expect(flow.fp_deliveries_by_project_id_other.body.count).toBeLessThan(flow.fp_deliveries_all_projects.body.count);
    expect(flow.fp_deliveries_by_nonsense_1.body.count).toBe(base); // an unknown parameter is still ignored
    expect(flow.fp_deliveries_by_search_Reel.body.count).toBeLessThan(base);
  });

  it('a project’s deliveries come from the project route, which is paginated, searchable and scoped', () => {
    expect(flow.project_route.body).toHaveProperty('count');
    expect(flow.project_route_slash.body.count).toBe(flow.project_route.body.count);
    expect(flow.project_route_search.body.count).toBeLessThan(flow.project_route.body.count);
    expect(flow.project_route_other.status).toBe(404);
    expect(flow.project_route_status.body.results.every((r: any) => r.status === 'Cancelled')).toBe(true); // it takes the same filters
  });
});

describe('bulk cancel and delete', () => {
  it('bulk cancel answers 200 when all succeed and 207 otherwise, per id', () => {
    expect(flow.bulk_cancel_all.status).toBe(200);
    expect(flow.bulk_cancel_all.body).toMatchObject({ success: true, failed_count: 0 });
    expect(flow.bulk_cancel_partial.status).toBe(207);
    expect(flow.bulk_cancel_partial.body.results.map((r: any) => r.error)).toEqual([null, 'invalid_transition', 'not_found']);
    expect(flow.bulk_cancel_empty.status).toBe(400);
  });

  it('only a Draft or a Cancelled delivery can be deleted (CR-18, applied); the screens offer the same', () => {
    expect(flow.delete_cancelled.status).toBe(204);
    expect(flow.delete_draft.status).toBe(204);
    for (const key of ['delete_submitted', 'delete_complete']) {
      expect(flow[key].status).toBe(409);
      expect(flow[key].body.error.code).toBe('delivery_not_editable');
    }
    expect(flow.delete_complete_gone.status).toBe(200); // still there
    expect(flow.delete_supervisor.status).toBe(403);
    expect(isDeletable('Draft') && isDeletable('Cancelled')).toBe(true);
    for (const s of ['Validating', 'Ready', 'Signed Off', 'Submitted', 'Approved', 'Rejected', 'Completed']) expect(isDeletable(s)).toBe(false);
    expect(isEditable('Ready') && isEditable('Draft') && isEditable('Validating')).toBe(true);
    expect(isEditable('Signed Off')).toBe(false);
  });
});

describe('destinations', () => {
  it('a name is unique in any case, a new default moves the old one, and the type must be one of the seven (CR-19, applied)', () => {
    expect(flow.destinations_create_duplicate.status).toBe(400);
    expect(flow.destinations_create_duplicate.body.name).toBeTruthy();
    const rows = flow.destinations_list.body.results as any[];
    expect(rows.filter((r) => r.is_default)).toHaveLength(1);
    expect(flow.destinations_create_bad_type.status).toBe(400);
    expect(String(flow.destinations_create_bad_type.body.type)).toContain('Must be one of: Aspera Connect');
    expect(flow.destinations_create.body.type).toBe('AWS S3 Bucket');
    expect(flow.destinations_artist_create.status).toBe(403);
    expect(flow.destinations_artist_list.status).toBe(200);
    expect(flow.destinations_supervisor_delete.status).toBe(403);
  });
});

describe('names beside ids (CR-21, applied)', () => {
  it('history, checks and the detail say who, and a nobody is an empty name', () => {
    expect(bareItems(flow.history_complete).every((r) => typeof r.actor_name === 'string' && r.actor_name.length > 0)).toBe(true);
    expect(bareItems(flow.qc_passed).every((c) => typeof c.checked_by_name === 'string' && c.checked_by_name.length > 0)).toBe(true);
    expect(flow.detail_complete.body.signed_off_by_name).toMatch(/@/);
    expect(flow.detail_draft.body.signed_off_by_name).toBe('');
    expect(flow.detail_draft.body.client_answered_by_name).toBe('');
  });
});
