import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve("dist/index.html"), "utf8");
const doc = new JSDOM(html).window.document;
const source = readFileSync(resolve("main.ts"), "utf8");
const css = readFileSync(resolve("styles.css"), "utf8");

describe("crit 4: the browser is a playable instrument", () => {
  it("opens on one obvious gesture that can make the first sound", () => {
    const entry = doc.querySelector<HTMLButtonElement>(
      '[data-testid="begin-instrument"]',
    );

    expect(entry).toBeTruthy();
    expect(entry?.textContent?.trim().length).toBeGreaterThan(0);
    expect(entry?.getAttribute("aria-controls")).toBe("instrument-stage");
  });

  it("exposes one full-stage performance surface and a live state", () => {
    expect(doc.querySelectorAll('[data-testid="instrument"]')).toHaveLength(1);
    expect(doc.querySelector('canvas[aria-label]')).toBeTruthy();

    const status = doc.querySelector('[data-testid="instrument-status"]');
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });

  it("synthesizes live instead of playing a recording", () => {
    expect(doc.querySelector("audio, video")).toBeNull();
    expect(source).toMatch(/AudioContext/);
    expect(source).toMatch(/OscillatorNode/);
    expect(source).toMatch(/GainNode/);
  });

  it("accepts pointer and keyboard performances", () => {
    expect(source).toMatch(/pointerdown/);
    expect(source).toMatch(/pointermove/);
    expect(source).toMatch(/keydown/);
  });

  it("has no score or failure language", () => {
    expect(doc.body.textContent).not.toMatch(/\b(score|fail(?:ed|ure)?|wrong)\b/i);
  });

  it("adapts the instrument at the phone breakpoint", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*600px\)/);
  });
});
