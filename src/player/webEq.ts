import { EQ_FREQUENCIES } from './eq';
import type { EqGains } from './eq';

const FILTER_TYPES: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

let ctx: AudioContext | null = null;
let source: MediaElementAudioSourceNode | null = null;
let filters: BiquadFilterNode[] = [];

export const attachWebEq = (audio: HTMLAudioElement, gains: EqGains): void => {
  if (source) {
    setWebEqGains(gains);
    return;
  }

  audio.crossOrigin = 'anonymous';
  const context = new AudioContext();
  ctx = context;
  source = context.createMediaElementSource(audio);
  filters = EQ_FREQUENCIES.map((hz, i) => {
    const node = context.createBiquadFilter();
    node.type = FILTER_TYPES[i];
    node.frequency.value = hz;
    node.Q.value = 0.9;
    node.gain.value = gains[i];
    return node;
  });

  source.connect(filters[0]);
  for (let i = 0; i < filters.length - 1; i += 1) {
    filters[i].connect(filters[i + 1]);
  }
  filters[filters.length - 1].connect(context.destination);
};

export const setWebEqGains = (gains: EqGains): void => {
  filters.forEach((node, i) => {
    node.gain.value = gains[i];
  });
};

export const resumeWebEq = (): void => {
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
};
