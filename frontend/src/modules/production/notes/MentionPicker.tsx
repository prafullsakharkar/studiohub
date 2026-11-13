import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type React from 'react';
import { projectScopedApi } from '@/api/production/structure';
import type { ProjectMember } from '@/api/production/structure';

/** At most this many people per note (C-RP-25: more is a 400). */
export const MENTION_CAP = 20;

/**
 * Who can be mentioned: someone who can read every thread of the project, i.e. an active member of the whole
 * project (not bound to a show or a department, not a client's or a vendor's). The server checks again, with the
 * person's codes too, and answers 400 `{mention_ids}` otherwise.
 */
export function mentionable(m: ProjectMember): boolean {
  return m.status === 'active' && !m.show_id && !m.department && !m.department_id && !m.client_id && !m.vendor_id;
}

export interface MentionPickerProps {
  projectId: string;
  /** User ids, in the order picked. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Names already known (a note's `mentions`), for people the member list no longer offers. */
  known?: ReadonlyArray<{ id: string; name: string }>;
  id?: string;
}

/** Mention people on a note or a reply (review pipeline RP-6, C-RP-25): each is told in their inbox. */
export const MentionPicker: React.FC<MentionPickerProps> = ({ projectId, value, onChange, known = [], id = 'note-mentions' }) => {
  const members = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: ({ signal }) => projectScopedApi.members(projectId, signal),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });
  const offered = (members.data?.results ?? []).filter(mentionable);
  const nameOf = (userId: string) => offered.find((m) => m.user_id === userId)?.name || known.find((k) => k.id === userId)?.name || 'Unknown person';
  const left = offered.filter((m) => !value.includes(m.user_id));
  const full = value.length >= MENTION_CAP;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-mono text-slate-400">
        Mention
      </label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Mentioned">
          {value.map((userId) => (
            <li key={userId} className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[11px] text-cyan-200">
              @{nameOf(userId)}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== userId))} aria-label={`Remove ${nameOf(userId)}`} className="cursor-pointer text-cyan-300 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <select
        id={id}
        value=""
        disabled={full || left.length === 0}
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
      >
        <option value="">{full ? `At most ${MENTION_CAP} people` : left.length === 0 ? 'No one else to mention' : 'Mention someone…'}</option>
        {left.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.name || m.email} ({m.role})
          </option>
        ))}
      </select>
    </div>
  );
};
