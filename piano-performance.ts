import type {
  Composition,
  SongBar,
  StepCell,
} from "./instrument-model.ts";
import { STEPS_PER_BAR } from "./instrument-model.ts";

type VoiceToken = number | readonly [pitch: number, duration: number];

interface PhraseVoices {
  readonly bass: readonly VoiceToken[];
  readonly tenor: readonly VoiceToken[];
  readonly soprano: readonly VoiceToken[];
  readonly alto: readonly VoiceToken[];
}

export interface ClassicPianoPerformance extends Omit<Composition, "bars"> {
  readonly composer: string;
  readonly sourceWork: string;
  readonly scoreSource: string;
  readonly publicDomain: true;
  readonly bars: readonly SongBar[];
}

function emptyRow(): readonly StepCell[] {
  return Array.from({ length: STEPS_PER_BAR }, () => null);
}

function voiceRow(tokens: readonly VoiceToken[], velocity: number): readonly StepCell[] {
  const row: StepCell[] = Array.from({ length: STEPS_PER_BAR }, () => null);
  let cursor = 0;

  for (const token of tokens) {
    const [pitch, duration] = typeof token === "number" ? [token, 2] : token;
    if (cursor >= STEPS_PER_BAR || duration <= 0) throw new Error("Invalid Ode to Joy notation");
    row[cursor] = {
      pitch,
      length: Math.max(0.82, duration - 0.18),
      velocity: cursor % 8 === 0 ? velocity : velocity * 0.92,
    };
    cursor += duration;
  }

  if (cursor !== STEPS_PER_BAR) throw new Error("Each Ode to Joy phrase must contain two 4/4 bars");
  return row;
}

function phrase(
  name: string,
  section: SongBar["section"],
  voices: PhraseVoices,
): SongBar {
  return {
    name,
    section,
    rows: [
      emptyRow(),
      emptyRow(),
      voiceRow(voices.bass, 0.64),
      voiceRow(voices.tenor, 0.54),
      voiceRow(voices.soprano, 0.9),
      voiceRow(voices.alto, 0.5),
    ],
  };
}

// Mutopia's SATB source is in G major. Every voice is transposed down a fourth to D major.
const OPENING: PhraseVoices = {
  soprano: [66, 66, 67, 69, 69, 67, 66, 64],
  alto: [62, 62, 64, 62, [62, 3], [64, 1], 62, 61],
  tenor: [57, 57, 55, 54, [59, 3], [57, 1], 57, 57],
  bass: [50, 50, 50, 50, [47, 3], [49, 1], 50, 45],
};

const FIRST_CADENCE: PhraseVoices = {
  soprano: [62, 62, 64, 66, [66, 3], [64, 1], [64, 4]],
  alto: [57, 57, 61, 62, [62, 3], [61, 1], [61, 4]],
  tenor: [54, 54, 57, 57, [57, 3], [57, 1], [57, 4]],
  bass: [54, 54, 52, 50, [45, 3], [45, 1], [45, 4]],
};

const HOME_CADENCE: PhraseVoices = {
  soprano: [62, 62, 64, 66, [64, 3], [62, 1], [62, 4]],
  alto: [57, 57, 61, 62, 62, 61, [57, 4]],
  tenor: [54, 54, 57, 57, 57, 57, [54, 4]],
  bass: [54, 54, 52, 50, 45, 45, [38, 4]],
};

const RISING_PASSAGE: PhraseVoices = {
  soprano: [64, 64, 66, 62, 64, [66, 1], [67, 1], 66, 62],
  alto: [57, 57, 57, 57, 57, 57, 57, 57],
  tenor: [49, 49, 50, 47, 49, [50, 1], [52, 1], 50, 47],
  bass: [45, 45, 45, 45, 45, 45, 45, 45],
};

const TURNAROUND: PhraseVoices = {
  soprano: [64, [66, 1], [67, 1], 66, 64, 62, 64, [57, 4]],
  alto: [57, 57, 61, 61, 59, 56, [57, 4]],
  tenor: [49, 49, 49, 54, 54, 52, 50, 49],
  bass: [45, 45, 46, 46, 47, 40, [45, 4]],
};

const FINAL_OPENING: PhraseVoices = {
  soprano: OPENING.soprano,
  alto: [57, 62, 64, 64, 66, [62, 1], [64, 1], 62, 59],
  tenor: [50, 57, 60, 60, [62, 3], [57, 1], 57, 55],
  bass: [50, 50, 48, 48, [47, 3], [49, 1], 50, 43],
};

const FINAL_CADENCE: PhraseVoices = {
  soprano: HOME_CADENCE.soprano,
  alto: [59, 57, 61, 62, 62, 61, [62, 4]],
  tenor: [50, 50, 55, 57, 57, 57, [54, 4]],
  bass: [43, 42, 40, 38, 45, 45, [38, 4]],
};

export const CLASSIC_PERFORMANCE: ClassicPianoPerformance = {
  id: "ode-to-joy",
  title: "Ode to Joy",
  composer: "Ludwig van Beethoven",
  sourceWork: "Symphony No. 9, fourth movement",
  scoreSource: "https://www.ibiblio.org/mutopia/ftp/BeethovenLv/ode/ode.ly",
  publicDomain: true,
  character: "Public-domain classical theme",
  tempo: 112,
  swing: 0,
  palette: "porcelain",
  accent: "#f2bf4b",
  keyLabel: "D MAJOR",
  scale: [62, 64, 66, 67, 69, 71, 73, 74],
  bars: [
    phrase("First statement", "INTRO", OPENING),
    phrase("First cadence", "VERSE", FIRST_CADENCE),
    phrase("Theme returns", "VERSE", OPENING),
    phrase("Home answer", "PRE", HOME_CADENCE),
    phrase("Joy rises", "CHORUS", RISING_PASSAGE),
    phrase("Bright turn", "BRIDGE", TURNAROUND),
    phrase("Final statement", "CHORUS", FINAL_OPENING),
    phrase("Final cadence", "OUTRO", FINAL_CADENCE),
  ],
};
