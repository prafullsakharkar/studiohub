import { describe, it, expect } from 'vitest';
import { isEpisodicProject } from '../projectWorkflow';

describe('project workflow configuration', () => {
  it('treats workflow_type episodic as episodic, whatever its case', () => {
    expect(isEpisodicProject({ workflow_type: 'episodic' })).toBe(true);
    expect(isEpisodicProject({ workflow_type: 'Episodic' })).toBe(true);
  });

  it('leaves a standard project without episodes', () => {
    expect(isEpisodicProject({ workflow_type: 'standard' })).toBe(false);
  });

  it('ignores the type label: a standard project labelled Episodic Series has no episodes (CR-47)', () => {
    expect(isEpisodicProject({ workflow_type: 'standard', type: 'Episodic Series' } as never)).toBe(false);
  });

  it('counts an unknown project as not episodic', () => {
    expect(isEpisodicProject(null)).toBe(false);
    expect(isEpisodicProject({})).toBe(false);
  });
});
