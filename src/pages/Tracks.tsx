import { IonContent, IonPage } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import ArchiveHeader from '../components/ArchiveHeader';
import Cross from '../components/Cross';
import MiniPlayer from '../components/MiniPlayer';
import TrackList from '../components/TrackList';
import { useCatalog } from '../data/catalogContext';
import './Library.css';
import './Tracks.css';

const Tracks: React.FC = () => {
  const { albums } = useCatalog();
  const navigate = useNavigate();

  return (
    <IonPage>
      <IonContent fullscreen>
        <ArchiveHeader view="tracks" />

        {albums
          .filter((album) => album.tracks.length > 0)
          .map((album) => (
            <section className="tracks-album" key={album.id}>
              <button
                type="button"
                className="tracks-album-head"
                onClick={() => navigate(`/album/${album.id}`)}
              >
                <span className="tracks-album-title">{album.title}</span>
                <span className="tracks-album-year">
                  {album.year} · {album.tracks.length}
                </span>
              </button>
              <TrackList tracks={album.tracks} />
            </section>
          ))}

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

export default Tracks;
