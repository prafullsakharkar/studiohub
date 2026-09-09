import { BaseRepository } from '@/core/repository/BaseRepository';
import { IPlaylistRepository } from './IPlaylistRepository';
import { Playlist, PlaylistEntry, PlaylistShareSettings } from '@/types/playlists';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class PlaylistRepository
  extends BaseRepository<Playlist, Partial<Playlist>, Partial<Playlist>>
  implements IPlaylistRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/playlists/', client);
  }

  async addEntry(playlistId: string, entry: Partial<PlaylistEntry>): Promise<Playlist> {
    return this.client.post<Playlist>(`${this.basePath}${playlistId}/add-entry/`, entry);
  }

  async removeEntry(playlistId: string, entryId: string): Promise<Playlist> {
    return this.client.post<Playlist>(`${this.basePath}${playlistId}/remove-entry/`, { entry_id: entryId });
  }

  async reorderEntries(playlistId: string, entries: PlaylistEntry[]): Promise<Playlist> {
    return this.client.post<Playlist>(`${this.basePath}${playlistId}/reorder/`, { entries });
  }

  async sharePlaylist(playlistId: string, settings: PlaylistShareSettings): Promise<Playlist> {
    return this.client.post<Playlist>(`${this.basePath}${playlistId}/share/`, settings);
  }

  async archivePlaylist(playlistId: string): Promise<Playlist> {
    return this.client.post<Playlist>(`${this.basePath}${playlistId}/archive/`, {});
  }

  async restorePlaylist(playlistId: string): Promise<Playlist> {
    return this.client.post<Playlist>(`${this.basePath}${playlistId}/restore/`, {});
  }
}

export const playlistRepository = new PlaylistRepository();
