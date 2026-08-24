export type TrackId = "kick" | "snare" | "bass" | "keys" | "pluck" | "bell";
export type SoundPalette = "velvet" | "voltage" | "porcelain";

export interface InstrumentTrack {
  readonly id: TrackId;
  readonly name: string;
  readonly description: string;
  readonly colour: string;
  readonly key: string;
}

export interface SongBar {
  readonly name: string;
  readonly rows: readonly string[];
}

export interface Composition {
  readonly id: string;
  readonly title: string;
  readonly character: string;
  readonly tempo: number;
  readonly swing: number;
  readonly palette: SoundPalette;
  readonly accent: string;
  readonly bars: readonly SongBar[];
}

export const STEPS_PER_BAR = 16;
export const BARS_PER_SONG = 8;

export const INSTRUMENT_TRACKS: readonly InstrumentTrack[] = [
  { id: "kick", name: "Kick", description: "Low pulse", colour: "#f06449", key: "a" },
  { id: "snare", name: "Snare", description: "Paper snap", colour: "#f3b64d", key: "s" },
  { id: "bass", name: "Bass", description: "Warm current", colour: "#4eb889", key: "d" },
  { id: "keys", name: "Keys", description: "Soft chords", colour: "#4f8ee8", key: "j" },
  { id: "pluck", name: "Pluck", description: "Bright thread", colour: "#9274d8", key: "k" },
  { id: "bell", name: "Bell", description: "Clear light", colour: "#e77fad", key: "l" },
] as const;

function rowFromSteps(steps: readonly number[]): string {
  const active = new Set(steps);
  return Array.from({ length: STEPS_PER_BAR }, (_, step) => (active.has(step) ? "x" : ".")).join("");
}

function makeBar(name: string, tracks: readonly (readonly number[])[]): SongBar {
  return { name, rows: INSTRUMENT_TRACKS.map((_, index) => rowFromSteps(tracks[index] ?? [])) };
}

