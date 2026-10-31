import { describe, expect, it } from 'vitest';
import { safeWebUrl } from '../safeUrl';

describe('safeWebUrl', () => {
  it('keeps http and https addresses', () => {
    expect(safeWebUrl('https://example.test/path?x=1')).toBe('https://example.test/path?x=1');
    expect(safeWebUrl('  http://example.test ')).toBe('http://example.test');
  });
  it('refuses anything that would run or download in this page', () => {
    for (const value of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'file:///etc/passwd', 'ftp://example.test']) {
      expect(safeWebUrl(value), value).toBeUndefined();
    }
  });
  it('refuses what is not an address', () => {
    for (const value of ['', '   ', null, undefined, 'example.test', '/relative/path', '//example.test']) expect(safeWebUrl(value as string), String(value)).toBeUndefined();
  });
});
