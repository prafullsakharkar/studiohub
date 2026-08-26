import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Playlist, PlaylistEntry, PlaylistShareSettings } from '@/types/playlists';

export interface IPlaylistRepository extends IBaseRepository<Playlist, Partial<Playlist>, Partial<Playlist>> {
  addEntry(playlistId: string, entry: Partial<PlaylistEntry>): Promise<Playlist>;
  removeEntry(playlistId: string, entryId: string): Promise<Playlist>;
  reorderEntries(playlistId: string, entries: PlaylistEntry[]): Promise<Playlist>;
  sharePlaylist(playlistId: string, settings: PlaylistShareSettings): Promise<Playlist>;
  archivePlaylist(playlistId: string): Promise<Playlist>;
  restorePlaylist(playlistId: string): Promise<Playlist>;
}
