import { IPlaylistRepository } from '../repositories/IPlaylistRepository';
import { playlistRepository } from '../repositories/PlaylistRepository';
import { Playlist, PlaylistEntry, PlaylistShareSettings } from '@/types/playlists';
import { PaginatedResponse, QueryParams } from '@/types/drf';

export class PlaylistService {
  private repository: IPlaylistRepository;

  constructor(repository: IPlaylistRepository = playlistRepository) {
    this.repository = repository;
  }

  async getPlaylists(params?: QueryParams): Promise<PaginatedResponse<Playlist> | Playlist[]> {
    return this.repository.findAll(params);
  }

  async getPlaylistById(id: string): Promise<Playlist> {
    return this.repository.findById(id);
  }

  async createPlaylist(data: Partial<Playlist>): Promise<Playlist> {
    return this.repository.create(data);
  }

  async updatePlaylist(id: string, data: Partial<Playlist>): Promise<Playlist> {
    return this.repository.update(id, data);
  }

  async deletePlaylist(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async addEntry(playlistId: string, entry: Partial<PlaylistEntry>): Promise<Playlist> {
    return this.repository.addEntry(playlistId, entry);
  }

  async removeEntry(playlistId: string, entryId: string): Promise<Playlist> {
    return this.repository.removeEntry(playlistId, entryId);
  }

  async reorderEntries(playlistId: string, entries: PlaylistEntry[]): Promise<Playlist> {
    return this.repository.reorderEntries(playlistId, entries);
  }

  async sharePlaylist(playlistId: string, settings: PlaylistShareSettings): Promise<Playlist> {
    return this.repository.sharePlaylist(playlistId, settings);
  }

  async archivePlaylist(playlistId: string): Promise<Playlist> {
    return this.repository.archivePlaylist(playlistId);
  }

  async restorePlaylist(playlistId: string): Promise<Playlist> {
    return this.repository.restorePlaylist(playlistId);
  }
}

export const playlistService = new PlaylistService();
