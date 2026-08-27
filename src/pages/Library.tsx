import { useCallback, useRef, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { albumCover } from '../data/songs';
import { useCatalog } from '../data/catalogContext';
import { usePlayer } from '../player/context';
import ArchiveHeader from '../components/ArchiveHeader';
import type { ArchiveView } from '../components/ArchiveHeader';
import Cover from '../components/Cover';
import Cross from '../components/Cross';
import MiniPlayer from '../components/MiniPlayer';
import TrackList from '../components/TrackList';
import './Library.css';

const Library: React.FC = () => {
  const { current } = usePlayer();
  const { albums } = useCatalog();
  const navigate = useNavigate();
  const [view, setView] = useState<ArchiveView>('releases');
  const contentRef = useRef<HTMLIonContentElement>(null);

  const onView = useCallback((next: ArchiveView) => {
    setView(next);
    void contentRef.current?.scrollToTop(0);
  }, []);

  const releases = albums.filter((album) => album.tracks.length > 0);

  return (
    <IonPage>
      <IonContent ref={contentRef} fullscreen>
        <ArchiveHeader view={view} onView={onView} />

        <div className="lib-panes">
          <div
            className={`lib-pane${view === 'releases' ? ' is-on' : ''}`}
            aria-hidden={view !== 'releases'}
          >
            <div className="lib-grid">
              {releases.map((album) => {
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
          </div>
          <div
            className={`lib-pane${view === 'tracks' ? ' is-on' : ''}`}
            aria-hidden={view !== 'tracks'}
          >
            {releases.map((album) => (
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
          </div>
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
