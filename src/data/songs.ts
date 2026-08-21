export interface Track {
  id: string;
  title: string;
  albumId: string;
  album: string;
  year: number;
  number: number;
  file: string;
  cover?: string;
}

export interface Album {
  id: string;
  title: string;
  year: number;
  cover?: string;
  tracks: Track[];
}

const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const makeTrack = (
  albumId: string,
  album: string,
  year: number,
  number: number,
  title: string,
  cover?: string
): Track => ({
  id: `${albumId}-${number}`,
  title,
  albumId,
  album,
  year,
  number,
  file: `/assets/audio/${albumId}/${String(number).padStart(2, '0')}-${slug(title)}.mp3`,
  cover,
});

export const ALBUMS: Album[] = [
  {
    id: 'boy',
    title: 'boy',
    year: 2024,
    cover: '/assets/covers/boy.jpg',
    tracks: [
      makeTrack('boy', 'boy', 2024, 1, 'you once said my name for the first time'),
      makeTrack('boy', 'boy', 2024, 2, 'two bad'),
      makeTrack('boy', 'boy', 2024, 3, 'sister'),
      makeTrack('boy', 'boy', 2024, 4, 'crush', '/assets/covers/crush.jpg'),
      makeTrack('boy', 'boy', 2024, 5, 'i saw it flash before me'),
      makeTrack('boy', 'boy', 2024, 6, 'say it'),
      makeTrack('boy', 'boy', 2024, 7, 'say it again'),
      makeTrack('boy', 'boy', 2024, 8, 'teenage soldier'),
      makeTrack('boy', 'boy', 2024, 9, 'lie'),
      makeTrack('boy', 'boy', 2024, 10, 'promise'),
      makeTrack('boy', 'boy', 2024, 11, '3'),
      makeTrack('boy', 'boy', 2024, 12, 'light'),
      makeTrack('boy', 'boy', 2024, 13, 'mountain'),
    ],
  },
  {
    id: '2',
    title: '2',
    year: 2023,
    cover: '/assets/covers/2.jpg',
    tracks: [
      makeTrack('2', '2', 2023, 1, 'all 2s'),
      makeTrack('2', '2', 2023, 2, 'poster boy'),
      makeTrack('2', '2', 2023, 3, 'GOD'),
      makeTrack('2', '2', 2023, 4, 'trust'),
      makeTrack('2', '2', 2023, 5, 'FORFEIT'),
      makeTrack('2', '2', 2023, 6, 'nothing2 lose'),
      makeTrack('2', '2', 2023, 7, 'blackbirds'),
      makeTrack('2', '2', 2023, 8, 'fame runner'),
      makeTrack('2', '2', 2023, 9, '2 u'),
      makeTrack('2', '2', 2023, 10, 'PLASTER'),
      makeTrack('2', '2', 2023, 11, 'it will never be the same'),
    ],
  },
  {
    id: 'white-tiger',
    title: 'White Tiger',
    year: 2022,
    cover: '/assets/covers/white-tiger.jpg',
    tracks: [
      makeTrack('white-tiger', 'White Tiger', 2022, 1, 'gate'),
      makeTrack('white-tiger', 'White Tiger', 2022, 2, 'king of the darkness'),
      makeTrack('white-tiger', 'White Tiger', 2022, 3, 'give it up'),
      makeTrack('white-tiger', 'White Tiger', 2022, 4, 'i do'),
      makeTrack('white-tiger', 'White Tiger', 2022, 5, 'actor'),
      makeTrack('white-tiger', 'White Tiger', 2022, 6, 'white tiger'),
      makeTrack(
        'white-tiger',
        'White Tiger',
        2022,
        7,
        'the light upon the surface that beckoned deep into the moment and the tiger stepped forth'
      ),
      makeTrack('white-tiger', 'White Tiger', 2022, 8, 'raise'),
      makeTrack('white-tiger', 'White Tiger', 2022, 9, 'safety'),
      makeTrack('white-tiger', 'White Tiger', 2022, 10, 'i always questioned it'),
    ],
  },
  {
    id: 'finally-lost',
    title: 'Finally Lost',
    year: 2022,
    cover: '/assets/covers/finally-lost.jpg',
    tracks: [
      makeTrack('finally-lost', 'Finally Lost', 2022, 1, 'TIFERET'),
      makeTrack('finally-lost', 'Finally Lost', 2022, 2, 'THE CASE OF A LOST 2'),
      makeTrack('finally-lost', 'Finally Lost', 2022, 3, 'U AINT ON IT'),
      makeTrack('finally-lost', 'Finally Lost', 2022, 4, 'LIFE OF A FEELING'),
      makeTrack('finally-lost', 'Finally Lost', 2022, 5, 'Zvq9r6R6QAY (INTERLUDE)'),
      makeTrack('finally-lost', 'Finally Lost', 2022, 6, 'TALISMANS'),
      makeTrack('finally-lost', 'Finally Lost', 2022, 7, 'BEST OF LUCK'),
      makeTrack('finally-lost', 'Finally Lost', 2022, 8, 'LEEDS'),
      makeTrack('finally-lost', 'Finally Lost', 2022, 9, 'NAUSEOUS'),
    ],
  },
  {
    id: 'star',
    title: 'star',
    year: 2025,
    cover: '/assets/covers/star.jpg',
    tracks: [
      makeTrack('star', 'star', 2025, 1, 'beginning'),
      makeTrack('star', 'star', 2025, 2, 'flash'),
      makeTrack('star', 'star', 2025, 3, 'cope'),
      makeTrack('star', 'star', 2025, 4, 'you'),
      makeTrack('star', 'star', 2025, 5, 'tell me'),
      makeTrack('star', 'star', 2025, 6, 'destroy me'),
      makeTrack('star', 'star', 2025, 7, 'burn'),
      makeTrack('star', 'star', 2025, 8, 'girl'),
      makeTrack('star', 'star', 2025, 9, 'dream rain sports'),
      makeTrack('star', 'star', 2025, 10, 'nice'),
      makeTrack('star', 'star', 2025, 11, 'nerve'),
      makeTrack('star', 'star', 2025, 12, 'ego'),
      makeTrack('star', 'star', 2025, 13, 'sidekick'),
      makeTrack('star', 'star', 2025, 14, 'eldest child'),
      makeTrack('star', 'star', 2025, 15, 'safe'),
    ],
  },
  {
    id: 'singles',
    title: 'Singles',
    year: 2024,
    tracks: [
      makeTrack('singles', 'Singles', 2023, 1, 'jeans', '/assets/covers/jeans.jpg'),
      makeTrack('singles', 'Singles', 2024, 2, 'gold', '/assets/covers/gold.jpg'),
      makeTrack('singles', 'Singles', 2023, 3, 'whiplash', '/assets/covers/whiplash.jpg'),
      makeTrack('singles', 'Singles', 2023, 4, 'cliche', '/assets/covers/whiplash.jpg'),
      makeTrack('singles', 'Singles', 2023, 5, '4x4'),
    ],
  },
];

export const SONGS: Track[] = ALBUMS.flatMap((album) => album.tracks);

export const coverFor = (track: Track): string | undefined =>
  track.cover ?? ALBUMS.find((a) => a.id === track.albumId)?.cover;
