import { describe, expect, it } from "vitest";
import { compositionDurationSeconds } from "../instrument-model.ts";
import { CLASSIC_PERFORMANCE } from "../piano-performance.ts";

describe("Piano Room public-domain score", () => {
  it("credits a recognisable public-domain work", () => {
    expect(CLASSIC_PERFORMANCE.title).toBe("Ode to Joy");
    expect(CLASSIC_PERFORMANCE.composer).toBe("Ludwig van Beethoven");
    expect(CLASSIC_PERFORMANCE.publicDomain).toBe(true);
    expect(CLASSIC_PERFORMANCE.scoreSource).toContain("mutopia");
  });

  it("contains a full sixteen-bar piano arrangement", () => {
    expect(CLASSIC_PERFORMANCE.bars).toHaveLength(8);
    for (const phrase of CLASSIC_PERFORMANCE.bars) {
      expect(phrase.rows).toHaveLength(6);
      for (const row of phrase.rows) expect(row).toHaveLength(16);
    }
    expect(compositionDurationSeconds(CLASSIC_PERFORMANCE)).toBeCloseTo(34.29, 1);
  });

  it("matches the complete sixteen-bar soprano melody and its onsets", () => {
    const expected = [
      [[0, 66], [2, 66], [4, 67], [6, 69], [8, 69], [10, 67], [12, 66], [14, 64]],
      [[0, 62], [2, 62], [4, 64], [6, 66], [8, 66], [11, 64], [12, 64]],
      [[0, 66], [2, 66], [4, 67], [6, 69], [8, 69], [10, 67], [12, 66], [14, 64]],
      [[0, 62], [2, 62], [4, 64], [6, 66], [8, 64], [11, 62], [12, 62]],
      [[0, 64], [2, 64], [4, 66], [6, 62], [8, 64], [10, 66], [11, 67], [12, 66], [14, 62]],
      [[0, 64], [2, 66], [3, 67], [4, 66], [6, 64], [8, 62], [10, 64], [12, 57]],
      [[0, 66], [2, 66], [4, 67], [6, 69], [8, 69], [10, 67], [12, 66], [14, 64]],
      [[0, 62], [2, 62], [4, 64], [6, 66], [8, 64], [11, 62], [12, 62]],
    ];
    const notation = CLASSIC_PERFORMANCE.bars.map((phrase) =>
      phrase.rows[4].flatMap((event, step) => event?.pitch === undefined ? [] : [[step, event.pitch]]),
    );
    expect(notation).toEqual(expected);

    const firstCadence = CLASSIC_PERFORMANCE.bars[1].rows[4];
    expect(firstCadence[8]?.length).toBeCloseTo(2.82);
    expect(firstCadence[11]?.length).toBeCloseTo(0.82);
    expect(firstCadence[12]?.length).toBeCloseTo(3.82);
  });

  it("uses the source score's four-part accompaniment instead of guessed chords", () => {
    const eventsForRow = (rowIndex: number) =>
      CLASSIC_PERFORMANCE.bars.flatMap((phrase) => phrase.rows[rowIndex]).filter(Boolean);
    for (const rowIndex of [2, 3, 4, 5]) {
      expect(eventsForRow(rowIndex).length).toBeGreaterThanOrEqual(60);
      expect(eventsForRow(rowIndex).every((event) => event?.pitch !== undefined)).toBe(true);
      expect(eventsForRow(rowIndex).every((event) => event?.chord === undefined)).toBe(true);
    }
  });
});
