import { Capacitor } from '@capacitor/core';
import { MediaSession } from '@capgo/capacitor-media-session';
import { coverFor } from '../data/songs';
import type { Track } from '../data/songs';

const artworkCache = new Map<string, string>();
const ART_SIZE = 320;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });

/** Compact JPEG data-URL — large base64 breaks Android MediaSession bridge and sticky artwork. */
const toCompactJpeg = async (source: CanvasImageSource | string): Promise<string> => {
  const canvas = document.createElement('canvas');
  canvas.width = ART_SIZE;
  canvas.height = ART_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ART_SIZE, ART_SIZE);

  if (typeof source === 'string') {
    const img = await loadImage(source);
    const scale = Math.max(ART_SIZE / img.width, ART_SIZE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (ART_SIZE - w) / 2, (ART_SIZE - h) / 2, w, h);
  } else {
    ctx.drawImage(source, 0, 0, ART_SIZE, ART_SIZE);
  }

  return canvas.toDataURL('image/jpeg', 0.82);
};

const fallbackArtwork = async (album: string): Promise<string> => {
  const key = `fallback:${album}:${ART_SIZE}`;
  const cached = artworkCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = ART_SIZE;
  canvas.height = ART_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ART_SIZE, ART_SIZE);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 72px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('2', ART_SIZE / 2, ART_SIZE / 2 - 8);
  ctx.font = '300 18px Arial, Helvetica, sans-serif';
  ctx.fillText(album.toUpperCase().slice(0, 22), ART_SIZE / 2, ART_SIZE - 28);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  artworkCache.set(key, dataUrl);
  return dataUrl;
};

const coverToDataUrl = async (path: string): Promise<string | undefined> => {
  const key = `${path}:${ART_SIZE}`;
  const cached = artworkCache.get(key);
  if (cached) return cached;
  try {
    const url = Capacitor.convertFileSrc(path);
    const dataUrl = await toCompactJpeg(url);
    if (!dataUrl.startsWith('data:image/')) return undefined;
    artworkCache.set(key, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
};

export const resolveArtwork = async (track: Track): Promise<string> => {
  const cover = coverFor(track);
  if (cover) {
    const fromCover = await coverToDataUrl(cover);
    if (fromCover) return fromCover;
  }
  return fallbackArtwork(track.album);
};

export const syncMediaMetadata = async (
  track: Track | null,
  isCancelled?: () => boolean
): Promise<void> => {
  if (!track) {
    await MediaSession.setPlaybackState({ playbackState: 'none' }).catch(() => undefined);
    return;
  }

  const artworkSrc = await resolveArtwork(track);
  if (isCancelled?.()) return;

  await MediaSession.setMetadata({
    title: track.title,
    artist: '2hollis',
    album: track.album,
    artwork: artworkSrc
      ? [{ src: artworkSrc, sizes: `${ART_SIZE}x${ART_SIZE}`, type: 'image/jpeg' }]
      : undefined,
  }).catch(() => undefined);
};

export const syncPlaybackState = async (isPlaying: boolean, hasTrack: boolean): Promise<void> => {
  await MediaSession.setPlaybackState({
    playbackState: !hasTrack ? 'none' : isPlaying ? 'playing' : 'paused',
  }).catch(() => undefined);
};

export const syncPositionState = async (position: number, duration: number): Promise<void> => {
  if (!Number.isFinite(duration) || duration <= 0) return;
  await MediaSession.setPositionState({
    position: Math.max(0, Math.min(position, duration)),
    duration,
    playbackRate: 1,
  }).catch(() => undefined);
};

export type MediaActionHandlers = {
  play: () => void;
  pause: () => void;
  previoustrack: () => void;
  nexttrack: () => void;
  seekto: (seekTime: number) => void;
};

export const registerMediaActionHandlers = async (handlers: MediaActionHandlers): Promise<void> => {
  await MediaSession.setActionHandler({ action: 'play' }, () => handlers.play()).catch(() => undefined);
  await MediaSession.setActionHandler({ action: 'pause' }, () => handlers.pause()).catch(() => undefined);
  await MediaSession.setActionHandler({ action: 'previoustrack' }, () => handlers.previoustrack()).catch(
    () => undefined
  );
  await MediaSession.setActionHandler({ action: 'nexttrack' }, () => handlers.nexttrack()).catch(() => undefined);
  await MediaSession.setActionHandler({ action: 'seekto' }, (details) => {
    if (details.seekTime != null) handlers.seekto(details.seekTime);
  }).catch(() => undefined);
};
