import { IonContent, IonIcon, IonPage, IonRange } from '@ionic/react';
import {
  chevronBack,
  pause,
  play,
  playSkipBack,
  playSkipForward,
  repeat,
  shuffle,
  volumeHigh,
} from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import Cover from '../components/Cover';
import Cross from '../components/Cross';
import { coverFor } from '../data/songs';
import { usePlayer } from '../player/context';
import './Player.css';

const fmt = (s: number): string => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const Player: React.FC = () => {
  const {
    current,
    isPlaying,
    progress,
    duration,
    volume,
    shuffle: shuffleOn,
    repeat: repeatMode,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();
  const navigate = useNavigate();

  if (!current) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <button type="button" className="player-back empty" onClick={() => navigate('/')}>
            <IonIcon icon={chevronBack} />
          </button>
          <div className="player-empty">
            <div>
              <div className="player-empty-title">SELECT A TRACK</div>
              <div className="player-empty-sub">FROM THE ARCHIVE</div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage className="player-page">
      <Cross className="player-bg-cross" />
      <IonContent fullscreen>
        <div className="player-top">
          <button type="button" className="player-back" onClick={() => navigate('/')}>
            <IonIcon icon={chevronBack} />
          </button>
          <span className="player-label">NOW PLAYING</span>
          <span className="player-spacer" />
        </div>

        <div className="player-cover-wrap">
          <Cover
            album={current.album}
            year={current.year}
            cover={coverFor(current)}
            playing={isPlaying}
          />
        </div>

        <div className="player-title">{current.title}</div>
        <div className="player-meta">
          {current.album} · {current.year}
        </div>

        <div className="player-seek">
          <IonRange
            min={0}
            max={duration || 1}
            step={0.1}
            value={progress}
            onIonChange={(e) => seek(e.detail.value as number)}
            disabled={duration <= 0}
          />
        </div>
        <div className="player-times">
          <span>{fmt(progress)}</span>
          <span>{fmt(duration)}</span>
        </div>

        <div className="player-controls">
          <button
            type="button"
            className={`ctrl${shuffleOn ? ' accent' : ''}`}
            onClick={toggleShuffle}
            aria-label="Shuffle"
          >
            <IonIcon icon={shuffle} />
          </button>
          <button type="button" className="ctrl" onClick={prev} aria-label="Previous">
            <IonIcon icon={playSkipBack} />
          </button>
          <button
            type="button"
            className="ctrl-play"
            onClick={toggle}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <IonIcon icon={isPlaying ? pause : play} />
          </button>
          <button type="button" className="ctrl" onClick={next} aria-label="Next">
            <IonIcon icon={playSkipForward} />
          </button>
          <button
            type="button"
            className={`ctrl${repeatMode !== 'off' ? ' accent' : ''}${repeatMode === 'one' ? ' repeat-one' : ''}`}
            onClick={cycleRepeat}
            aria-label="Repeat"
          >
            <IonIcon icon={repeat} />
          </button>
        </div>

        <div className="player-volume">
          <IonIcon icon={volumeHigh} className="vol-icon" />
          <IonRange
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onIonChange={(e) => setVolume(e.detail.value as number)}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Player;
