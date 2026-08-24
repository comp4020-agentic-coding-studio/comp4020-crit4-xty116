export interface ScaleNote {
  readonly name: string;
  readonly frequency: number;
  readonly colour: string;
}

export interface GestureVoice {
  readonly note: ScaleNote;
  readonly brightness: number;
  readonly intensity: number;
  readonly pan: number;
}

export const HARMONIC_SCALE: readonly ScaleNote[] = [
  { name: "C3", frequency: 130.81, colour: "#65d9d2" },
  { name: "D3", frequency: 146.83, colour: "#91e4b1" },
  { name: "E3", frequency: 164.81, colour: "#d5e77a" },
  { name: "F#3", frequency: 185, colour: "#ffd166" },
  { name: "A3", frequency: 220, colour: "#ff9a62" },
  { name: "C4", frequency: 261.63, colour: "#ff6f61" },
  { name: "D4", frequency: 293.66, colour: "#ee82b7" },
  { name: "E4", frequency: 329.63, colour: "#be8ee8" },
  { name: "F#4", frequency: 369.99, colour: "#8aa7ed" },
  { name: "A4", frequency: 440, colour: "#65c5ed" },
  { name: "C5", frequency: 523.25, colour: "#65d9d2" },
  { name: "D5", frequency: 587.33, colour: "#91e4b1" },
  { name: "E5", frequency: 659.25, colour: "#d5e77a" },
  { name: "F#5", frequency: 739.99, colour: "#ffd166" },
  { name: "A5", frequency: 880, colour: "#ff9a62" },
] as const;

export const KEYBOARD_KEYS = [
  "a",
  "s",
  "d",
  "f",
  "g",
  "h",
  "j",
  "k",
  "l",
  ";",
] as const;

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function voiceForPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  pressure = 0.65,
): GestureVoice {
  const normalX = clamp(x / Math.max(1, width));
  const normalY = clamp(y / Math.max(1, height));
  const index = Math.min(
    HARMONIC_SCALE.length - 1,
    Math.floor(normalX * HARMONIC_SCALE.length),
  );

  return {
    note: HARMONIC_SCALE[index] ?? HARMONIC_SCALE[0],
    brightness: 0.18 + (1 - normalY) * 0.82,
    intensity: 0.28 + clamp(pressure) * 0.72,
    pan: normalX * 2 - 1,
  };
}

export function pointForKey(
  key: string,
  width: number,
  height: number,
): { x: number; y: number } | null {
  const index = KEYBOARD_KEYS.indexOf(
    key.toLowerCase() as (typeof KEYBOARD_KEYS)[number],
  );
  if (index < 0) return null;

  return {
    x: ((index + 0.5) / KEYBOARD_KEYS.length) * width,
    y: height * (0.3 + (index % 3) * 0.17),
  };
}
