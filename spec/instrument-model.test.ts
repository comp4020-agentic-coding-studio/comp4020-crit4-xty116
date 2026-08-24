import { describe, expect, it } from "vitest";
import {
  BARS_PER_SONG,
  COMPOSITIONS,
  INSTRUMENT_TRACKS,
  STEPS_PER_BAR,
  compositionDurationSeconds,
  createEmptyPattern,
  patternFromBar,
  setPatternCell,
  stepDurationSeconds,
  trackIndexForKey,
  transportClockSeconds,
} from "../instrument-model";

describe("complete composition model", () => {
  it("ships three full, varied eight-bar compositions", () => {
    expect(COMPOSITIONS).toHaveLength(3);
    for (const composition of COMPOSITIONS) {
      expect(composition.bars).toHaveLength(BARS_PER_SONG);
      expect(new Set(composition.bars.map((bar) => bar.rows.join("/"))).size).toBeGreaterThanOrEqual(6);
      expect(compositionDurationSeconds(composition)).toBeGreaterThan(30);
      expect(compositionDurationSeconds(composition)).toBeLessThan(45);
    }
  });

  it("gives every bar six complete instrument lanes", () => {
    for (const composition of COMPOSITIONS) {
      for (const bar of composition.bars) {
        const pattern = patternFromBar(bar);
        expect(pattern).toHaveLength(INSTRUMENT_TRACKS.length);
        expect(pattern.every((row) => row.length === STEPS_PER_BAR)).toBe(true);
        expect(pattern.flat().some(Boolean)).toBe(true);
      }
    }
  });

  it("edits a bar without mutating the previous pattern", () => {
    const original = createEmptyPattern();
    const changed = setPatternCell(original, 2, 12, true);

    expect(original[2]?.[12]).toBe(false);
    expect(changed[2]?.[12]).toBe(true);
  });

  it("maps six performance keys and ignores browser commands", () => {
    expect(INSTRUMENT_TRACKS).toHaveLength(6);
    expect(trackIndexForKey("a")).toBe(0);
    expect(trackIndexForKey("L")).toBe(5);
    expect(trackIndexForKey("Escape")).toBeNull();
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
