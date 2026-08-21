import { Capacitor } from '@capacitor/core';
import { MediaSession } from '@capgo/capacitor-media-session';
import { coverFor } from '../data/songs';
import type { Track } from '../data/songs';

const artworkCache = new Map<string, string>();
const ART_SIZE = 320;

const bitmapToJpeg = (source: CanvasImageSource, sw: number, sh: number): string => {
  const canvas = document.createElement('canvas');
  canvas.width = ART_SIZE;
  canvas.height = ART_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ART_SIZE, ART_SIZE);

  const scale = Math.max(ART_SIZE / sw, ART_SIZE / sh);
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(source, (ART_SIZE - w) / 2, (ART_SIZE - h) / 2, w, h);

  return canvas.toDataURL('image/jpeg', 0.85);
};

const fallbackArtwork = (album: string): string => {
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

const fetchCoverBlob = async (path: string): Promise<Blob | null> => {
  const candidates = [Capacitor.convertFileSrc(path), path];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.size > 0) return blob;
    } catch {
      // try next candidate
    }
  }
  return null;
};

/** Load cover via fetch+ImageBitmap — avoids CORS-tainted canvas from convertFileSrc Image(). */
const coverToDataUrl = async (path: string): Promise<string | undefined> => {
  const key = `${path}:${ART_SIZE}`;
  const cached = artworkCache.get(key);
  if (cached) return cached;

  try {
    const blob = await fetchCoverBlob(path);
    if (!blob) return undefined;

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      try {
        const dataUrl = bitmapToJpeg(bitmap, bitmap.width, bitmap.height);
        if (!dataUrl.startsWith('data:image/')) return undefined;
        artworkCache.set(key, dataUrl);
        return dataUrl;
      } finally {
        bitmap.close();
      }
    }

    // Fallback path for older WebViews
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('img'));
        el.src = objectUrl;
      });
      const dataUrl = bitmapToJpeg(img, img.naturalWidth, img.naturalHeight);
      if (!dataUrl.startsWith('data:image/')) return undefined;
      artworkCache.set(key, dataUrl);
      return dataUrl;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
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

  const artwork: { src: string; sizes: string; type: string }[] = [];
  if (artworkSrc) {
    artwork.push({ src: artworkSrc, sizes: `${ART_SIZE}x${ART_SIZE}`, type: 'image/jpeg' });
  }

  // iOS Web Media Session sometimes prefers a fetchable file URL alongside data URLs.
  const cover = coverFor(track);
  if (cover && Capacitor.getPlatform() === 'ios') {
    artwork.push({
      src: Capacitor.convertFileSrc(cover),
      sizes: '512x512',
      type: 'image/jpeg',
    });
  }

  await MediaSession.setMetadata({
    title: track.title,
    artist: '2hollis',
    album: track.album,
    artwork: artwork.length ? artwork : undefined,
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
