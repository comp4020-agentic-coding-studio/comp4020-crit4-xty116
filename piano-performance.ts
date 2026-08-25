import type {
  ChordQuality,
  Composition,
  NoteEvent,
  SongBar,
  StepCell,
} from "./instrument-model.ts";
import { STEPS_PER_BAR } from "./instrument-model.ts";

type MelodyToken = number | readonly [pitch: number, length: number] | null;
type Harmony = readonly [root: number, quality: ChordQuality];

export interface ClassicPianoPerformance extends Omit<Composition, "bars"> {
  readonly composer: string;
  readonly sourceWork: string;
  readonly publicDomain: true;
  readonly bars: readonly SongBar[];
}

function emptyRow(): readonly StepCell[] {
  return Array.from({ length: STEPS_PER_BAR }, () => null);
}

function melodyRow(tokens: readonly MelodyToken[]): readonly StepCell[] {
  const row: StepCell[] = Array.from({ length: STEPS_PER_BAR }, () => null);
  tokens.forEach((token, index) => {
    if (token === null) return;
    const [pitch, length] = typeof token === "number" ? [token, 1.72] : token;
    row[index * 2] = { pitch, length, velocity: index % 4 === 0 ? 0.88 : 0.78 };
  });
  return row;
}

function accompaniment(first: Harmony, second: Harmony): {
  readonly bass: readonly StepCell[];
  readonly harmony: readonly StepCell[];
  readonly arpeggio: readonly StepCell[];
} {
  const bass: StepCell[] = Array.from({ length: STEPS_PER_BAR }, () => null);
  const harmony: StepCell[] = Array.from({ length: STEPS_PER_BAR }, () => null);
  const arpeggio: StepCell[] = Array.from({ length: STEPS_PER_BAR }, () => null);
  const chords = [first, second] as const;

  chords.forEach(([root, quality], barIndex) => {
    const start = barIndex * 8;
    bass[start] = { pitch: root - 12, length: 3.5, velocity: 0.7 };
    bass[start + 4] = { pitch: root - 5, length: 3.5, velocity: 0.62 };
    harmony[start] = { pitch: root, chord: quality, length: 7.5, velocity: 0.5 };

    const third = quality === "minor" ? 3 : quality === "sus2" ? 2 : 4;
    const tones = [root + 12, root + 19, root + 12 + third, root + 19];
    tones.forEach((pitch, toneIndex) => {
      arpeggio[start + toneIndex * 2 + 1] = { pitch, length: 1.25, velocity: 0.42 };
    });
  });

  return { bass, harmony, arpeggio };
}

function phrase(
  name: string,
  section: SongBar["section"],
  first: Harmony,
  second: Harmony,
  melody: readonly MelodyToken[],
): SongBar {
  const parts = accompaniment(first, second);
  return {
    name,
    section,
    rows: [emptyRow(), emptyRow(), parts.bass, parts.harmony, melodyRow(melody), parts.arpeggio],
  };
}

const D: Harmony = [50, "major"];
const A: Harmony = [45, "major"];
const G: Harmony = [43, "major"];
const Bm: Harmony = [47, "minor"];

const OPENING = [66, 66, 67, 69, 69, 67, 66, 64] as const;
const FIRST_CADENCE = [62, 62, 64, 66, 66, 64, [64, 3.8], null] as const;
const HOME_CADENCE = [62, 62, 64, 66, 64, 62, [62, 3.8], null] as const;

export const CLASSIC_PERFORMANCE: ClassicPianoPerformance = {
  id: "ode-to-joy",
  title: "Ode to Joy",
  composer: "Ludwig van Beethoven",
  sourceWork: "Symphony No. 9, fourth movement",
  publicDomain: true,
  character: "Public-domain classical theme",
  tempo: 112,
  swing: 0,
  palette: "porcelain",
  accent: "#f2bf4b",
  keyLabel: "D MAJOR",
  scale: [62, 64, 66, 67, 69, 71, 73, 74],
  bars: [
    phrase("First statement", "INTRO", D, A, OPENING),
    phrase("First cadence", "VERSE", D, A, FIRST_CADENCE),
    phrase("Theme returns", "VERSE", D, A, OPENING),
    phrase("Home answer", "PRE", D, D, HOME_CADENCE),
    phrase("Joy rises", "CHORUS", A, Bm, [64, 64, 66, 62, 64, 66, 67, 66]),
    phrase("Bright turn", "BRIDGE", G, A, [62, 64, 66, 67, 66, 64, 62, 57]),
    phrase("Final statement", "CHORUS", D, A, OPENING),
    phrase("Final cadence", "OUTRO", D, D, HOME_CADENCE),
  ],
};
