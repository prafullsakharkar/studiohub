import { describe, expect, it } from 'vitest';
import { normalizeApiError } from '@/api/errors/normalizeApiError';
import { loadSample } from '@/test/samples';
import type { ReviewColourOptions, Version } from '../review';
import * as K from '../reviewRowKeys';
import { PROJECT_KEYS } from '../structureRowKeys';

/**
 * Colour management for review copies (RP-15, docs/review-pipeline/CONTRACTS.md C-RP-39 and C-RP-40), pinned to the
 * capture made with a real ffmpeg and the built-in ACES 2.0 config: docs/sync/samples/production/_review_colour_flow.json.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_colour_flow.json');
const keys = (o: object) => Object.keys(o).sort();
const options = flow.colour_options.body as ReviewColourOptions;
const sequence = flow.version_sequence_ocio.body as Version;
const named = flow.version_movie_ocio.body as Version;
const plain = flow.version_movie_as_stored.body as Version;
const unmanaged = flow.version_sequence_unmanaged.body as Version;
const SDR = 'ACES 2.0 - SDR 100 nits (Rec.709)';

describe('C-RP-39: what the studio’s config offers, and a project’s colour settings', () => {
  it.each([
    ['ReviewColourOptions', options, K.REVIEWCOLOUROPTIONS_KEYS],
    ['ReviewColourOptions (config unreadable)', flow.colour_options_unavailable.body, K.REVIEWCOLOUROPTIONS_KEYS],
    ['ReviewColourSpace', options.color_spaces[0], K.REVIEWCOLOURSPACE_KEYS],
    ['Project', flow.project_default.body, PROJECT_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row as object)).toEqual(keys(expected));
  });

  it('lists the sRGB display’s views, the looks and the scene-referred colour spaces with their aliases', () => {
    expect(options).toMatchObject({ available: true, config: 'studio-config-v5.0.0_aces-v2.1_ocio-v2.6', display: 'sRGB - Display', default_view: SDR });
    expect(options.views).toContain(SDR);
    expect(options.looks).toEqual(['ACES 1.3 Reference Gamut Compression']);
    const acescg = options.color_spaces.find((s) => s.name === 'ACEScg');
    expect(acescg).toMatchObject({ encoding: 'scene-linear' });
    expect(acescg?.aliases).toContain('lin_ap1');
  });

  it('says when the config cannot be read, with nothing to choose', () => {
    expect(flow.colour_options_unavailable.body).toEqual({ available: false, config: null, display: null, default_view: null, views: [], looks: [], color_spaces: [] });
  });

  it('a project starts with ACEScg, the default view and no look; an alias is stored as the config names it', () => {
    expect(flow.project_default.body).toMatchObject({ color_space: 'ACEScg', review_view: '', review_look: '' });
    expect(flow.project_alias_200.status).toBe(200);
    expect(flow.project_alias_200.body.color_space).toBe('ACEScg');
    expect(flow.project_view_200.body).toMatchObject({ review_view: 'Un-tone-mapped', review_look: '' });
  });

  it('unknown names are refused on their fields, each with its sentence', () => {
    const error = normalizeApiError(400, flow.project_bad_400.body);
    expect(error.fieldErrors).toEqual({
      color_space: ["The studio's colour config has no colour space named 'ACEScg 1.3'."],
      review_view: ["The studio's colour config has no view named 'Cinema' for sRGB - Display."],
      review_look: ["The studio's colour config has no look named 'Warm'."],
    });
    expect(flow.project_unavailable_400.body.review_view).toEqual(["The studio's colour config cannot be read, so colour settings cannot be changed now."]);
  });
});

describe('C-RP-40: how a copy’s colour is made', () => {
  it.each([
    ['ReviewMedia', sequence.review_media, K.REVIEWMEDIA_KEYS],
    ['ReviewMediaProbe', sequence.review_media?.probe, K.REVIEWMEDIAPROBE_KEYS],
    ['ReviewMediaColour', sequence.review_media?.probe?.ocio, K.REVIEWMEDIACOLOUR_KEYS],
    ['ReviewMediaProbe (not transformed)', plain.review_media?.probe, K.REVIEWMEDIAPROBE_KEYS],
    ['ReviewCopies', flow.copies_other_view.body, K.REVIEWCOPIES_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row as object)).toEqual(keys(expected));
  });

  it('EXR frames go through the project’s view; the probe names the config, never a path', () => {
    expect(sequence.review_media?.probe).toMatchObject({ colour: 'ocio', colour_skipped: null });
    expect(sequence.review_media?.probe?.ocio).toEqual({ config: 'studio-config-v5.0.0_aces-v2.1_ocio-v2.6', input: 'ACEScg', display: 'sRGB - Display', view: SDR, look: '' });
    expect(sequence.review_media?.color_space).toBe('');
  });

  it('a movie is shown as stored unless its upload names a colour space', () => {
    expect(plain.review_media?.probe).toMatchObject({ colour: 'as_stored', ocio: null, colour_skipped: null });
    expect(flow.movie_named_202.body.color_space).toBe('ACEScct');
    expect(named.review_media?.probe).toMatchObject({ colour: 'ocio', ocio: { input: 'ACEScct' } });
  });

  it('an upload naming a colour space the config does not know is refused', () => {
    expect(flow.movie_bad_colour_400.body.color_space).toEqual(["The studio's colour config has no colour space named 'Kodak 2383'."]);
    expect(flow.sequence_bad_colour_400.body.color_space).toEqual(["The studio's colour config has no colour space named 'Kodak 2383'."]);
  });

  it('without a readable config a copy is still made, by the linear-to-sRGB rule, saying why', () => {
    expect(unmanaged.review_media?.probe).toMatchObject({ colour: 'srgb_from_linear', ocio: null, colour_skipped: 'colour_config_unavailable' });
  });

  it('another view: the sequence and the named movie differ; the movie is remade, the sequence cannot be', () => {
    expect(flow.copies_matching.body).toEqual({ review_burn_ins: false, out_of_date: 0, sequences_out_of_date: 0, colour_out_of_date: 0 });
    expect(flow.copies_other_view.body).toEqual({ review_burn_ins: false, out_of_date: 1, sequences_out_of_date: 1, colour_out_of_date: 2 });
    expect(flow.remake_all_200.body).toEqual({ queued: 1, skipped_busy: 0, skipped_sequence: 1, skipped_missing: 0 });
    expect(flow.copies_after_remake.body).toEqual({ review_burn_ins: false, out_of_date: 0, sequences_out_of_date: 1, colour_out_of_date: 1 });
    const remade = (flow.version_movie_remade.body as Version).review_media;
    expect(remade?.probe?.ocio).toMatchObject({ input: 'ACEScct', view: 'Un-tone-mapped' });
    expect(remade?.color_space).toBe('ACEScct');
  });
});
