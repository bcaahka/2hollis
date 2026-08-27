import { IonIcon } from '@ionic/react';
import { pause, play } from 'ionicons/icons';
import { useOffline } from '../player/offlineContext';
import { usePlayer } from '../player/context';
import type { Track } from '../data/songs';
import Cross from './Cross';
import './TrackList.css';

const Bars: React.FC<{ playing: boolean }> = ({ playing }) => (
  <span className={`bars${playing ? ' playing' : ''}`} aria-hidden="true">
    <span />
    <span />
    <span />
  </span>
);

const TrackList: React.FC<{ tracks: Track[] }> = ({ tracks }) => {
  const { current, isPlaying, playTrack, toggle } = usePlayer();
  const { isOffline, remove } = useOffline();

  return (
    <div className="tracks">
      {tracks.map((track) => {
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
  );
};

export default TrackList;
