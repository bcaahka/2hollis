import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { Track } from '../data/songs';

const INDEX_KEY = 'hollis-offline-ids';
const CACHE_NAME = '2hollis-offline';
const OFFLINE_DIR = 'offline';

const cacheKey = (trackId: string): string => `https://offline.local/${trackId}.mp3`;
const nativePath = (trackId: string): string => `${OFFLINE_DIR}/${trackId}.mp3`;

let lastBlobUrl: string | null = null;

const readIndex = (): Set<string> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
};

const writeIndex = (ids: Set<string>): void => {
  localStorage.setItem(INDEX_KEY, JSON.stringify([...ids]));
};

export const listDownloadedIds = (): string[] => [...readIndex()];

const hasNativeFile = async (trackId: string): Promise<boolean> => {
  try {
    await Filesystem.stat({ path: nativePath(trackId), directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
};

const hasWebCache = async (trackId: string): Promise<boolean> => {
  if (typeof caches === 'undefined') return false;
  const cache = await caches.open(CACHE_NAME);
  return Boolean(await cache.match(cacheKey(trackId)));
};

export const isDownloaded = async (trackId: string): Promise<boolean> => {
  if (!readIndex().has(trackId)) return false;
  return Capacitor.isNativePlatform() ? hasNativeFile(trackId) : hasWebCache(trackId);
};

export const downloadTrack = async (track: Track): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    await Filesystem.mkdir({
      path: OFFLINE_DIR,
      directory: Directory.Data,
      recursive: true,
    }).catch(() => undefined);
    await Filesystem.downloadFile({
      url: track.file,
      path: nativePath(track.id),
      directory: Directory.Data,
    });
  } else {
    const res = await fetch(track.file);
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheKey(track.id), res);
  }
  const ids = readIndex();
  ids.add(track.id);
  writeIndex(ids);
};

export const removeDownload = async (trackId: string): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    await Filesystem.deleteFile({
      path: nativePath(trackId),
      directory: Directory.Data,
    }).catch(() => undefined);
  } else if (typeof caches !== 'undefined') {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(cacheKey(trackId));
  }
  const ids = readIndex();
  ids.delete(trackId);
  writeIndex(ids);
};

export const resolvePlaybackUrl = async (track: Track): Promise<string> => {
  if (lastBlobUrl) {
    URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = null;
  }

  if (!(await isDownloaded(track.id))) return track.file;

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.getUri({
      path: nativePath(track.id),
      directory: Directory.Data,
    });
    return Capacitor.convertFileSrc(uri);
  }

  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(cacheKey(track.id));
  if (!match) return track.file;
  const blob = await match.blob();
  lastBlobUrl = URL.createObjectURL(blob);
  return lastBlobUrl;
};
