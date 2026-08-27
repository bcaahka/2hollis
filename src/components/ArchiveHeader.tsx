import { useCatalog } from '../data/catalogContext';
import { useTheme } from '../theme/theme';
import Cross from './Cross';

export type ArchiveView = 'releases' | 'tracks';

type ArchiveHeaderProps = {
  view: ArchiveView;
  onView: (view: ArchiveView) => void;
};

const ArchiveHeader: React.FC<ArchiveHeaderProps> = ({ view, onView }) => {
  const { albums, songs } = useCatalog();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="lib-header">
      <div className="lib-top">
        <button type="button" className="lib-logo" onClick={() => onView('releases')}>
          2HOLLIS
          <Cross className="lib-cross" />
        </button>
        <button
          type="button"
          className="lib-icon-btn theme-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <Cross className="theme-cross" thickness={34} />
        </button>
      </div>
      <div className="lib-sub">
        ARCHIVE · {albums.length} RELEASES · {songs.length} TRACKS
      </div>
      <nav className="lib-nav" aria-label="Archive">
        <button
          type="button"
          className={`lib-nav-btn${view === 'releases' ? ' active' : ''}`}
          aria-current={view === 'releases' ? 'page' : undefined}
          onClick={() => onView('releases')}
        >
          RELEASES
          <span className="lib-nav-line" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`lib-nav-btn${view === 'tracks' ? ' active' : ''}`}
          aria-current={view === 'tracks' ? 'page' : undefined}
          onClick={() => onView('tracks')}
        >
          ALL TRACKS
          <span className="lib-nav-line" aria-hidden="true" />
        </button>
      </nav>
    </header>
  );
};

export default ArchiveHeader;
