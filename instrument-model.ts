export interface InstrumentNote {
  readonly name: string;
  readonly frequency: number;
  readonly colour: string;
  readonly key: string;
}

export interface PatternPreset {
  readonly id: string;
  readonly name: string;
  readonly character: string;
  readonly rows: readonly string[];
}

export const STEP_COUNT = 8;

export const INSTRUMENT_NOTES: readonly InstrumentNote[] = [
  { name: "C4", frequency: 261.63, colour: "#ff4f3f", key: "a" },
  { name: "D4", frequency: 293.66, colour: "#ff8f32", key: "s" },
  { name: "E4", frequency: 329.63, colour: "#f7c900", key: "d" },
  { name: "G4", frequency: 392, colour: "#28a96b", key: "j" },
  { name: "A4", frequency: 440, colour: "#2864dc", key: "k" },
  { name: "C5", frequency: 523.25, colour: "#8b55c5", key: "l" },
] as const;

export const PATTERN_PRESETS: readonly PatternPreset[] = [
  {
    id: "soft-machine",
    name: "Soft Machine",
    character: "Steady / warm",
    rows: ["x...x...", "..x...x.", "....x...", ".x...x..", "...x...x", "......x."],
  },
  {
    id: "open-window",
    name: "Open Window",
    character: "Wide / patient",
    rows: ["x.......", "....x...", "..x.....", "......x.", ".x...x..", "...x...x"],
  },
  {
    id: "paper-rain",
    name: "Paper Rain",
    character: "Light / restless",
    rows: ["x..x..x.", ".x...x..", "..x...x.", "...x...x", "x...x...", "..x.x..."],
  },
] as const;

export type Pattern = boolean[][];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createEmptyPattern(): Pattern {
  return INSTRUMENT_NOTES.map(() => Array.from({ length: STEP_COUNT }, () => false));
}

export function patternFromPreset(preset: PatternPreset): Pattern {
  return INSTRUMENT_NOTES.map((_, noteIndex) =>
    Array.from({ length: STEP_COUNT }, (_, step) => preset.rows[noteIndex]?.[step] === "x"),
  );
}

export function clonePattern(pattern: Pattern): Pattern {
  return pattern.map((row) => [...row]);
}

export function setPatternCell(
  pattern: Pattern,
  noteIndex: number,
  step: number,
  active: boolean,
): Pattern {
  const next = clonePattern(pattern);
  const row = next[noteIndex];
  if (row && step >= 0 && step < STEP_COUNT) row[step] = active;
  return next;
}

export function noteIndexForKey(key: string): number | null {
  const index = INSTRUMENT_NOTES.findIndex((note) => note.key === key.toLowerCase());
  return index < 0 ? null : index;
}

export function stepDurationSeconds(tempo: number, step: number, swing: number): number {
  const baseEighth = 30 / clamp(tempo, 48, 200);
  const swingAmount = clamp(swing, 0, 0.42);
  return baseEighth * (step % 2 === 0 ? 1 + swingAmount : 1 - swingAmount);
}
