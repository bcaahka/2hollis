import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { pause, play } from 'ionicons/icons';
import { useCatalog } from '../data/catalogContext';
import { useOffline } from '../player/offlineContext';
import { usePlayer } from '../player/context';
import { useTheme } from '../theme/theme';
import Cross from '../components/Cross';
import MiniPlayer from '../components/MiniPlayer';
import './Library.css';

const Bars: React.FC<{ playing: boolean }> = ({ playing }) => (
  <span className={`bars${playing ? ' playing' : ''}`} aria-hidden="true">
    <span />
    <span />
    <span />
  </span>
);

const Library: React.FC = () => {
  const { current, isPlaying, playTrack, toggle } = usePlayer();
  const { albums, songs } = useCatalog();
  const { isOffline, remove } = useOffline();
  const { theme, toggleTheme } = useTheme();

  return (
    <IonPage>
      <IonContent fullscreen>
        <header className="lib-header">
          <div className="lib-top">
            <div className="lib-logo">
              2HOLLIS
              <Cross className="lib-cross" />
            </div>
            <button
              type="button"
              className="lib-icon-btn theme-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <Cross className="theme-cross" thickness={34} />
            </button>
          </div>
          <div className="lib-sub">ARCHIVE · {songs.length} TRACKS</div>
        </header>

        {albums.map((album) => (
          <section className="album" key={album.id}>
            <div className="album-head">
              <span className="album-title">{album.title}</span>
              <span className="album-year">
                {album.year} · {album.tracks.length}
              </span>
            </div>
            <div className="tracks">
              {album.tracks.map((track) => {
                const active = current?.id === track.id;
                const saved = isOffline(track.id);
                return (
                  <div key={track.id} className={`track${active ? ' active' : ''}`}>
                    <button
                      type="button"
                      className="track-main"
                      onClick={() => (active ? toggle() : playTrack(track))}
                    >
                      <span className="track-num">
                        {active ? (
                          <Bars playing={isPlaying} />
                        ) : (
                          String(track.number).padStart(2, '0')
                        )}
                      </span>
                      <span className="track-name">{track.title}</span>
                      {active && (
                        <IonIcon icon={isPlaying ? pause : play} className="track-icon" />
                      )}
                    </button>
                    {saved && (
                      <button
                        type="button"
                        className="track-cached"
                        aria-label="Remove download"
                        onClick={() => remove(track.id)}
                      >
                        <Cross className="track-cached-cross" thickness={28} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
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

export default Library;
