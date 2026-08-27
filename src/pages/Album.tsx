import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { chevronBack } from 'ionicons/icons';
import { useNavigate, useParams } from 'react-router-dom';
import Cover from '../components/Cover';
import MiniPlayer from '../components/MiniPlayer';
import TrackList from '../components/TrackList';
import { albumCover } from '../data/songs';
import { useCatalog } from '../data/catalogContext';
import { usePlayer } from '../player/context';
import './Album.css';

const Album: React.FC = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const { albums } = useCatalog();
  const { current, isPlaying, playTrack, toggle } = usePlayer();
  const navigate = useNavigate();
  const album = albums.find((item) => item.id === albumId);

  if (!album) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="album-top">
            <button type="button" className="album-back" onClick={() => navigate('/')}>
              <IonIcon icon={chevronBack} />
            </button>
            <span className="album-label">ARCHIVE</span>
            <span className="album-top-slot" />
          </div>
          <div className="album-missing">RELEASE NOT FOUND</div>
        </IonContent>
      </IonPage>
    );
  }

  const onThisAlbum = current?.albumId === album.id;
  const playingHere = onThisAlbum && isPlaying;

  const playAlbum = () => {
    if (onThisAlbum) {
      toggle();
      return;
    }
    const first = album.tracks[0];
    if (first) playTrack(first);
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="album-top">
          <button type="button" className="album-back" onClick={() => navigate('/')}>
            <IonIcon icon={chevronBack} />
          </button>
          <span className="album-label">RELEASE</span>
          <span className="album-top-slot" />
        </div>

        <div className="album-hero">
          <Cover
            album={album.title}
            year={album.year}
            cover={albumCover(album)}
            playing={playingHere}
          />
        </div>

        <div className="album-title">{album.title}</div>
        <div className="album-meta">
          {album.year} · {album.tracks.length} TRACKS
        </div>

        <div className="album-actions">
          <button
            type="button"
            className={`album-play${playingHere ? ' accent' : ''}`}
            onClick={playAlbum}
          >
            {playingHere ? 'PAUSE' : 'PLAY'}
          </button>
        </div>

        <div className="album-tracks">
          <TrackList tracks={album.tracks} />
        </div>

        <div className="album-spacer" />
      </IonContent>
      <MiniPlayer />
    </IonPage>
  );
};

export default Album;
