import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  resolveBulkShotEpisode,
  normalizeEpisodeRef,
  buildEpisodeLookup,
  getBulkEpisodicPrompt,
  applyBulkSequenceCreate,
  buildBulkShotItems,
  ShotBulkManager,
} from '../ShotBulkManager';

const mockBulk = vi.hoisted(() => ({
  checkExistence: vi.fn(),
  bulkCreate: vi.fn(),
}));

vi.mock('../../../hooks/useBulkShots', () => ({
  useBulkShots: () => ({
    checkExistence: mockBulk.checkExistence,
    bulkCreate: mockBulk.bulkCreate,
    isCheckingExistence: false,
    isBulkCreating: false,
  }),
}));

beforeEach(() => {
  mockBulk.checkExistence.mockReset();
  mockBulk.bulkCreate.mockReset();
  mockBulk.checkExistence.mockResolvedValue({ items: [] });
  mockBulk.bulkCreate.mockResolvedValue({
    operation_id: 'op-bulk-1',
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      newCount: 0,
      existingCount: 0,
      softDeletedCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      createdCount: 0,
      recoveredCount: 0,
      skippedCount: 0,
      updatedCount: 0,
      failedCount: 0,
    },
    results: [],
    partial_success: false,
  });
});

describe('bulk shot creation on episodic projects', () => {
  it('resolves episode per row: row value beats bulk default beats sequence episode', async () => {
    const sequenceEpisodeMap = { SEQ_A: 'ep-101' };
    const rows = [{ episode_id: 'ep-102' }, {}, { sequence_code: 'SEQ_A' }];

    // Row value beats the bulk default.
    expect(
      resolveBulkShotEpisode(rows[0], {
        bulkDefaultEpisodeId: 'ep-101',
        sequenceEpisodeMap,
      })
    ).toBe('ep-102');

    // Empty row falls back to the bulk default.
    expect(
      resolveBulkShotEpisode(rows[1], {
        bulkDefaultEpisodeId: 'ep-101',
        sequenceEpisodeMap,
      })
    ).toBe('ep-101');

    // Sequence episode applies when neither row nor default is set.
    expect(resolveBulkShotEpisode(rows[2], { sequenceEpisodeMap })).toBe(
      'ep-101'
    );

    // Combined vector from the brief.
    const resolved = rows.map((row) =>
      resolveBulkShotEpisode(row, {
        bulkDefaultEpisodeId: 'ep-101',
        sequenceEpisodeMap,
      })
    );
    expect(resolved).toEqual(['ep-102', 'ep-101', 'ep-101']);

    // Nothing set anywhere resolves to undefined (router then 400s per item).
    expect(resolveBulkShotEpisode({}, {})).toBeUndefined();
  });

  it('normalizes grid-typed episode codes to ids via the episode lookup', async () => {
    const lookup = buildEpisodeLookup([
      { id: 'ep-101', code: 'EP101', name: 'Pilot' },
    ]);

    // A typed code resolves to the episode id before landing in payloads.
    expect(normalizeEpisodeRef('EP101', lookup)).toBe('ep-101');
    expect(normalizeEpisodeRef('ep-101', lookup)).toBe('ep-101');
    expect(
      resolveBulkShotEpisode(
        { episode_id: 'EP101' },
        { episodeLookup: lookup }
      )
    ).toBe('ep-101');

    // Unresolvable input passes through raw: the router accepts id-or-code
    // on episode fields, so the backend still has a chance to resolve it
    // instead of us dropping user input.
    expect(normalizeEpisodeRef('EP999', lookup)).toBe('EP999');
    expect(normalizeEpisodeRef('  ', lookup)).toBeUndefined();
  });

  it('withholds the sequence prompt while sequences are still unknown', async () => {
    const { rerender } = render(
      <ShotBulkManager
        projectId="proj-102"
        projectCode="SOL03"
        isOpen
        isEpisodic
        episodeId="ep-101"
        episodes={[{ id: 'ep-101', code: 'EP101', name: 'Pilot' }]}
        sequences={undefined}
      />
    );

    // Episodes present but sequences unknown: no prompt, no crash, grid intact.
    expect(screen.queryByText(/has no sequences yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no episodes found/i)).not.toBeInTheDocument();
    expect(screen.getByText(/target episode: EP101/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('NK_010_030')).toBeInTheDocument();

    // Sequences load as known-empty: the create-sequence prompt now engages.
    rerender(
      <ShotBulkManager
        projectId="proj-102"
        projectCode="SOL03"
        isOpen
        isEpisodic
        episodeId="ep-101"
        episodes={[{ id: 'ep-101', code: 'EP101', name: 'Pilot' }]}
        sequences={[]}
      />
    );
    expect(screen.getByText(/has no sequences yet/i)).toBeInTheDocument();
  });

  it('wires the episodeCode prop into the bulk default', async () => {
    render(
      <ShotBulkManager
        projectId="proj-102"
        projectCode="SOL03"
        isOpen
        episodeCode="EP101"
        episodes={[{ id: 'ep-101', code: 'EP101', name: 'Pilot' }]}
        sequences={[{ code: 'SOL03_010', episode_id: 'ep-101' }]}
      />
    );

    // episodeCode alone enables episodic mode and resolves the default.
    expect(screen.getByText('Episode')).toBeInTheDocument();
    expect(screen.getByText(/target episode: EP101/i)).toBeInTheDocument();
  });

  it('does not demand sequence creation without linkage data', async () => {
    const episodes = [{ id: 'ep-101', code: 'EP101', name: 'Pilot' }];

    // Unknown sequence list (still loading / unwired): never prompt blind.
    expect(
      getBulkEpisodicPrompt({
        isEpisodic: true,
        episodes,
        sequences: undefined,
        bulkDefaultEpisodeId: 'ep-101',
      })
    ).toEqual({ kind: 'none' });

    // Candidates exist but none carry episode linkage: the data predates the
    // linkage contract, so treat sequences as present.
    expect(
      getBulkEpisodicPrompt({
        isEpisodic: true,
        episodes,
        sequences: [{ code: 'SOL03_010' }, { code: 'SOL03_020' }],
        bulkDefaultEpisodeId: 'ep-101',
      })
    ).toEqual({ kind: 'none' });

    // Some linkage exists but none under the target: prompt with context.
    expect(
      getBulkEpisodicPrompt({
        isEpisodic: true,
        episodes,
        sequences: [{ code: 'SOL03_010', episode_id: 'ep-102' }],
        bulkDefaultEpisodeId: 'ep-101',
      })
    ).toEqual({ kind: 'create-sequence', episodeId: 'ep-101' });
  });

  it('creates the missing episode inline and continues without losing grid rows', async () => {
    // Empty episode list must raise the create-episode prompt.
    expect(
      getBulkEpisodicPrompt({ isEpisodic: true, episodes: [], sequences: [] })
    ).toEqual({ kind: 'create-episode' });
    expect(
      getBulkEpisodicPrompt({
        isEpisodic: false,
        episodes: [],
        sequences: [],
      })
    ).toEqual({ kind: 'none' });

    const onCreateEpisode = vi.fn().mockResolvedValue({
      id: 'ep-201',
      code: 'EP201',
      name: 'New Ep',
    });
    const onCreateSequence = vi.fn().mockResolvedValue({
      id: 'seq-10',
      code: 'SOL03_090',
      episode_id: 'ep-201',
    });

    render(
      <ShotBulkManager
        projectId="proj-102"
        projectCode="SOL03"
        isOpen
        isEpisodic
        episodes={[]}
        sequences={[]}
        onCreateEpisode={onCreateEpisode}
        onCreateSequence={onCreateSequence}
      />
    );

    // Episodic grid renders the Episode column; standard grids do not.
    expect(screen.getByText('Episode')).toBeInTheDocument();
    expect(
      screen.getByText(/no episodes found for this project/i)
    ).toBeInTheDocument();
    // Pending grid rows survive underneath the prompt.
    expect(screen.getByDisplayValue('NK_010_030')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create episode/i }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. EP201/i), {
      target: { value: 'EP201' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. The Arrival/i), {
      target: { value: 'New Ep' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save episode/i }));

    await waitFor(() =>
      expect(onCreateEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'proj-102',
          code: 'EP201',
          name: 'New Ep',
        })
      )
    );

    // Grid + phase intact: prompt dismissed, rows preserved, new default shown.
    await waitFor(() =>
      expect(
        screen.queryByText(/no episodes found for this project/i)
      ).not.toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('NK_010_030')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NK_010_040')).toBeInTheDocument();
    expect(screen.getByText(/target episode: EP201/i)).toBeInTheDocument();

    // Cascade: the new episode has no sequences, so the sequence prompt
    // takes over — create one under the new episode before executing.
    expect(screen.getByText(/has no sequences yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /create sequence/i }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. SOL03_090/i), {
      target: { value: 'SOL03_090' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save sequence/i }));

    await waitFor(() =>
      expect(onCreateSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'proj-102',
          episode_id: 'ep-201',
          code: 'SOL03_090',
        })
      )
    );
    await waitFor(() =>
      expect(screen.queryByText(/has no sequences yet/i)).not.toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('NK_010_030')).toBeInTheDocument();

    // Execution proceeds with the new episode id on every item.
    fireEvent.click(
      screen.getByRole('button', { name: /validate & resolve cut sheet/i })
    );
    await waitFor(() => expect(mockBulk.checkExistence).toHaveBeenCalled());
    fireEvent.click(
      screen.getByRole('button', { name: /review execution preview/i })
    );
    fireEvent.click(
      screen.getByRole('button', { name: /execute bulk operation/i })
    );
    await waitFor(() => expect(mockBulk.bulkCreate).toHaveBeenCalled());
    const payload = mockBulk.bulkCreate.mock.calls[0][0];
    expect(payload.project_id).toBe('proj-102');
    expect(payload.items.length).toBeGreaterThan(0);
    for (const item of payload.items) {
      expect(item.data.episode_id).toBe('ep-201');
    }
  });

  it('surfaces creation failures without losing the form or grid', async () => {
    const onCreateEpisode = vi
      .fn()
      .mockRejectedValue(new Error('Episode code already exists.'));

    render(
      <ShotBulkManager
        projectId="proj-102"
        projectCode="SOL03"
        isOpen
        isEpisodic
        episodes={[]}
        sequences={[]}
        onCreateEpisode={onCreateEpisode}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /create episode/i }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. EP201/i), {
      target: { value: 'EP201' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. The Arrival/i), {
      target: { value: 'New Ep' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save episode/i }));

    await waitFor(() => expect(onCreateEpisode).toHaveBeenCalled());

    // Error surfaced, form kept open, grid intact — no silent dismissal and
    // no synthesized parent.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /episode code already exists/i
    );
    expect(screen.getByPlaceholderText(/e\.g\. EP201/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no episodes found for this project/i)
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('NK_010_030')).toBeInTheDocument();
    expect(mockBulk.bulkCreate).not.toHaveBeenCalled();
  });

  it('prompts to create a sequence when the episode has none, preserving the operation', async () => {
    // Episode with zero sequences must raise the create-sequence prompt,
    // carrying the episode context for the sequence create.
    const prompt = getBulkEpisodicPrompt({
      isEpisodic: true,
      episodes: [{ id: 'ep-101', code: 'EP101', name: 'Pilot' }],
      sequences: [],
      bulkDefaultEpisodeId: 'ep-101',
    });
    expect(prompt).toEqual({ kind: 'create-sequence', episodeId: 'ep-101' });
    expect(
      getBulkEpisodicPrompt({
        isEpisodic: true,
        episodes: [{ id: 'ep-101', code: 'EP101', name: 'Pilot' }],
        sequences: [{ code: 'SOL03_010', episode_id: 'ep-101' }],
        bulkDefaultEpisodeId: 'ep-101',
      })
    ).toEqual({ kind: 'none' });

    const onCreateSequence = vi.fn().mockResolvedValue({
      id: 'seq-9',
      code: 'SOL03_090',
      episode_id: 'ep-101',
    });

    render(
      <ShotBulkManager
        projectId="proj-102"
        projectCode="SOL03"
        isOpen
        isEpisodic
        episodeId="ep-101"
        episodes={[{ id: 'ep-101', code: 'EP101', name: 'Pilot' }]}
        sequences={[]}
        onCreateSequence={onCreateSequence}
      />
    );

    expect(
      screen.getByText(/has no sequences yet/i)
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('NK_010_030')).toBeInTheDocument();

    // Blank one row's sequence so the created sequence has somewhere to land.
    const seqInputs = screen.getAllByDisplayValue('NK_010');
    fireEvent.change(seqInputs[0], { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /create sequence/i }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. SOL03_090/i), {
      target: { value: 'SOL03_090' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save sequence/i }));

    // Sequence create carries the episode context into the call.
    await waitFor(() =>
      expect(onCreateSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'proj-102',
          episode_id: 'ep-101',
          code: 'SOL03_090',
        })
      )
    );

    // Operation preserved: prompt dismissed, all rows intact, the blanked
    // row continues with the new sequence_code set.
    await waitFor(() =>
      expect(screen.queryByText(/has no sequences yet/i)).not.toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('NK_010_030')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SOL03_090')).toBeInTheDocument();

    // Helper keeps every row and fills only empty sequence_code cells.
    const kept = applyBulkSequenceCreate(
      [
        { code: 'A', sequence_code: 'KEEP' },
        { code: 'B', sequence_code: '' },
      ],
      { code: 'SOL03_090', episode_id: 'ep-101' }
    );
    expect(kept).toHaveLength(2);
    expect(kept[0].sequence_code).toBe('KEEP');
    expect(kept[1].sequence_code).toBe('SOL03_090');
  });

  it('keeps standard-project rendering and payloads free of episode keys', async () => {
    render(
      <ShotBulkManager
        projectId="proj-101"
        projectCode="NEB01"
        isOpen
      />
    );

    // No Episode column on standard projects.
    expect(screen.queryByText('Episode')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('NK_010_030')).toBeInTheDocument();

    // Standard payloads carry no episode keys (byte-identical to before).
    const items = buildBulkShotItems(
      [
        {
          code: 'NK_010_030',
          state: 'NEW',
          userAction: 'create',
          proposedData: { code: 'NK_010_030', sequence_code: 'NK_010' },
        } as any,
      ],
      {
        projectId: 'proj-101',
        projectCode: 'NEB01',
        defaultSequenceCode: 'NK_010',
        isEpisodic: false,
      }
    );
    expect(items).toHaveLength(1);
    expect(items[0].data.episode_id).toBeUndefined();
    expect(items[0].data.episode_code).toBeUndefined();
    expect(items[0].data.episode_name).toBeUndefined();
    expect('episode_id' in items[0].data).toBe(false);
  });
});
