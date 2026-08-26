import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCover, getLyricsPath, getTrack, listAlbums, setAlbumCover, setTrackCover, setTrackLyrics, upsertAlbum, upsertCover, upsertTrack } from './catalog.ts';
import { AUDIO_DIR, COVERS_DIR, DATA_DIR, LYRICS_DIR, ensureDataDirs, loadDotEnv, slug } from './paths.ts';

loadDotEnv();
ensureDataDirs();

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_KEY = process.env.ADMIN_KEY || 'dev';
const ADMIN_HTML_PATH = join(dirname(fileURLToPath(import.meta.url)), 'admin.html');

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const originOf = (url: string): string => new URL(url).origin;

const parseRange = (
  header: string | undefined,
  size: number
): { start: number; end: number } | null => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  let start: number;
  let end: number;
  if (match[1] === '' && match[2] !== '') {
    const suffix = Number(match[2]);
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = match[1] ? Number(match[1]) : 0;
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end) return null;
  return { start, end: Math.min(end, size - 1) };
};

const nodeStreamBody = (path: string, start?: number, end?: number): ReadableStream =>
  Readable.toWeb(createReadStream(path, start != null && end != null ? { start, end } : undefined)) as ReadableStream;

const requireAdmin = (key: string | undefined): boolean => Boolean(key) && key === ADMIN_KEY;

const asFile = (value: unknown): File | null => (value instanceof File && value.size > 0 ? value : null);

const extFromFile = (file: File, fallback: string): string => {
  const fromName = extname(file.name).toLowerCase();
  if (fromName) return fromName;
  if (file.type === 'audio/mpeg') return '.mp3';
  if (file.type === 'image/png') return '.png';
  if (file.type === 'image/webp') return '.webp';
  if (file.type === 'image/gif') return '.gif';
  if (file.type.startsWith('image/')) return '.jpg';
  return fallback;
};

const saveUpload = async (file: File, dest: string): Promise<void> => {
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await file.arrayBuffer()));
};

const app = new Hono();

app.use('/api/*', cors());

app.get('/admin', (c) => c.html(readFileSync(ADMIN_HTML_PATH, 'utf8')));

app.get('/api/health', (c) => c.json({ ok: true, data: DATA_DIR }));

app.get('/api/albums', (c) => c.json(listAlbums(originOf(c.req.url))));

app.get('/api/albums/:id', (c) => {
  const album = listAlbums(originOf(c.req.url)).find((item) => item.id === c.req.param('id'));
  if (!album) return c.json({ error: 'not found' }, 404);
  return c.json(album);
});

