export const EQ_FREQUENCIES = [60, 250, 1000, 4000, 12000] as const;

export const EQ_LABELS = ['60', '250', '1K', '4K', '12K'] as const;

export type EqGains = [number, number, number, number, number];

export type EqPresetId = 'flat' | 'bass' | 'vocal';

export const EQ_MIN = -12;
export const EQ_MAX = 12;

export const EQ_FLAT: EqGains = [0, 0, 0, 0, 0];

export const EQ_PRESETS: Record<EqPresetId, EqGains> = {
  flat: [0, 0, 0, 0, 0],
  bass: [7, 4, 0, -1, -2],
  vocal: [-2, 1, 4, 3, 1],
};

export const EQ_PRESET_LABELS: Record<EqPresetId, string> = {
  flat: 'FLAT',
  bass: 'BASS',
  vocal: 'VOCAL',
};

const STORAGE_KEY = 'hollis-eq-gains';

export const clampGain = (value: number): number =>
  Math.min(EQ_MAX, Math.max(EQ_MIN, value));

export const normalizeGains = (value: unknown): EqGains => {
  if (!Array.isArray(value) || value.length !== 5) return [...EQ_FLAT];
  return value.map((item) => clampGain(Number(item) || 0)) as EqGains;
};

export const loadEqGains = (): EqGains => {
  try {
    return normalizeGains(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? ''));
  } catch {
    return [...EQ_FLAT];
  }
};

export const saveEqGains = (gains: EqGains): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gains));
};

export const presetForGains = (gains: EqGains): EqPresetId | null => {
  const match = (Object.keys(EQ_PRESETS) as EqPresetId[]).find((id) =>
    EQ_PRESETS[id].every((value, i) => Math.abs(value - gains[i]) < 0.05)
  );
  return match ?? null;
};
