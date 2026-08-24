import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve("dist/index.html"), "utf8");
const doc = new JSDOM(html).window.document;
const source = readFileSync(resolve("main.ts"), "utf8");
const css = readFileSync(resolve("styles.css"), "utf8");

describe("crit 4: Mosaic is a complete browser composition studio", () => {
  it("opens on one obvious gesture that can make the first sound", () => {
    const entry = doc.querySelector<HTMLButtonElement>('[data-testid="begin-instrument"]');

    expect(entry).toBeTruthy();
    expect(entry?.textContent?.trim().length).toBeGreaterThan(0);
    expect(entry?.getAttribute("aria-controls")).toBe("instrument-stage");
  });

  it("exposes one performance surface, an editable grid and live state", () => {
    expect(doc.querySelectorAll('[data-testid="instrument"]')).toHaveLength(1);
    expect(doc.querySelector('[data-testid="sequencer-grid"]')).toBeTruthy();

    const status = doc.querySelector('[data-testid="instrument-status"]');
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });

  it("offers three complete pieces and a player-started song transport", () => {
    expect(doc.querySelectorAll("[data-composition]")).toHaveLength(3);
    expect(doc.querySelector('[data-testid="bar-navigator"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="transport-toggle"]')).toBeTruthy();
    expect(doc.querySelector('input[name="tempo"]')).toBeTruthy();
    expect(doc.querySelector('input[name="swing"]')).toBeTruthy();
    expect(source).toMatch(/BARS_PER_SONG/);
    expect(source).toMatch(/STEPS_PER_BAR/);
    expect(source).toMatch(/scheduleAhead/);
  });

  it("builds six distinct live-synthesis voices without recordings", () => {
    expect(doc.querySelector("audio, video")).toBeNull();
    expect(source).toMatch(/AudioContext/);
    expect(source).toMatch(/OscillatorNode/);
    expect(source).toMatch(/AudioBufferSourceNode/);
    expect(source).toMatch(/GainNode/);
    expect(source).toMatch(/triggerKick/);
    expect(source).toMatch(/triggerSnare/);
    expect(source).toMatch(/triggerBass/);
    expect(source).toMatch(/triggerKeys/);
    expect(source).toMatch(/triggerPluck/);
    expect(source).toMatch(/triggerBell/);
  });

  it("accepts pointer painting, direct pads and keyboard performances", () => {
    expect(doc.querySelectorAll("[data-track-pad]")).toHaveLength(6);
    expect(source).toMatch(/pointerdown/);
    expect(source).toMatch(/pointermove/);
    expect(source).toMatch(/keydown/);
  });

  it("has no score or failure language", () => {
    expect(doc.body.textContent).not.toMatch(/\b(score|fail(?:ed|ure)?|wrong)\b/i);
  });

  it("adapts the complete studio at the phone breakpoint", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*700px\)/);
  });
});
