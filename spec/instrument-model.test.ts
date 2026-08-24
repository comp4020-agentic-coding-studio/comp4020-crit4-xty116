import { describe, expect, it } from "vitest";
import {
  INSTRUMENT_NOTES,
  PATTERN_PRESETS,
  STEP_COUNT,
  createEmptyPattern,
  noteIndexForKey,
  patternFromPreset,
  setPatternCell,
  stepDurationSeconds,
  transportClockSeconds,
} from "../instrument-model";

describe("loop press music model", () => {
  it("keeps every playable pitch inside one ordered scale", () => {
    expect(INSTRUMENT_NOTES).toHaveLength(6);
    for (let index = 1; index < INSTRUMENT_NOTES.length; index += 1) {
      expect(INSTRUMENT_NOTES[index]?.frequency).toBeGreaterThan(
        INSTRUMENT_NOTES[index - 1]?.frequency ?? 0,
      );
    }
  });

  it("ships editable example patterns with the full grid shape", () => {
    expect(PATTERN_PRESETS).toHaveLength(3);
    for (const preset of PATTERN_PRESETS) {
      const pattern = patternFromPreset(preset);
      expect(pattern).toHaveLength(INSTRUMENT_NOTES.length);
      expect(pattern.every((row) => row.length === STEP_COUNT)).toBe(true);
      expect(pattern.flat().some(Boolean)).toBe(true);
    }
  });

  it("edits a cell without mutating the previous pattern", () => {
    const original = createEmptyPattern();
    const changed = setPatternCell(original, 2, 4, true);

    expect(original[2]?.[4]).toBe(false);
    expect(changed[2]?.[4]).toBe(true);
  });

  it("maps performance keys and ignores browser commands", () => {
    expect(noteIndexForKey("a")).toBe(0);
    expect(noteIndexForKey("L")).toBe(5);
    expect(noteIndexForKey("Escape")).toBeNull();
  });

  it("keeps a swung pair the same overall length", () => {
    const straightPair = stepDurationSeconds(120, 0, 0) + stepDurationSeconds(120, 1, 0);
    const swungPair = stepDurationSeconds(120, 0, 0.3) + stepDurationSeconds(120, 1, 0.3);

    expect(swungPair).toBeCloseTo(straightPair);
    expect(stepDurationSeconds(160, 0, 0)).toBeLessThan(stepDurationSeconds(80, 0, 0));
  });

  it("keeps transport moving while audio permission resumes", () => {
    expect(transportClockSeconds("running", 4.5, 12)).toBe(4.5);
    expect(transportClockSeconds("suspended", 0, 12)).toBe(12);
    expect(transportClockSeconds(undefined, 0, 12)).toBe(12);
  });
});
