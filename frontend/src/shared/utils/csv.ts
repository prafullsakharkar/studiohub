/**
 * Delimited text as a spreadsheet writes it (RFC 4180): fields may be quoted, a quote inside a quoted field is doubled,
 * and a quoted field may hold the delimiter or a line break. Rows end with LF or CRLF. Rows with no text at all are
 * dropped; every field is returned as it was written, apart from the quotes.
 */
export type Delimiter = ',' | '\t' | ';';

/** Tab when the first line has one outside quotes (a paste from a spreadsheet), else comma. */
export function detectDelimiter(text: string): Delimiter {
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && char === '\t') return '\t';
  }
  return ',';
}

export function parseDelimited(input: string, delimiter: Delimiter = detectDelimiter(input)): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const endRow = () => {
    row.push(field);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
    field = '';
  };
  while (i < text.length) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (char === '"') quoted = false;
      else field += char;
      i += 1;
      continue;
    }
    if (char === '"' && field.trim() === '') {
      quoted = true;
      field = '';
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\r' && text[i + 1] === '\n') {
      endRow();
      i += 1;
    } else if (char === '\n' || char === '\r') {
      endRow();
    } else {
      field += char;
    }
    i += 1;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** A header cell as a key: trimmed, lower case, runs of spaces and dashes as one underscore ("Frame In" → "frame_in"). */
export const headerKey = (header: string): string => header.trim().toLowerCase().replace(/[\s-]+/g, '_');