app.get('/api/tracks/:id/file', async (c) => {
  const track = getTrack(c.req.param('id'));
  if (!track) return c.json({ error: 'not found' }, 404);
  const filePath = join(AUDIO_DIR, track.audio_path);
  if (!existsSync(filePath)) return c.json({ error: 'file missing' }, 404);

  const size = (await stat(filePath)).size;
  const range = parseRange(c.req.header('range'), size);
  c.header('Accept-Ranges', 'bytes');
  c.header('Content-Type', MIME[extname(filePath).toLowerCase()] || 'audio/mpeg');
  c.header('Cache-Control', 'public, max-age=3600');

  if (!range) {
    c.header('Content-Length', String(size));
    return c.body(nodeStreamBody(filePath), 200);
  }

  c.header('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  c.header('Content-Length', String(range.end - range.start + 1));
  return c.body(nodeStreamBody(filePath, range.start, range.end), 206);
});

app.get('/api/tracks/:id/lyrics', async (c) => {
  const rel = getLyricsPath(c.req.param('id'));
  if (!rel) return c.json({ error: 'not found' }, 404);
  const filePath = join(LYRICS_DIR, rel);
  if (!existsSync(filePath)) return c.json({ error: 'file missing' }, 404);
  const text = readFileSync(filePath, 'utf8');
  return c.json({ text });
});

app.get('/api/covers/:id', async (c) => {
  const cover = getCover(c.req.param('id'));
  if (!cover) return c.json({ error: 'not found' }, 404);
  const filePath = join(COVERS_DIR, cover.path);
  if (!existsSync(filePath)) return c.json({ error: 'file missing' }, 404);
  const size = (await stat(filePath)).size;
  c.header('Content-Type', cover.mime);
  c.header('Content-Length', String(size));
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(nodeStreamBody(filePath), 200);
});

app.post('/api/admin/tracks', async (c) => {
  if (!requireAdmin(c.req.header('x-admin-key'))) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const body = await c.req.parseBody();
  const audio = asFile(body.audio);
  const title = String(body.title || '').trim();
  const albumId = slug(String(body.albumId || '').trim());
  const albumTitle = String(body.albumTitle || albumId).trim();
  const year = Number(body.year);
  const number = Number(body.number);
  if (!audio || !title || !albumId || !Number.isFinite(year) || !Number.isFinite(number)) {
    return c.json({ error: 'audio, title, albumId, year, number required' }, 400);
  }

  const trackId = `${albumId}-${number}`;
  const audioName = `${String(number).padStart(2, '0')}-${slug(title) || 'track'}.mp3`;
  const audioRel = join(albumId, audioName).replaceAll('\\', '/');
  await saveUpload(audio, join(AUDIO_DIR, audioRel));

  let coverId: string | null = null;
  const cover = asFile(body.cover);
  if (cover) {
    coverId = `${trackId}-cover`;
    const coverRel = `${coverId}${extFromFile(cover, '.jpg')}`;
    await saveUpload(cover, join(COVERS_DIR, coverRel));
    upsertCover({
      id: coverId,
      path: coverRel,
      mime: cover.type || MIME[extname(coverRel)] || 'image/jpeg',
    });
  }

  upsertAlbum({ id: albumId, title: albumTitle, year, coverId: coverId && number === 1 ? coverId : null });
  upsertTrack({
    id: trackId,
    album_id: albumId,
    title,
    year,
    number,
    audio_path: audioRel,
    cover_id: coverId,
  });

  return c.json({ ok: true, id: trackId, albumId });
});

app.post('/api/admin/covers', async (c) => {
  if (!requireAdmin(c.req.header('x-admin-key'))) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const body = await c.req.parseBody();
  const cover = asFile(body.cover);
  const id = slug(String(body.id || '').trim());
  if (!cover || !id) return c.json({ error: 'cover file and id required' }, 400);

  const coverRel = `${id}${extFromFile(cover, '.jpg')}`;
  await saveUpload(cover, join(COVERS_DIR, coverRel));
  upsertCover({
    id,
    path: coverRel,
    mime: cover.type || MIME[extname(coverRel)] || 'image/jpeg',
  });

  const albumId = String(body.albumId || '').trim();
  const trackId = String(body.trackId || '').trim();
  if (albumId) setAlbumCover(albumId, id);
  if (trackId) setTrackCover(trackId, id);

  return c.json({ ok: true, id });
});

app.post('/api/admin/lyrics', async (c) => {
  if (!requireAdmin(c.req.header('x-admin-key'))) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const body = await c.req.parseBody();
  const trackId = String(body.trackId || '').trim();
  const pasted = String(body.text || '').trim();
  const file = asFile(body.lyrics);
  let text = pasted;
  if (!text && file) text = (await file.text()).trim();
  if (!trackId || !text) return c.json({ error: 'trackId and lyrics text required' }, 400);

  const rel = `${trackId}.txt`;
  await mkdir(LYRICS_DIR, { recursive: true });
  await writeFile(join(LYRICS_DIR, rel), text, 'utf8');
  setTrackLyrics(trackId, rel);
  return c.json({ ok: true, id: trackId });
});

console.log(`2hollis server http://localhost:${PORT}  (admin /admin)`);
serve({ fetch: app.fetch, port: PORT, hostname: HOST });
