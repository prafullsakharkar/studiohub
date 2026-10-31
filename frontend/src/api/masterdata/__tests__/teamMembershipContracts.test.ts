import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { TEAM_MEMBERSHIP_KEYS } from '../directoryRowKeys';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('masterdata/_team_memberships_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const typed = keys(TEAM_MEMBERSHIP_KEYS);

describe('team membership row type matches the captured responses', () => {
  it.each(['add_ada_to_comp', 'detail'])('%s has exactly the typed fields', (name) => {
    expect(keys(flow[name].body)).toEqual(typed);
  });

  it.each(['list_admin', 'list_as_artist', 'list_of_team', 'list_of_person', 'list_search_ada', 'list_of_grace'])('every row of %s has exactly the typed fields', (name) => {
    expect(flow[name].body.results.length).toBeGreaterThan(0);
    for (const row of flow[name].body.results) expect(keys(row)).toEqual(typed);
  });
});

describe('the rules the screens rely on', () => {
  it('a person is in two teams of different departments, and a reader may list them', () => {
    expect(flow.add_ada_to_comp.status).toBe(201);
    expect(flow.add_ada_to_lighting.status).toBe(201);
    expect(flow.list_of_person.body.results.map((r: any) => r.team_name).sort()).toEqual(['Comp A', 'Lighting A']);
    expect(flow.list_as_artist.status).toBe(200);
  });

  it('refuses a duplicate, an unknown person, a non-manager, an edit, and deleting a team that has members', () => {
    expect(flow.add_duplicate_400.status).toBe(400);
    expect(flow.add_duplicate_400.body.person[0]).toMatch(/already a member/);
    expect(flow.add_unknown_person_400.status).toBe(400);
    expect(flow.add_as_artist_403.status).toBe(403);
    expect(flow.remove_as_artist_403.status).toBe(403);
    expect(flow.patch_405.status).toBe(405);
    expect(flow.delete_team_with_members_409.body.error.code).toBe('has_dependants');
  });

  it('removing is a 204 and the person can join again; restoring the old row is refused', () => {
    expect(flow.remove_ok.status).toBe(204);
    expect(flow.list_of_team_after_removal.body.count).toBe(1);
    expect(flow.add_again_ok.status).toBe(201);
    expect(flow.restore_refused_409.status).toBe(409);
  });

  it('the primary team keeps a membership, and the people filter by team is the primary team only', () => {
    expect(flow.list_of_grace.body.results.map((r: any) => r.team_name).sort()).toEqual(['Comp A', 'Lighting A']);
    expect(flow.people_filter_by_team_is_primary_only.body.count).toBe(0);
  });
});