export const COMPOSITIONS: readonly Composition[] = [
  {
    id: "after-rain",
    title: "After Rain",
    character: "Patient glow",
    tempo: 104,
    swing: 12,
    palette: "velvet",
    accent: "#4f8ee8",
    bars: [
      makeBar("Mist", [[0, 8], [4, 12], [0, 8], [0], [6, 14], []]),
      makeBar("First light", [[0, 4, 8, 12], [4, 12], [0, 6, 8, 14], [0, 8], [2, 6, 10, 14], [10]]),
      makeBar("Theme A", [[0, 4, 8, 12], [4, 12], [0, 3, 8, 11], [0, 8], [2, 5, 10, 13], [1, 6, 9, 14]]),
      makeBar("Theme B", [[0, 4, 8, 11, 12], [4, 12, 15], [0, 3, 6, 8, 11, 14], [0, 8], [2, 6, 9, 13], [3, 7, 11, 15]]),
      makeBar("Lift", [[0, 3, 4, 7, 8, 11, 12, 15], [4, 12], [0, 2, 6, 8, 10, 14], [0, 4, 8, 12], [1, 3, 5, 7, 9, 11, 13, 15], [2, 6, 10, 14]]),
      makeBar("Wide sky", [[0, 4, 8, 12], [2, 4, 10, 12], [0, 6, 8, 14], [0, 8], [2, 6, 10, 14], [1, 5, 9, 13, 15]]),
      makeBar("Return", [[0, 4, 8, 12], [4, 12], [0, 3, 8, 11], [0, 8], [2, 5, 10, 13], [1, 6, 9, 14]]),
      makeBar("Last drop", [[0, 8], [4], [0], [0], [6], [2, 7, 12, 15]]),
    ],
  },
  {
    id: "night-tram",
    title: "Night Tram",
    character: "Restless motion",
    tempo: 126,
    swing: 24,
    palette: "voltage",
    accent: "#f06449",
    bars: [
      makeBar("Platform", [[0, 4, 8, 12], [4, 12], [0, 7, 8, 15], [], [3, 11], []]),
      makeBar("Doors close", [[0, 3, 4, 8, 11, 12], [4, 12], [0, 3, 7, 8, 11, 15], [0, 8], [2, 6, 10, 14], [7, 15]]),
      makeBar("Northbound", [[0, 4, 6, 8, 12, 14], [4, 10, 12], [0, 2, 5, 8, 10, 13], [0, 8], [1, 3, 5, 7, 9, 11, 13, 15], [2, 6, 10, 14]]),
      makeBar("Signal blur", [[0, 3, 4, 7, 8, 11, 12, 15], [2, 4, 6, 10, 12, 14], [0, 3, 6, 9, 12, 15], [0, 4, 8, 12], [1, 5, 9, 13], [3, 7, 11, 15]]),
      makeBar("Crossing", [[0, 4, 8, 12], [4, 12], [0, 6, 8, 14], [0, 8], [2, 6, 10, 14], [0, 5, 10, 15]]),
      makeBar("Tunnel", [[0, 2, 4, 6, 8, 10, 12, 14], [4, 12], [0, 3, 7, 8, 11, 15], [], [1, 5, 9, 13], [6, 14]]),
      makeBar("Last stop", [[0, 4, 6, 8, 12, 14], [4, 10, 12], [0, 2, 5, 8, 10, 13], [0, 8], [1, 3, 5, 7, 9, 11, 13, 15], [2, 6, 10, 14]]),
      makeBar("Empty carriage", [[0, 8], [4, 12], [0, 7], [0], [3, 11], [15]]),
    ],
  },
  {
    id: "sunday-kitchen",
    title: "Sunday Kitchen",
    character: "Loose sunshine",
    tempo: 92,
    swing: 18,
    palette: "porcelain",
    accent: "#4eb889",
    bars: [
      makeBar("Kettle", [[0, 8], [4, 12], [0], [0], [], [7, 15]]),
      makeBar("Windows open", [[0, 4, 8, 12], [4, 12], [0, 6, 10], [0, 8], [3, 7, 11, 15], [6, 14]]),
      makeBar("Table for two", [[0, 4, 8, 12], [4, 12], [0, 3, 8, 10, 14], [0, 8], [2, 6, 10, 14], [1, 5, 9, 13]]),
      makeBar("Easy talk", [[0, 4, 8, 11, 12], [4, 12], [0, 3, 6, 8, 11, 14], [0, 8], [1, 4, 7, 10, 13], [3, 7, 11, 15]]),
      makeBar("Sun room", [[0, 3, 4, 8, 12], [4, 10, 12], [0, 5, 8, 13], [0, 4, 8, 12], [2, 6, 10, 14], [1, 3, 5, 9, 11, 13]]),
      makeBar("Second cup", [[0, 4, 8, 12], [4, 12], [0, 3, 8, 10, 14], [0, 8], [2, 6, 10, 14], [1, 5, 9, 13]]),
      makeBar("Slow dance", [[0, 4, 8, 12], [4, 12], [0, 6, 10], [0, 8], [3, 7, 11, 15], [2, 6, 10, 14]]),
      makeBar("Dishes dry", [[0, 8], [4], [0], [0], [7], [3, 9, 15]]),
    ],
  },
] as const;

export type Pattern = boolean[][];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createEmptyPattern(): Pattern {
  return INSTRUMENT_TRACKS.map(() => Array.from({ length: STEPS_PER_BAR }, () => false));
}

export function patternFromBar(bar: SongBar): Pattern {
  return INSTRUMENT_TRACKS.map((_, trackIndex) =>
    Array.from({ length: STEPS_PER_BAR }, (_, step) => bar.rows[trackIndex]?.[step] === "x"),
  );
}

export function clonePattern(pattern: Pattern): Pattern {
  return pattern.map((row) => [...row]);
}

export function setPatternCell(
  pattern: Pattern,
  trackIndex: number,
  step: number,
  active: boolean,
): Pattern {
  const next = clonePattern(pattern);
  const row = next[trackIndex];
  if (row && step >= 0 && step < STEPS_PER_BAR) row[step] = active;
  return next;
}

export function trackIndexForKey(key: string): number | null {
  const index = INSTRUMENT_TRACKS.findIndex((track) => track.key === key.toLowerCase());
  return index < 0 ? null : index;
}

export function stepDurationSeconds(tempo: number, step: number, swing: number): number {
  const baseEighth = 30 / clamp(tempo, 48, 200);
  const swingAmount = clamp(swing, 0, 0.42);
  return baseEighth * (step % 2 === 0 ? 1 + swingAmount : 1 - swingAmount);
}

export function compositionDurationSeconds(composition: Composition): number {
  return (BARS_PER_SONG * STEPS_PER_BAR * 30) / composition.tempo;
}

export function transportClockSeconds(
  audioState: AudioContextState | undefined,
  audioTime: number,
  pageTime: number,
): number {
  return audioState === "running" ? audioTime : pageTime;
}
