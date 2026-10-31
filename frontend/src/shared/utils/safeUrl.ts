/**
 * The address to put in a link's `href`, or `undefined` when it is not a plain web address. A stored URL is
 * data someone typed: `javascript:` or `data:` in an `href` would run in this page. The API only stores
 * http(s)/ftp URLs, so this is the second check, at the place the value becomes a link.
 */
export function safeWebUrl(value: string | null | undefined): string | undefined {
  const text = (value ?? '').trim();
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? text : undefined;
  } catch {
    return undefined;
  }
}
