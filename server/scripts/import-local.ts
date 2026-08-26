import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { ALBUMS } from '../../src/data/songs.ts';
import { getDb } from '../src/db.ts';
import { upsertAlbum, upsertCover, upsertTrack } from '../src/catalog.ts';
import { AUDIO_DIR, COVERS_DIR, REPO_ROOT, ensureDataDirs, loadDotEnv } from '../src/paths.ts';

loadDotEnv();
ensureDataDirs();

const publicPath = (urlPath: string): string => join(REPO_ROOT, 'public', urlPath.replace(/^\//, ''));

const mimeFor = (file: string): string => {
  const ext = extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
};

const importCover = (coverPath: string): string | null => {
  const src = publicPath(coverPath);
  if (!existsSync(src)) {
    console.warn(`skip cover (missing): ${coverPath}`);
    return null;
  }
  const id = coverPath.replace(/^\/assets\/covers\//, '').replace(/\.[^.]+$/, '');
  const filename = `${id}${extname(src) || '.jpg'}`;
  copyFileSync(src, join(COVERS_DIR, filename));
  upsertCover({ id, path: filename, mime: mimeFor(filename) });
  return id;
};

let tracks = 0;
let skipped = 0;

for (const album of ALBUMS) {
  const albumCoverId = album.cover ? importCover(album.cover) : null;
  upsertAlbum({
    id: album.id,
    title: album.title,
    year: album.year,
    coverId: albumCoverId,
  });

  for (const track of album.tracks) {
    const src = publicPath(track.file);
    if (!existsSync(src)) {
      console.warn(`skip track (missing audio): ${track.file}`);
      skipped += 1;
      continue;
    }
    const audioRel = track.file.replace(/^\/assets\/audio\//, '');
    const dest = join(AUDIO_DIR, audioRel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);

    const trackCoverId = track.cover ? importCover(track.cover) : null;
    upsertTrack({
      id: track.id,
      album_id: album.id,
      title: track.title,
      year: track.year,
      number: track.number,
      audio_path: audioRel,
      cover_id: trackCoverId,
    });
    tracks += 1;
  }
}

getDb().prepare('DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks)').run();

console.log(`imported ${tracks} tracks (${skipped} skipped) → ${AUDIO_DIR}`);
