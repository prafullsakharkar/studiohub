import type React from 'react';
import type { Shot } from '@/api/production/work';
import { DetailGrid } from '@/modules/directory/workspace/DetailGrid';
import { Badge } from '@/shared/components/Badge';
import { safeWebUrl } from '@/shared/utils/safeUrl';

const stageVariant = (status: string) => (/approved|complete|final|done/i.test(status) ? 'success' : /progress|review|wip/i.test(status) ? 'info' : 'neutral');

/** A shot's own fields as the API sends them; a stage or link the shot does not have is left out, not invented. */
export const ShotOverview: React.FC<{ shot: Shot }> = ({ shot }) => {
  const video = shot.video_url ? safeWebUrl(shot.video_url) : undefined;
  const stages = Object.entries(shot.pipeline ?? {});
  return (
    <div className="space-y-4">
      <DetailGrid
        title="Shot"
        description={shot.description}
        items={[
          { label: 'Code', value: shot.code },
          { label: 'Name', value: shot.name },
          { label: 'Status', value: shot.status },
          { label: 'Project', value: shot.project_code },
          { label: 'Sequence', value: shot.sequence_code },
          { label: 'Frame range', value: `${shot.frame_in} to ${shot.frame_out} (${shot.frame_count} frames)` },
          { label: 'Handles', value: shot.handle_frames === undefined ? null : `${shot.handle_frames} frames` },
          { label: 'Assigned artist', value: shot.assigned_artist_name },
          { label: 'Current version', value: shot.current_version },
          { label: 'Supervisor approved', value: shot.supervisor_approved ? 'Yes' : 'No' },
          { label: 'Client approved', value: shot.client_approved ? 'Yes' : 'No' },
          { label: 'Video', value: video ? <a href={video} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">Open</a> : null },
        ]}
      />
      {stages.length > 0 && (
        <section aria-label="Pipeline" className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-white">Pipeline</h3>
          <ul className="flex flex-wrap gap-2">
            {stages.map(([stage, status]) => (
              <li key={stage}>
                <Badge variant={stageVariant(status)}>
                  {stage}: {status}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
