/** What `isEpisodicProject` reads: the API's `workflow_type` and `type`, and the older spellings still seen in stored data. */
export interface EpisodicLike {
  workflow_type?: string | null;
  type?: string | null;
  is_episodic?: boolean;
  isEpisodic?: boolean;
  project_type?: string;
  settings?: { workflow_type?: string } | null;
}
export function isEpisodicProject(project?: EpisodicLike | null): boolean {
  if (!project) return false;
  return Boolean(
    project.is_episodic === true ||
    project.isEpisodic === true ||
    // `workflow_type` is the authority and the backend sends it lower case ('standard' | 'episodic'); `type` is a separate label.
    String(project.workflow_type ?? '').toLowerCase() === 'episodic' ||
    project.project_type === 'episodic' ||
    project.type === 'Episodic' ||
    project.type === 'Episodic / TV' ||
    project.type === 'Episodic Series' ||
    project.settings?.workflow_type === 'Episodic'
  );
}
