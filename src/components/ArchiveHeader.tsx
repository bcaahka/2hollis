import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../data/catalogContext';
import { useTheme } from '../theme/theme';
import Cross from './Cross';

type ArchiveView = 'releases' | 'tracks';

const ArchiveHeader: React.FC<{ view: ArchiveView }> = ({ view }) => {
  const { albums, songs } = useCatalog();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="lib-header">
      <div className="lib-top">
        <button type="button" className="lib-logo" onClick={() => navigate('/')}>
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
      <nav className="lib-nav">
        <button
          type="button"
          className={`lib-nav-btn${view === 'releases' ? ' active' : ''}`}
          onClick={() => navigate('/')}
        >
          RELEASES
        </button>
        <button
          type="button"
          className={`lib-nav-btn${view === 'tracks' ? ' active' : ''}`}
          onClick={() => navigate('/tracks')}
        >
          ALL TRACKS
        </button>
      </nav>
    </header>
  );
};

export default ArchiveHeader;
