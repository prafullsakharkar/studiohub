import { describe, expect, it } from 'vitest';
import { BulkOperationEngine } from '../BulkOperationEngine';

const SHOT_KEYS = ['code', 'sequence_code', 'name', 'status', 'frame_in', 'frame_out'];

describe('pasting a sheet into the shot grid', () => {
  it('a header that is the grid\'s label ("Shot Code", "Sequence") fills the column it names', () => {
    const rows = BulkOperationEngine.parseInput('Shot Code\tSequence\tName\nsh0100\tsq0010\tLinked', 'code', SHOT_KEYS);

    expect(rows).toEqual([{ code: 'SH0100', sequence_code: 'SQ0010', name: 'Linked' }]);
  });

  it('a header that is the key itself works as before', () => {
    const rows = BulkOperationEngine.parseInput('code,sequence_code,name\nsh0100,sq0010,Linked', 'code', SHOT_KEYS);

    expect(rows).toEqual([{ code: 'SH0100', sequence_code: 'SQ0010', name: 'Linked' }]);
  });

  it('without the grid\'s keys an alias is left alone (another grid may have a column of that name)', () => {
    const rows = BulkOperationEngine.parseInput('shot_code,name\nsh1,One', 'code');

    expect(rows).toEqual([{ shot_code: 'SH1', name: 'One' }]);
  });

  it('frame numbers are numbers and a sheet with no header takes the grid\'s column order', () => {
    expect(BulkOperationEngine.parseInput('Shot Code\tSequence\tName\tStatus\tFrame In\nsh1\tsq1\tn\tNot Started\t1001', 'code', SHOT_KEYS)[0]).toMatchObject({ frame_in: 1001 });
    expect(BulkOperationEngine.parseInput('sh1\tsq1\tn', 'code', SHOT_KEYS)[0]).toMatchObject({ code: 'SH1', sequence_code: 'SQ1', name: 'n' });
  });
});
