import { useEffect, useRef, useState } from 'react';
import { IonContent, IonFooter, IonIcon, IonPage, IonRange } from '@ionic/react';
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
import { EqIcon, LyricsIcon } from '../components/DockIcons';
import { useCatalog } from '../data/catalogContext';
import { fetchLyrics } from '../data/catalogApi';
import { lyricsFor, parseLyrics } from '../data/lyrics';
import {
  EQ_LABELS,
  EQ_MAX,
  EQ_MIN,
  EQ_PRESET_LABELS,
  presetForGains,
} from '../player/eq';
import type { EqPresetId } from '../player/eq';
import { useOffline } from '../player/offlineContext';
import { usePlayer } from '../player/context';
import { useNativeSystemVolumeSlider } from '../player/useNativeSystemVolumeSlider';
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
    setVolumeScrubbing,
    toggleShuffle,
    cycleRepeat,
    eqGains,
    setEqGain,
    setEqPreset,
  } = usePlayer();
  const { coverFor } = useCatalog();
  const { isOffline, remove } = useOffline();
  const lyricsStatic = current ? lyricsFor(current.id) : undefined;
  const [remoteLyrics, setRemoteLyrics] = useState<string | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [eqOpen, setEqOpen] = useState(false);
  const navigate = useNavigate();
  const volumeSlotRef = useRef<HTMLDivElement>(null);
  const lyrics = parseLyrics(remoteLyrics) ?? lyricsStatic;
  const { active: nativeSystemVolume, sync: syncNativeVolume } = useNativeSystemVolumeSlider(
    volumeSlotRef,
    Boolean(current) && !lyricsOpen && !eqOpen
  );

  useEffect(() => {
    setLyricsOpen(false);
    setEqOpen(false);
    setRemoteLyrics(null);
    if (!current) return;
    let cancelled = false;
    void fetchLyrics(current.id).then((text) => {
      if (!cancelled) setRemoteLyrics(text);
    });
    return () => {
      cancelled = true;
    };
  }, [current?.id]);

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
      <IonContent
        fullscreen
        scrollEvents={nativeSystemVolume}
        onIonScroll={nativeSystemVolume ? () => syncNativeVolume() : undefined}
      >
        <div className="player-top">
          <button type="button" className="player-back" onClick={() => navigate('/')}>
            <IonIcon icon={chevronBack} />
          </button>
          <span className="player-label">
            {eqOpen ? 'EQUALIZER' : lyricsOpen ? 'LYRICS' : 'NOW PLAYING'}
          </span>
          {isOffline(current.id) ? (
            <button
              type="button"
              className="player-cached"
              aria-label="Remove download"
              onClick={() => remove(current.id)}
            >
              <Cross className="player-cached-cross" thickness={28} />
            </button>
          ) : (
            <span className="player-top-slot" />
          )}
        </div>

        {eqOpen ? (
          <section className="player-eq">
            <div className="player-eq-presets">
              {(Object.keys(EQ_PRESET_LABELS) as EqPresetId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`player-eq-preset${presetForGains(eqGains) === id ? ' accent' : ''}`}
                  onClick={() => setEqPreset(id)}
                >
                  {EQ_PRESET_LABELS[id]}
                </button>
              ))}
            </div>
            {EQ_LABELS.map((label, i) => (
              <div key={label} className="player-eq-row">
                <span className="player-eq-hz">{label}</span>
                <IonRange
                  min={EQ_MIN}
                  max={EQ_MAX}
                  step={0.5}
                  value={eqGains[i]}
                  onIonInput={(e) => setEqGain(i, e.detail.value as number)}
                />
                <span className="player-eq-db">
                  {eqGains[i] > 0 ? '+' : ''}
                  {eqGains[i].toFixed(1)}
                </span>
              </div>
            ))}
            <button
              type="button"
              className={`player-eq-off${presetForGains(eqGains) === 'flat' ? ' accent' : ''}`}
              onClick={() => setEqPreset('flat')}
            >
              OFF
            </button>
          </section>
        ) : lyricsOpen && lyrics ? (
          <section className="player-lyrics">
            {lyrics.map((block, i) => {
              if (block.kind === 'gap') {
                return <div key={i} className="player-lyrics-gap" />;
              }
              if (block.kind === 'section') {
                return (
                  <div key={i} className="player-lyrics-section">
                    {block.text}
                  </div>
                );
              }
              return (
                <p key={i} className="player-lyrics-line">
                  {block.text}
                </p>
              );
            })}
          </section>
        ) : (
          <>
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
          <div
            ref={volumeSlotRef}
            className={`player-volume-slot${nativeSystemVolume ? ' native-hit' : ''}`}
          >
            <IonRange
              min={0}
              max={1}
              step={0.005}
              value={volume}
              onIonInput={
                nativeSystemVolume
                  ? undefined
                  : (e) => setVolume(e.detail.value as number)
              }
              onIonKnobMoveStart={
                nativeSystemVolume ? undefined : () => setVolumeScrubbing(true)
              }
              onIonKnobMoveEnd={
                nativeSystemVolume
                  ? undefined
                  : (e) => {
                      setVolume(e.detail.value as number);
                      setVolumeScrubbing(false);
                    }
              }
            />
          </div>
        </div>
          </>
        )}
      </IonContent>
      <IonFooter className="ion-no-border player-footer">
        <nav className="player-dock">
          <button
            type="button"
            className={`player-dock-btn${lyricsOpen ? ' accent' : ''}`}
            disabled={!lyrics}
            aria-label={lyricsOpen ? 'Close lyrics' : 'Lyrics'}
            onClick={() => {
              if (!lyrics) return;
              setLyricsOpen((open) => !open);
              setEqOpen(false);
            }}
          >
            <LyricsIcon className="player-dock-icon" />
          </button>
          <button
            type="button"
            className={`player-dock-btn${eqOpen ? ' accent' : ''}`}
            aria-label={eqOpen ? 'Close equalizer' : 'Equalizer'}
            onClick={() => {
              setEqOpen((open) => !open);
              setLyricsOpen(false);
            }}
          >
            <EqIcon className="player-dock-icon" />
          </button>
        </nav>
      </IonFooter>
    </IonPage>
  );
};

export default Player;
