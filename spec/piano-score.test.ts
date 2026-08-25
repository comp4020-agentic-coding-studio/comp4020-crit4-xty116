import { describe, expect, it } from "vitest";
import { compositionDurationSeconds } from "../instrument-model.ts";
import { CLASSIC_PERFORMANCE } from "../piano-performance.ts";

describe("Piano Room public-domain score", () => {
  it("credits a recognisable public-domain work", () => {
    expect(CLASSIC_PERFORMANCE.title).toBe("Ode to Joy");
    expect(CLASSIC_PERFORMANCE.composer).toBe("Ludwig van Beethoven");
    expect(CLASSIC_PERFORMANCE.publicDomain).toBe(true);
  });

  it("contains a full sixteen-bar piano arrangement", () => {
    expect(CLASSIC_PERFORMANCE.bars).toHaveLength(8);
    for (const phrase of CLASSIC_PERFORMANCE.bars) {
      expect(phrase.rows).toHaveLength(6);
      for (const row of phrase.rows) expect(row).toHaveLength(16);
    }
    expect(compositionDurationSeconds(CLASSIC_PERFORMANCE)).toBeCloseTo(34.29, 1);
  });

  it("writes the familiar opening melody explicitly", () => {
    const melody = CLASSIC_PERFORMANCE.bars[0].rows[4]
      .filter((event) => event?.pitch !== undefined)
      .map((event) => event?.pitch);
    expect(melody).toEqual([66, 66, 67, 69, 69, 67, 66, 64]);

    const allMelody = CLASSIC_PERFORMANCE.bars.flatMap((phrase) => phrase.rows[4]);
    expect(allMelody.filter((event) => event?.pitch !== undefined).length).toBeGreaterThanOrEqual(60);
    expect(new Set(allMelody.map((event) => event?.pitch).filter(Boolean)).size).toBeGreaterThanOrEqual(6);
  });

  it("includes bass, harmony and arpeggiated accompaniment", () => {
    const eventsForRow = (rowIndex: number) =>
      CLASSIC_PERFORMANCE.bars.flatMap((phrase) => phrase.rows[rowIndex]).filter(Boolean);
    expect(eventsForRow(2).length).toBeGreaterThanOrEqual(32);
    expect(eventsForRow(3).every((event) => event?.chord)).toBe(true);
    expect(eventsForRow(5).length).toBeGreaterThanOrEqual(32);
  });
});
