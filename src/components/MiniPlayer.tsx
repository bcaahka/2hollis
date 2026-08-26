import { IonIcon } from '@ionic/react';
import { pause, play } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../data/catalogContext';
import { usePlayer } from '../player/context';
import Cover from './Cover';
import './MiniPlayer.css';

const MiniPlayer: React.FC = () => {
  const { current, isPlaying, toggle, progress, duration } = usePlayer();
  const { coverFor } = useCatalog();
  const navigate = useNavigate();

  if (!current) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="mini" onClick={() => navigate('/player')}>
      <div className="mini-progress" style={{ width: `${pct}%` }} />
      <Cover album={current.album} year={current.year} cover={coverFor(current)} />
      <div className="mini-meta">
        <div className="mini-title">{current.title}</div>
        <div className="mini-album">{current.album}</div>
      </div>
      <button
        type="button"
        className="mini-play"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        <IonIcon icon={isPlaying ? pause : play} />
      </button>
    </div>
  );
};

export default MiniPlayer;
