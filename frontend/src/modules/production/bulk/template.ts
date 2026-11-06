import { catalogApi } from '@/api/masterdata/catalog';
import { BULK_MAX_ITEMS } from '@/api/production/bulkRoutes';
import { episodesApi, sequencesApi } from '@/api/production/structure';
import { assetsApi, shotsApi } from '@/api/production/work';
import { fetchAllRows } from '@/shared/data/listing';
import type { SheetRow } from './rows';
import type { BulkColumn, BulkSpec, TemplateParents } from './specs';

/**
 * "Load template" of the bulk dialog (CR-48). On a create it fills the grid with example rows whose parents are real
 * codes of the project (its first episode, sequence, shot or asset) and of the catalog (its first asset or task type),
 * so the example passes the check as it is. On an update it loads the project's current rows, parents written by code.
 */
const EXAMPLES = 3;

type Row = Record<string, unknown>;
const first = (rows: Promise<{ results: object[] }>) => optional(rows.then((page) => page.results[0] as Row | undefined));
/** A lookup the caller may not be allowed (the catalog, say) leaves its cells empty instead of failing the template. */
const optional = <T>(lookup: Promise<T>): Promise<T | undefined> => lookup.catch(() => undefined);
const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));

/** Episode id → code of an episodic project; empty for a standard one (it has no episodes, CR-47). */
async function episodeCodes(projectId: string, episodic: boolean, signal?: AbortSignal): Promise<Map<string, string>> {
  if (!episodic) return new Map();
  const episodes = (await fetchAllRows(episodesApi.list, { project: projectId, page_size: BULK_MAX_ITEMS }, { signal })) as unknown as Row[];
  return new Map(episodes.map((e) => [text(e.id), text(e.code)]));
}

export async function templateParents(spec: BulkSpec, projectId: string, episodic: boolean, signal?: AbortSignal): Promise<TemplateParents> {
  const needs = new Set(spec.template.needs);
  const one = { project: projectId, page_size: 1 };
  const [episodes, sequence, shot, asset, assetTypes, taskTypes] = await Promise.all([
    optional(episodeCodes(projectId, episodic && (needs.has('episode') || needs.has('sequence')), signal)).then((codes) => codes ?? new Map<string, string>()),
    needs.has('sequence') ? first(sequencesApi.list(one, signal)) : undefined,
    needs.has('shot') ? first(shotsApi.list(one, signal)) : undefined,
    needs.has('asset') ? first(assetsApi.list(one, signal)) : undefined,
    needs.has('assetType') ? optional(catalogApi('asset-types').list({ status: 'active' }, signal)) : undefined,
    needs.has('taskType') ? optional(catalogApi('task-types').list({ status: 'active' }, signal)) : undefined,
  ]);
  return {
    episode: episodes.values().next().value,
    sequence: sequence ? text(sequence.code) : undefined,
    sequenceEpisode: sequence ? episodes.get(text(sequence.episode_id)) : undefined,
    shot: shot ? text(shot.code) : undefined,
    asset: asset ? text(asset.code) : undefined,
    assetType: assetTypes?.[0]?.code,
    taskType: taskTypes?.[0]?.code,
  };
}

/** The example rows, limited to `columns` (no episode column on a standard project). */
export function exampleRows(spec: BulkSpec, columns: readonly BulkColumn[], parents: TemplateParents): SheetRow[] {
  return Array.from({ length: EXAMPLES }, (_, index) => {
    const example = spec.template.example(index + 1, parents);
    return Object.fromEntries(columns.map((c) => [c.header, example[c.header] ?? '']));
  });
}

export interface CurrentRows {
  rows: SheetRow[];
  /** How many the project has; more than `rows` when it has over 500. */
  total: number;
}

/** The project's rows as the update columns hold them: values as they are, parents by code. */
export async function currentRows(spec: BulkSpec, columns: readonly BulkColumn[], projectId: string, episodic: boolean, signal?: AbortSignal): Promise<CurrentRows> {
  const [page, episodes] = await Promise.all([
    spec.list({ project: projectId, page_size: BULK_MAX_ITEMS }, signal),
    episodeCodes(projectId, episodic && columns.some((c) => c.episodic), signal),
  ]);
  const rows = (page.results as Row[]).map((row) =>
    Object.fromEntries(
      columns.map((c) => [c.header, c.episodic ? (episodes.get(text(row[c.key])) ?? '') : text(row[c.codeFrom ?? c.key])])
    )
  );
  return { rows, total: page.count };
}
