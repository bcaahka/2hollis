import { getDb } from './db.ts';
import type { AlbumRow, CoverRow, TrackRow } from './db.ts';

export type ApiTrack = {
  id: string;
  title: string;
  albumId: string;
  album: string;
  year: number;
  number: number;
  file: string;
  cover?: string;
  hasLyrics?: boolean;
};

export type ApiAlbum = {
  id: string;
  title: string;
  year: number;
  cover?: string;
  tracks: ApiTrack[];
};

export const coverUrl = (origin: string, coverId: string | null | undefined): string | undefined =>
  coverId ? `${origin}/api/covers/${coverId}` : undefined;

export const listAlbums = (origin: string): ApiAlbum[] => {
  const database = getDb();
  const albums = database.prepare('SELECT * FROM albums ORDER BY year DESC, title COLLATE NOCASE').all() as AlbumRow[];
  const lyricIds = new Set(
    (database.prepare('SELECT track_id FROM lyrics').all() as { track_id: string }[]).map((row) => row.track_id)
  );
  const tracksByAlbum = database.prepare(
    'SELECT * FROM tracks WHERE album_id = ? ORDER BY number ASC'
  );
  return albums.map((album) => {
    const tracks = tracksByAlbum.all(album.id) as TrackRow[];
    const albumCover = coverUrl(origin, album.cover_id);
    return {
      id: album.id,
      title: album.title,
      year: album.year,
      cover: albumCover,
      tracks: tracks.map((track) => ({
        id: track.id,
        title: track.title,
        albumId: album.id,
        album: album.title,
        year: track.year,
        number: track.number,
        file: `${origin}/api/tracks/${track.id}/file`,
        cover: coverUrl(origin, track.cover_id) ?? albumCover,
        hasLyrics: lyricIds.has(track.id),
      })),
    };
  });
};

export const getAlbum = (origin: string, id: string): ApiAlbum | undefined =>
  listAlbums(origin).find((album) => album.id === id);

export const getTrack = (id: string): TrackRow | undefined => {
  const row = getDb().prepare('SELECT * FROM tracks WHERE id = ?').get(id) as TrackRow | undefined;
  return row;
};

export const getCover = (id: string): CoverRow | undefined => {
  const row = getDb().prepare('SELECT * FROM covers WHERE id = ?').get(id) as CoverRow | undefined;
  return row;
};

export const upsertAlbum = (album: { id: string; title: string; year: number; coverId?: string | null }): void => {
  getDb()
    .prepare(
      `INSERT INTO albums (id, title, year, cover_id)
       VALUES (@id, @title, @year, @cover_id)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         year = excluded.year,
         cover_id = COALESCE(excluded.cover_id, albums.cover_id)`
    )
    .run({
      id: album.id,
      title: album.title,
      year: album.year,
      cover_id: album.coverId ?? null,
    });
};

export const upsertCover = (cover: CoverRow): void => {
  getDb()
    .prepare(
      `INSERT INTO covers (id, path, mime)
       VALUES (@id, @path, @mime)
       ON CONFLICT(id) DO UPDATE SET path = excluded.path, mime = excluded.mime`
    )
    .run(cover);
};

export const upsertTrack = (track: TrackRow): void => {
  getDb()
    .prepare(
      `INSERT INTO tracks (id, album_id, title, year, number, audio_path, cover_id)
       VALUES (@id, @album_id, @title, @year, @number, @audio_path, @cover_id)
       ON CONFLICT(id) DO UPDATE SET
         album_id = excluded.album_id,
         title = excluded.title,
         year = excluded.year,
         number = excluded.number,
         audio_path = excluded.audio_path,
         cover_id = COALESCE(excluded.cover_id, tracks.cover_id)`
    )
    .run(track);
};

export const setAlbumCover = (albumId: string, coverId: string): void => {
  getDb().prepare('UPDATE albums SET cover_id = ? WHERE id = ?').run(coverId, albumId);
};

export const setTrackCover = (trackId: string, coverId: string): void => {
  getDb().prepare('UPDATE tracks SET cover_id = ? WHERE id = ?').run(coverId, trackId);
};

export const setTrackLyrics = (trackId: string, path: string): void => {
  getDb()
    .prepare(
      `INSERT INTO lyrics (track_id, path)
       VALUES (?, ?)
       ON CONFLICT(track_id) DO UPDATE SET path = excluded.path`
    )
    .run(trackId, path);
};

export const getLyricsPath = (trackId: string): string | undefined => {
  const row = getDb().prepare('SELECT path FROM lyrics WHERE track_id = ?').get(trackId) as
    | { path: string }
    | undefined;
  return row?.path;
};
