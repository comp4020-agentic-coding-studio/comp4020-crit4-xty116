export type TrackId = "kick" | "snare" | "bass" | "keys" | "pluck" | "bell";
export type SoundPalette = "velvet" | "voltage" | "porcelain";
export type SongSection = "INTRO" | "VERSE" | "PRE" | "CHORUS" | "BRIDGE" | "OUTRO";
export type ChordQuality = "major" | "minor" | "sus2";

export interface InstrumentTrack {
  readonly id: TrackId;
  readonly name: string;
  readonly description: string;
  readonly colour: string;
  readonly key: string;
}

export interface NoteEvent {
  readonly pitch?: number;
  readonly length: number;
  readonly velocity: number;
  readonly chord?: ChordQuality;
}

export type StepCell = NoteEvent | null;
export type Pattern = StepCell[][];

export interface SongBar {
  readonly name: string;
  readonly section: SongSection;
  readonly rows: readonly (readonly StepCell[])[];
}

export interface Composition {
  readonly id: string;
  readonly title: string;
  readonly character: string;
  readonly tempo: number;
  readonly swing: number;
  readonly palette: SoundPalette;
  readonly accent: string;
  readonly keyLabel: string;
  readonly scale: readonly number[];
  readonly bars: readonly SongBar[];
}

export const STEPS_PER_BAR = 16;
export const BARS_PER_SONG = 8;

export const INSTRUMENT_TRACKS: readonly InstrumentTrack[] = [
  { id: "kick", name: "Pulse", description: "Deep kick", colour: "#ff725e", key: "a" },
  { id: "snare", name: "Clap", description: "Air and snap", colour: "#f2bf4b", key: "s" },
  { id: "bass", name: "Lowline", description: "Rounded bass", colour: "#52c896", key: "d" },
  { id: "keys", name: "Harmony", description: "Wide chords", colour: "#5aa7ff", key: "j" },
  { id: "pluck", name: "Lead", description: "Written melody", colour: "#a787ff", key: "k" },
  { id: "bell", name: "Glint", description: "High counterline", colour: "#ff8fc2", key: "l" },
] as const;

type NoteToken = number | readonly [pitch: number, length: number] | null;
type ChordToken = readonly [step: number, pitch: number, quality: ChordQuality];

function fixedRow(cells: readonly StepCell[]): readonly StepCell[] {
  return Array.from({ length: STEPS_PER_BAR }, (_, step) => cells[step] ?? null);
}

function rhythm(steps: readonly number[], softer: readonly number[] = []): readonly StepCell[] {
  const active = new Set(steps);
  const soft = new Set(softer);
  return Array.from({ length: STEPS_PER_BAR }, (_, step) =>
    active.has(step) ? { length: 0.45, velocity: soft.has(step) ? 0.55 : 0.9 } : null,
  );
}

function melodic(tokens: readonly NoteToken[], velocity = 0.78): readonly StepCell[] {
  return fixedRow(
    tokens.map((token) => {
      if (token === null) return null;
      if (typeof token === "number") return { pitch: token, length: 1.55, velocity };
      return { pitch: token[0], length: token[1], velocity };
    }),
  );
}

function bassPhrase(firstRoot: number, secondRoot: number): readonly StepCell[] {
  return melodic(
    [firstRoot, null, null, firstRoot + 7, null, null, firstRoot + 12, null,
      secondRoot, null, null, secondRoot + 7, null, null, secondRoot + 12, null],
    0.76,
  );
}

function chords(events: readonly ChordToken[]): readonly StepCell[] {
  const row: StepCell[] = Array.from({ length: STEPS_PER_BAR }, () => null);
  for (const [step, pitch, chord] of events) {
    row[step] = { pitch, chord, length: 7.6, velocity: 0.62 };
  }
  return row;
}

function makeBar(
  name: string,
  section: SongSection,
  options: {
    readonly kick: readonly number[];
    readonly snare: readonly number[];
    readonly bass: readonly [number, number];
    readonly harmony: readonly ChordToken[];
    readonly lead: readonly NoteToken[];
    readonly glint: readonly NoteToken[];
    readonly softKick?: readonly number[];
  },
): SongBar {
  return {
    name,
    section,
    rows: [
      rhythm(options.kick, options.softKick),
      rhythm(options.snare),
      bassPhrase(options.bass[0], options.bass[1]),
      chords(options.harmony),
      melodic(options.lead, 0.82),
      melodic(options.glint, 0.58),
    ],
  };
}

