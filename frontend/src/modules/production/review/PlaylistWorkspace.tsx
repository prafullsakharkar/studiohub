import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { playlistsApi } from '@/api/production/review';
import type { Playlist, PlaylistShareSettings } from '@/api/production/review';
import { EntityHistory } from '@/components/history/EntityHistory';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { VersionPicker } from './pickers';


/** The sharing flags. The backend only records them (nothing reads them: no public link, passcode, expiry or client approval exists), and this screen says so. */
const ShareDialog: React.FC<{ playlist: Playlist; isOpen: boolean; onClose: () => void; onSaved: () => Promise<unknown> }> = ({ playlist, isOpen, onClose, onSaved }) => {
  const current = playlist.share_settings;
  const [isPublic, setIsPublic] = useState(Boolean(current.is_public));
  const [passcode, setPasscode] = useState(Boolean(current.require_passcode));
  const [clientApproval, setClientApproval] = useState(Boolean(current.allow_client_approval));
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={`Share ${playlist.name}`}
      confirmLabel="Save sharing"
      onClose={onClose}
      message={
        <div className="space-y-2 text-xs text-slate-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Mark as shared outside the studio
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={passcode} onChange={(e) => setPasscode(e.target.checked)} /> Mark as passcode-protected
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={clientApproval} onChange={(e) => setClientApproval(e.target.checked)} /> Mark as open to client approval
          </label>
          <p className="text-[11px] text-amber-400/90">These settings are only recorded on the playlist. The server does not yet create a link or a passcode, enforce an expiry, or let anyone outside the studio open it.</p>
        </div>
      }
      onConfirm={async () => {
        const settings: PlaylistShareSettings = { is_public: isPublic, require_passcode: passcode, allow_client_approval: clientApproval };
        await playlistsApi.share(playlist.id, settings);
        await onSaved();
        notify.success('Sharing settings saved.');
      }}
    />
  );
};

export const PlaylistWorkspace: React.FC = () => {
  const { playlistId = '' } = useParams();
  const queryClient = useQueryClient();
  const canEdit = useCan('playlist.update');
  const [versionId, setVersionId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const query = useQuery({ queryKey: playlistsApi.keys.detail(playlistId), queryFn: ({ signal }) => playlistsApi.get(playlistId, signal), enabled: Boolean(playlistId) });
  const playlist = query.data;
  const refresh = () => Promise.all([playlistsApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  const write = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refresh();
      return true;
    } catch (error) {
      notify.error(serverMessage(error));
      return false;
    }
  };
  const entries = [...(playlist?.entries ?? [])].sort((a, b) => a.item_order - b.item_order);
  const move = (index: number, by: -1 | 1) => {
    const ids = entries.map((e) => e.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    return write(() => playlistsApi.reorder((playlist as Playlist).id, ids));
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="playlist">
        {playlist && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <Link to="/playlists" className="text-[11px] text-slate-500 hover:text-slate-300">
                  ← Playlists
                </Link>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {playlist.code} · {playlist.name}
                </h1>
                {playlist.description && <p className="text-xs text-slate-400 mt-1">{playlist.description}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {playlist.client_only && <Badge variant="info">Client only</Badge>}
                {playlist.share_settings.is_public && <Badge variant="success">Marked shared{playlist.share_settings.require_passcode ? ' · passcode' : ''}</Badge>}
                {canEdit && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setSharing(true)}>
                      Share
                    </Button>
                    <Link to={`/playlists/${playlist.id}/edit`}>
                      <Button size="sm" variant="outline">
                        Edit details
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-80">
                  <VersionPicker label="Add a version" value={versionId} onChange={setVersionId} filters={{ project_id: playlist.project_id }} />
                </div>
                <Button size="sm" variant="primary" disabled={!versionId} onClick={async () => (await write(() => playlistsApi.addEntry(playlist.id, { version_id: versionId as string }))) && setVersionId(null)}>
                  Add version
                </Button>
                <Button size="sm" variant="outline" onClick={() => void write(() => playlistsApi.addEntry(playlist.id))}>
                  Add placeholder
                </Button>
              </div>
            )}

            {entries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">No entries yet. Add the versions to be shown, in order.</p>
            ) : (
              <ol aria-label="Playlist entries" className="space-y-2">
                {entries.map((entry, index) => (
                  <li key={entry.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
                    <span className="w-6 text-right font-mono text-slate-500">{index + 1}</span>
                    <span className="flex-1">
                      {entry.version_id ? (
                        <Link to={`/versions/${entry.version_id}`} className="font-semibold text-cyan-300 hover:underline">
                          {entry.version_number || 'Version'}
                        </Link>
                      ) : (
                        <span className="text-slate-500">Placeholder</span>
                      )}
                    </span>
                    {canEdit && (
                      <span className="flex items-center gap-1">
                        <button type="button" aria-label={`Move entry ${index + 1} up`} disabled={index === 0} className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30" onClick={() => void move(index, -1)}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" aria-label={`Move entry ${index + 1} down`} disabled={index === entries.length - 1} className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30" onClick={() => void move(index, 1)}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" aria-label={`Remove entry ${index + 1}`} className="ml-2 text-rose-400 hover:text-rose-300" onClick={() => void write(() => playlistsApi.removeEntry(playlist.id, entry.id))}>
                          Remove
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}

            <EntityHistory targetType="Playlist" targetId={playlist.id} />
            {sharing && <ShareDialog playlist={playlist} isOpen onClose={() => setSharing(false)} onSaved={refresh} />}
          </>
        )}
      </QueryBoundary>
    </div>
  );
};
