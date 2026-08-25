import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve("dist/piano.html"), "utf8");
const doc = new JSDOM(html).window.document;
const source = readFileSync(resolve("piano.ts"), "utf8");
const css = readFileSync(resolve("piano.css"), "utf8");

describe("crit 4: Piano Room is a second complete live instrument", () => {
  it("links both performance rooms and identifies the current one", () => {
    expect(doc.querySelector('a[href="./index.html"]')).toBeTruthy();
    expect(doc.querySelector('a[href="./piano.html"][aria-current="page"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="piano-instrument"]')).toBeTruthy();
  });

  it("makes the piano itself the primary performance surface", () => {
    expect(doc.querySelector('[data-testid="begin-piano"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="piano-keyboard"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="piano-visual"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="piano-status"][aria-live="polite"]')).toBeTruthy();
  });

  it("offers musical controls and a player-started full performance", () => {
    expect(doc.querySelectorAll("[data-timbre]")).toHaveLength(3);
    expect(doc.querySelector('[data-timbre="grand"][aria-pressed="true"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="sustain-toggle"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="octave-down"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="octave-up"]')).toBeTruthy();
    expect(doc.querySelector('input[name="piano-volume"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="piano-demo"]')).toBeTruthy();
    expect(source).toMatch(/COMPOSITIONS/);
    expect(source).toMatch(/scheduleDemo/);
  });

  it("makes the complete A0-C8 piano range reachable inside the bench", () => {
    expect(doc.querySelector('[data-testid="keyboard-navigator"]')).toBeTruthy();
    expect(doc.querySelector('[data-testid="keyboard-scroll"]')).toBeTruthy();
    expect(source).toMatch(/FULL_KEYBOARD_LOW\s*=\s*21/);
    expect(source).toMatch(/FULL_KEYBOARD_HIGH\s*=\s*108/);
    expect(source).toMatch(/scrollToMidi/);
    expect(css).toMatch(/\.piano-keyboard\s*\{[^}]*width:\s*2704px/s);
  });

  it("synthesizes sound live and accepts expressive pointer and key input", () => {
    expect(doc.querySelector("audio, video")).toBeNull();
    expect(source).toMatch(/AudioContext/);
    expect(source).toMatch(/OscillatorNode/);
    expect(source).toMatch(/GainNode/);
    expect(source).toMatch(/BiquadFilterNode/);
    expect(source).toMatch(/createHammerTransient/);
    expect(source).toMatch(/AudioBufferSourceNode/);
    expect(source).toMatch(/pointerdown/);
    expect(source).toMatch(/pointermove/);
    expect(source).toMatch(/pointerup/);
    expect(source).toMatch(/keydown/);
    expect(source).toMatch(/keyup/);
  });

  it("keeps the performance alive and playable at the phone breakpoint", () => {
    expect(source).toMatch(/requestAnimationFrame/);
    expect(source).toMatch(/matchMedia/);
    expect(css).toMatch(/@media\s*\(max-width:\s*700px\)/);
  });
});
