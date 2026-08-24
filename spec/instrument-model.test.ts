import { describe, expect, it } from "vitest";
import {
  HARMONIC_SCALE,
  pointForKey,
  voiceForPoint,
} from "../instrument-model";

describe("orbit choir sound map", () => {
  it("keeps every playable pitch inside one ordered scale", () => {
    expect(HARMONIC_SCALE).toHaveLength(15);
    for (let index = 1; index < HARMONIC_SCALE.length; index += 1) {
      expect(HARMONIC_SCALE[index]?.frequency).toBeGreaterThan(
        HARMONIC_SCALE[index - 1]?.frequency ?? 0,
      );
    }
  });

  it("maps the two horizontal edges to the scale edges", () => {
    expect(voiceForPoint(0, 50, 100, 100).note.name).toBe("C3");
    expect(voiceForPoint(100, 50, 100, 100).note.name).toBe("A5");
  });

  it("lets vertical movement change timbre without leaving the pitch", () => {
    const high = voiceForPoint(50, 0, 100, 100);
    const low = voiceForPoint(50, 100, 100, 100);

    expect(high.note).toEqual(low.note);
    expect(high.brightness).toBeGreaterThan(low.brightness);
  });

  it("maps playable keys and ignores browser commands", () => {
    expect(pointForKey("a", 1000, 500)).toEqual({ x: 50, y: 150 });
    expect(pointForKey(";", 1000, 500)).toEqual({ x: 950, y: 150 });
    expect(pointForKey("Escape", 1000, 500)).toBeNull();
  });
});
