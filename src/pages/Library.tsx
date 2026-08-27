import { IonContent, IonPage } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { albumCover } from '../data/songs';
import { useCatalog } from '../data/catalogContext';
import { usePlayer } from '../player/context';
import ArchiveHeader from '../components/ArchiveHeader';
import Cover from '../components/Cover';
import Cross from '../components/Cross';
import MiniPlayer from '../components/MiniPlayer';
import './Library.css';

const Library: React.FC = () => {
  const { current } = usePlayer();
  const { albums } = useCatalog();
  const navigate = useNavigate();

  return (
    <IonPage>
      <IonContent fullscreen>
        <ArchiveHeader view="releases" />

        <div className="lib-grid">
          {albums
            .filter((album) => album.tracks.length > 0)
            .map((album) => {
              const active = current?.albumId === album.id;
              return (
                <button
                  key={album.id}
                  type="button"
                  className={`lib-album${active ? ' active' : ''}`}
                  onClick={() => navigate(`/album/${album.id}`)}
                >
                  <Cover
                    album={album.title}
                    year={album.year}
                    cover={albumCover(album)}
                  />
                  <div className="lib-album-title">{album.title}</div>
                  <div className="lib-album-meta">
                    {album.year} · {album.tracks.length}
                  </div>
                </button>
              );
            })}
        </div>

        <footer className="lib-footer">
          <div className="lib-footer-line" />
          <div className="lib-footer-brand">
            <span>© 2026 2HOLLIS</span>
            <Cross className="lib-footer-cross" thickness={30} />
          </div>
          <div className="lib-footer-sub">ARCHIVE · PERSONAL USE</div>
        </footer>

        <div className="lib-spacer" />
      </IonContent>
      <MiniPlayer />
    </IonPage>
  );
};

export default Library;
