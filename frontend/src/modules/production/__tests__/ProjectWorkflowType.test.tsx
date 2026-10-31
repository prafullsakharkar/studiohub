import { describe, it, expect } from 'vitest';
import { isEpisodicProject } from '@/types/production';

describe('project workflow configuration', () => {
  it('treats an explicit workflow_type Episodic project as episodic', () => {
    expect(isEpisodicProject({ workflow_type: 'Episodic' })).toBe(true);
  });

  it('leaves a Standard project on the legacy hierarchy', () => {
    expect(isEpisodicProject({ workflow_type: 'Standard', type: 'Feature Film' })).toBe(false);
  });
});
