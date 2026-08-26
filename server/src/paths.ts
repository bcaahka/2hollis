import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = join(here, '..');
export const DATA_DIR = join(SERVER_ROOT, 'data');
export const AUDIO_DIR = join(DATA_DIR, 'audio');
export const COVERS_DIR = join(DATA_DIR, 'covers');
export const LYRICS_DIR = join(DATA_DIR, 'lyrics');
export const DB_PATH = join(DATA_DIR, 'catalog.db');
export const REPO_ROOT = join(SERVER_ROOT, '..');

export const ensureDataDirs = (): void => {
  mkdirSync(AUDIO_DIR, { recursive: true });
  mkdirSync(COVERS_DIR, { recursive: true });
  mkdirSync(LYRICS_DIR, { recursive: true });
};

export const loadDotEnv = (): void => {
  const envPath = join(SERVER_ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
};

export const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