const FOUR = [0, 4, 8, 12] as const;
const PUSH = [0, 3, 4, 8, 11, 12] as const;
const BACKBEAT = [4, 12] as const;
const BUSY_BACKBEAT = [4, 7, 12, 15] as const;

export const COMPOSITIONS: readonly Composition[] = [
  {
    id: "glasshouse-morning",
    title: "Glasshouse Morning",
    character: "Sunlit chamber pop",
    tempo: 104,
    swing: 8,
    palette: "velvet",
    accent: "#52c896",
    keyLabel: "C MAJOR",
    scale: [60, 62, 64, 65, 67, 69, 71, 72],
    bars: [
      makeBar("Dawn air", "INTRO", {
        kick: [0, 8], snare: [4, 12], bass: [36, 33],
        harmony: [[0, 48, "major"], [8, 45, "minor"]],
        lead: [64, null, 67, null, 69, null, 67, null, 64, null, 62, null, 60, null, [62, 2], null],
        glint: [72, null, null, null, null, null, 76, null, null, null, null, null, 72, null, null, null],
      }),
      makeBar("Window light", "VERSE", {
        kick: FOUR, snare: BACKBEAT, bass: [41, 43],
        harmony: [[0, 53, "major"], [8, 55, "major"]],
        lead: [69, null, 72, null, 71, null, 67, null, 69, null, 67, null, 64, null, [62, 2], null],
        glint: [null, null, 77, null, null, null, 74, null, null, null, 76, null, null, null, 71, null],
      }),
      makeBar("Green room", "VERSE", {
        kick: PUSH, snare: BACKBEAT, bass: [45, 41],
        harmony: [[0, 45, "minor"], [8, 53, "major"]],
        lead: [64, null, 69, null, 72, null, 71, null, 69, null, 67, null, 64, null, [65, 2], null],
        glint: [76, null, null, null, 72, null, null, null, 77, null, null, null, 76, null, null, null],
      }),
      makeBar("Climbing ivy", "PRE", {
        kick: PUSH, snare: BUSY_BACKBEAT, bass: [38, 43],
        harmony: [[0, 50, "minor"], [8, 55, "sus2"]],
        lead: [65, null, 69, null, 72, null, 74, null, 71, null, 69, null, 67, null, [71, 2], null],
        glint: [null, 77, null, null, null, 81, null, null, null, 79, null, null, null, 74, null, null],
      }),
      makeBar("All the colour", "CHORUS", {
        kick: [0, 3, 4, 7, 8, 11, 12, 15], snare: BUSY_BACKBEAT, bass: [36, 43],
        harmony: [[0, 48, "major"], [8, 55, "major"]],
        lead: [72, null, 72, 71, 69, null, 67, null, 74, null, 71, null, 67, null, [69, 2], null],
        glint: [79, null, null, 76, null, null, 72, null, 79, null, null, 74, null, null, 76, null],
      }),
      makeBar("Open roof", "CHORUS", {
        kick: [0, 3, 4, 8, 11, 12], snare: BUSY_BACKBEAT, bass: [45, 41],
        harmony: [[0, 45, "minor"], [8, 53, "major"]],
        lead: [72, null, 76, null, 74, 72, 71, null, 69, null, 67, null, 69, null, [72, 2], null],
        glint: [81, null, null, null, 79, null, 76, null, 77, null, null, null, 76, null, 79, null],
      }),
      makeBar("Rain memory", "BRIDGE", {
        kick: [0, 8, 11], snare: [4, 12], bass: [38, 45],
        harmony: [[0, 50, "minor"], [8, 45, "minor"]],
        lead: [74, null, 72, null, 69, null, 65, null, 69, null, 72, null, 71, null, [67, 2], null],
        glint: [null, null, 77, null, null, null, 72, null, null, null, 76, null, null, null, 74, null],
      }),
      makeBar("Home in the glass", "OUTRO", {
        kick: [0, 8], snare: [4], bass: [41, 36],
        harmony: [[0, 53, "major"], [8, 48, "major"]],
        lead: [69, null, 67, null, 65, null, 64, null, 62, null, 64, null, 60, null, [60, 2], null],
        glint: [77, null, null, null, 76, null, null, null, 72, null, null, null, 79, null, [72, 2], null],
      }),
    ],
  },
  {
    id: "neon-letters",
    title: "Neon Letters",
    character: "Electric night drive",
    tempo: 126,
    swing: 18,
    palette: "voltage",
    accent: "#ff725e",
    keyLabel: "E MINOR",
    scale: [64, 66, 67, 69, 71, 72, 74, 76],
    bars: [
      makeBar("Street wakes", "INTRO", {
        kick: FOUR, snare: BACKBEAT, bass: [40, 36],
        harmony: [[0, 52, "minor"], [8, 48, "major"]],
        lead: [71, null, 67, null, 64, null, 67, null, 71, null, 74, null, 71, null, [67, 2], null],
        glint: [83, null, null, null, 79, null, null, null, 76, null, null, null, 79, null, null, null],
      }),
      makeBar("Red signal", "VERSE", {
        kick: PUSH, snare: BACKBEAT, bass: [43, 38],
        harmony: [[0, 55, "major"], [8, 50, "major"]],
        lead: [76, null, 74, null, 71, null, 67, null, 69, null, 71, null, 74, null, [71, 2], null],
        glint: [null, 79, null, null, null, 83, null, null, null, 78, null, null, null, 81, null, null],
      }),
      makeBar("Message unsent", "VERSE", {
        kick: [0, 4, 7, 8, 12], snare: BUSY_BACKBEAT, bass: [40, 36],
        harmony: [[0, 52, "minor"], [8, 48, "major"]],
        lead: [71, 74, 76, null, 74, null, 71, null, 67, 69, 71, null, 69, null, [67, 2], null],
        glint: [83, null, null, 86, null, null, 83, null, 79, null, null, 81, null, null, 79, null],
      }),
      makeBar("Overpass", "PRE", {
        kick: [0, 2, 4, 6, 8, 10, 12, 14], snare: BUSY_BACKBEAT, bass: [36, 38],
        harmony: [[0, 48, "major"], [8, 50, "sus2"]],
        lead: [72, null, 74, null, 76, null, 78, null, 74, null, 76, null, 78, null, [79, 2], null],
        glint: [null, null, 84, null, null, null, 86, null, null, null, 81, null, null, null, 83, null],
      }),
      makeBar("Neon letters", "CHORUS", {
        kick: [0, 3, 4, 7, 8, 11, 12, 15], snare: BUSY_BACKBEAT, bass: [40, 43],
        harmony: [[0, 52, "minor"], [8, 55, "major"]],
        lead: [79, null, 79, 78, 76, null, 74, null, 71, null, 74, null, 76, null, [74, 2], null],
        glint: [83, null, 86, null, null, 83, null, null, 79, null, 83, null, null, 81, null, null],
      }),
      makeBar("Say it aloud", "CHORUS", {
        kick: [0, 3, 4, 8, 11, 12, 15], snare: BUSY_BACKBEAT, bass: [36, 38],
        harmony: [[0, 48, "major"], [8, 50, "major"]],
        lead: [76, null, 79, null, 78, 76, 74, null, 71, null, 69, null, 71, null, [74, 2], null],
        glint: [84, null, null, 83, null, null, 81, null, 78, null, null, 81, null, null, 83, null],
      }),
      makeBar("Under the river", "BRIDGE", {
        kick: [0, 8, 12], snare: [4, 12], bass: [45, 36],
        harmony: [[0, 57, "minor"], [8, 48, "major"]],
        lead: [69, null, 72, null, 76, null, 74, null, 71, null, 67, null, 69, null, [71, 2], null],
        glint: [81, null, null, null, 84, null, null, null, 79, null, null, null, 76, null, null, null],
      }),
      makeBar("Tail lights", "OUTRO", {
        kick: [0, 4, 8], snare: [4, 12], bass: [38, 40],
        harmony: [[0, 50, "major"], [8, 52, "minor"]],
        lead: [74, null, 71, null, 69, null, 67, null, 66, null, 67, null, 64, null, [64, 2], null],
        glint: [81, null, null, null, 79, null, null, null, 76, null, null, null, 83, null, [76, 2], null],
      }),
    ],
  },
  {
    id: "small-hours",
    title: "Small Hours",
    character: "Tender after-midnight soul",
    tempo: 94,
    swing: 22,
    palette: "porcelain",
    accent: "#a787ff",
    keyLabel: "D MAJOR",
    scale: [62, 64, 66, 67, 69, 71, 73, 74],
    bars: [
      makeBar("Blue room", "INTRO", {
        kick: [0, 8], snare: [4, 12], bass: [38, 35],
        harmony: [[0, 50, "major"], [8, 47, "minor"]],
        lead: [66, null, 69, null, 71, null, 69, null, 66, null, 64, null, 62, null, [64, 2], null],
        glint: [78, null, null, null, 81, null, null, null, 74, null, null, null, 76, null, null, null],
      }),
      makeBar("Half a sentence", "VERSE", {
        kick: FOUR, snare: BACKBEAT, bass: [43, 45],
        harmony: [[0, 55, "major"], [8, 57, "major"]],
        lead: [67, null, 71, null, 74, null, 73, null, 69, null, 66, null, 64, null, [66, 2], null],
        glint: [79, null, null, null, 83, null, null, null, 81, null, null, null, 78, null, null, null],
      }),
      makeBar("Second cup", "VERSE", {
        kick: PUSH, snare: BACKBEAT, bass: [35, 43],
        harmony: [[0, 47, "minor"], [8, 55, "major"]],
        lead: [71, null, 74, null, 78, null, 76, null, 74, null, 71, null, 69, null, [67, 2], null],
        glint: [83, null, null, null, 86, null, null, null, 81, null, null, null, 79, null, null, null],
      }),
      makeBar("Almost morning", "PRE", {
        kick: [0, 4, 8, 11, 12], snare: BUSY_BACKBEAT, bass: [40, 45],
        harmony: [[0, 52, "minor"], [8, 57, "sus2"]],
        lead: [64, null, 67, null, 71, null, 73, null, 74, null, 73, null, 71, null, [69, 2], null],
        glint: [76, null, null, 79, null, null, 83, null, 86, null, null, 85, null, null, 81, null],
      }),
      makeBar("Stay a while", "CHORUS", {
        kick: [0, 3, 4, 8, 11, 12], snare: BUSY_BACKBEAT, bass: [38, 45],
        harmony: [[0, 50, "major"], [8, 57, "major"]],
        lead: [74, null, 74, 73, 71, null, 69, null, 76, null, 73, null, 69, null, [71, 2], null],
        glint: [81, null, null, 78, null, null, 74, null, 85, null, null, 81, null, null, 83, null],
      }),
      makeBar("Lights still on", "CHORUS", {
        kick: [0, 3, 4, 7, 8, 12], snare: BUSY_BACKBEAT, bass: [35, 43],
        harmony: [[0, 47, "minor"], [8, 55, "major"]],
        lead: [74, null, 78, null, 76, 74, 73, null, 71, null, 69, null, 71, null, [74, 2], null],
        glint: [83, null, null, null, 86, null, 85, null, 83, null, null, null, 81, null, 86, null],
      }),
      makeBar("Quiet truth", "BRIDGE", {
        kick: [0, 8], snare: [4, 12], bass: [40, 35],
        harmony: [[0, 52, "minor"], [8, 47, "minor"]],
        lead: [76, null, 74, null, 71, null, 67, null, 71, null, 74, null, 73, null, [69, 2], null],
        glint: [null, null, 83, null, null, null, 79, null, null, null, 86, null, null, null, 81, null],
      }),
      makeBar("First bus home", "OUTRO", {
        kick: [0, 8], snare: [4], bass: [43, 38],
        harmony: [[0, 55, "major"], [8, 50, "major"]],
        lead: [67, null, 69, null, 71, null, 69, null, 66, null, 64, null, 62, null, [62, 2], null],
        glint: [79, null, null, null, 81, null, null, null, 78, null, null, null, 86, null, [74, 2], null],
      }),
    ],
  },
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createEmptyPattern(): Pattern {
  return INSTRUMENT_TRACKS.map(() => Array.from({ length: STEPS_PER_BAR }, () => null));
}

export function patternFromBar(bar: SongBar): Pattern {
  return INSTRUMENT_TRACKS.map((_, trackIndex) =>
    Array.from({ length: STEPS_PER_BAR }, (_, step) => {
      const cell = bar.rows[trackIndex]?.[step];
      return cell ? { ...cell } : null;
    }),
  );
}

export function clonePattern(pattern: Pattern): Pattern {
  return pattern.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function setPatternCell(
  pattern: Pattern,
  trackIndex: number,
  step: number,
  cell: StepCell,
): Pattern {
  const next = clonePattern(pattern);
  const row = next[trackIndex];
  if (row && step >= 0 && step < STEPS_PER_BAR) row[step] = cell ? { ...cell } : null;
  return next;
}

export function eventForTrack(trackIndex: number, pitch: number): NoteEvent {
  if (trackIndex < 2) return { length: 0.45, velocity: 0.85 };
  return {
    pitch,
    length: trackIndex === 3 ? 6.8 : trackIndex === 5 ? 2.6 : 1.55,
    velocity: trackIndex === 5 ? 0.58 : 0.8,
    ...(trackIndex === 3 ? { chord: "major" as const } : {}),
  };
}

export function noteName(pitch: number | undefined): string {
  if (pitch === undefined) return "";
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
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
