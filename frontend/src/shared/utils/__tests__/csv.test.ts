import { describe, expect, it } from 'vitest';
import { detectDelimiter, headerKey, parseDelimited } from '../csv';

describe('parseDelimited (RFC 4180)', () => {
  it('splits plain rows and drops blank ones', () => {
    expect(parseDelimited('code,name\nSQ010,Opening\n\n  \nSQ020,Chase\n')).toEqual([
      ['code', 'name'],
      ['SQ010', 'Opening'],
      ['SQ020', 'Chase'],
    ]);
  });

  it('keeps a delimiter, a doubled quote and a line break inside quotes', () => {
    expect(parseDelimited('code,name\r\nSQ010,"Smith, J"\r\nSQ020,"He said ""go"""\r\nSQ030,"two\nlines"')).toEqual([
      ['code', 'name'],
      ['SQ010', 'Smith, J'],
      ['SQ020', 'He said "go"'],
      ['SQ030', 'two\nlines'],
    ]);
  });

  it('keeps empty fields, and a trailing empty one', () => {
    expect(parseDelimited('a,b,c\n1,,3\n4,5,')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
      ['4', '5', ''],
    ]);
  });

  it('reads tab-separated text pasted from a spreadsheet', () => {
    const text = 'code\tname\nSQ010\tOpening, cold\n';
    expect(detectDelimiter(text)).toBe('\t');
    expect(parseDelimited(text)).toEqual([
      ['code', 'name'],
      ['SQ010', 'Opening, cold'],
    ]);
  });

  it('a tab inside quotes does not make it tab-separated; a BOM is dropped', () => {
    expect(detectDelimiter('"a\tb",c\n1,2')).toBe(',');
    expect(parseDelimited('﻿code\nSQ010')).toEqual([['code'], ['SQ010']]);
  });
});

describe('headerKey', () => {
  it('normalizes a header cell', () => {
    expect(headerKey(' Frame In ')).toBe('frame_in');
    expect(headerKey('Asset-Type')).toBe('asset_type');
  });
});
