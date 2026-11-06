/** What `isEpisodicProject` reads. */
export interface EpisodicLike {
  workflow_type?: string | null;
}

/**
 * Whether a project has episodes. `workflow_type` is the only authority, as on the backend
 * (`validators/episodic.py`); the `type` label ("Episodic Series") says nothing about it (CR-47).
 */
export function isEpisodicProject(project?: EpisodicLike | null): boolean {
  return String(project?.workflow_type ?? '').toLowerCase() === 'episodic';
}
