import type { Album } from './songs';
import { ALBUMS, SONGS } from './songs';
import type { Track } from './songs';

export const apiBase = (): string => (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

let activeAlbums: Album[] = ALBUMS;
let activeSongs: Track[] = SONGS;

export const getActiveAlbums = (): Album[] => activeAlbums;
export const getActiveSongs = (): Track[] => activeSongs;

export const setActiveCatalog = (albums: Album[]): void => {
  activeAlbums = albums;
  activeSongs = albums.flatMap((album) => album.tracks);
};

export const coverFor = (track: Track): string | undefined =>
  track.cover ?? activeAlbums.find((album) => album.id === track.albumId)?.cover;

export const mergeCatalog = (local: Album[], remote: Album[]): Album[] => {
  const remoteById = new Map(remote.map((album) => [album.id, album]));
  const merged = local.map((album) => {
    const rem = remoteById.get(album.id);
    if (!rem) return album;
    const remTracks = new Map(rem.tracks.map((track) => [track.id, track]));
    const tracks = album.tracks.map((track) => remTracks.get(track.id) ?? track);
    const localIds = new Set(album.tracks.map((track) => track.id));
    const extra = rem.tracks.filter((track) => !localIds.has(track.id));
    return {
      ...album,
      title: rem.title || album.title,
      year: rem.year || album.year,
      cover: rem.cover ?? album.cover,
      tracks: [...tracks, ...extra].sort((a, b) => a.number - b.number),
    };
  });
  const localIds = new Set(local.map((album) => album.id));
  const created = remote.filter((album) => !localIds.has(album.id) && album.tracks.length > 0);
  return [...merged, ...created];
};

export const fetchCatalog = async (): Promise<Album[] | null> => {
  try {
    const res = await fetch(`${apiBase()}/api/albums`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data as Album[];
  } catch {
    return null;
  }
};

export const fetchLyrics = async (trackId: string): Promise<string | null> => {
  try {
    const res = await fetch(`${apiBase()}/api/tracks/${trackId}/lyrics`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object' || !('text' in data)) return null;
    const text = (data as { text: unknown }).text;
    return typeof text === 'string' && text.trim() ? text : null;
  } catch {
    return null;
  }
};
