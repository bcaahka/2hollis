import Database from 'better-sqlite3';
import { DB_PATH, ensureDataDirs } from './paths.ts';

export type AlbumRow = {
  id: string;
  title: string;
  year: number;
  cover_id: string | null;
};

export type TrackRow = {
  id: string;
  album_id: string;
  title: string;
  year: number;
  number: number;
  audio_path: string;
  cover_id: string | null;
};

export type CoverRow = {
  id: string;
  path: string;
  mime: string;
};

let db: Database.Database | null = null;

export const getDb = (): Database.Database => {
  if (db) return db;
  ensureDataDirs();
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      year INTEGER NOT NULL,
      cover_id TEXT
    );
    CREATE TABLE IF NOT EXISTS covers (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      mime TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      album_id TEXT NOT NULL REFERENCES albums(id),
      title TEXT NOT NULL,
      year INTEGER NOT NULL,
      number INTEGER NOT NULL,
      audio_path TEXT NOT NULL,
      cover_id TEXT
    );
    CREATE TABLE IF NOT EXISTS lyrics (
      track_id TEXT PRIMARY KEY,
      path TEXT NOT NULL
    );
  `);
  return db;
};
