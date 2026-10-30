import type { ListParams, PageFetcher, ParamValue } from './listing';

/**
 * A rule decides whether a row passes the filter's chosen value. Blank values are never offered to a rule.
 */
export type ClientFilterRule<T> = (row: T, value: string) => boolean;

/**
 * For list routes that ignore a filter (CR-25): `rules` names the filters the server does not honour. Those
 * parameters are not sent, the rows are narrowed here, and the count is the narrowed length. The routes involved
 * return a bare array (one page), so nothing is lost by narrowing after the fetch. Every other parameter (search,
 * ordering, the filters the server does honour) goes to the server unchanged.
 */
export function withClientFilters<T>(fetchPage: PageFetcher<T>, rules: Record<string, ClientFilterRule<T>>): PageFetcher<T> {
  return async (params, signal) => {
    const sent: ListParams = { ...params };
    const chosen: Array<[string, string]> = [];
    for (const key of Object.keys(rules)) {
      const value: ParamValue = sent[key];
      delete sent[key];
      if (value !== undefined && value !== null && String(value) !== '') chosen.push([key, String(value)]);
    }
    const page = await fetchPage(sent, signal);
    if (chosen.length === 0) return page;
    const results = page.results.filter((row) => chosen.every(([key, value]) => rules[key](row, value)));
    return { ...page, count: results.length, results };
  };
}
