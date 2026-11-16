import type React from 'react';
import type { NotificationKind } from '@/api/notifications/notifications';
import { useNotificationPreferences, useSaveNotificationPreferences } from './hooks';

/**
 * Which kinds the person is told about (review pipeline RP-11, C-RP-30). One switch per kind the server says can be
 * muted; mentions and verdict requests are not listed because they ask the person to act. A muted kind is not
 * written for them, so unmuting brings nothing back. Each change saves at once and shows the server's answer.
 */
export const NotificationPreferencesPanel: React.FC<{ labels: Record<NotificationKind, string> }> = ({ labels }) => {
  const prefs = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const muted = new Set(prefs.data?.muted_kinds ?? []);

  const toggle = (kind: NotificationKind, tell: boolean) => {
    const next = new Set(muted);
    if (tell) next.delete(kind);
    else next.add(kind);
    save.mutate((prefs.data?.mutable_kinds ?? []).filter((k) => next.has(k)));
  };

  return (
    <section aria-labelledby="notification-preferences" className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div>
        <h2 id="notification-preferences" className="text-sm font-semibold text-white">
          What to tell me
        </h2>
        <p className="text-xs text-slate-400">Mentions and requests for your verdict always arrive. A kind you turn off is not kept for later.</p>
      </div>
      {prefs.isLoading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : prefs.error ? (
        <p className="text-xs text-rose-400">The preferences could not be loaded.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {(prefs.data?.mutable_kinds ?? []).map((kind) => (
            <li key={kind}>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={!muted.has(kind)} disabled={save.isPending} onChange={(e) => toggle(kind, e.target.checked)} />
                {labels[kind]}
              </label>
            </li>
          ))}
        </ul>
      )}
      {save.error ? (
        <p role="alert" className="text-xs text-rose-400">
          The change could not be saved.
        </p>
      ) : null}
    </section>
  );
};
