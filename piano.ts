import {
  COMPOSITIONS,
  STEPS_PER_BAR,
  noteName,
  stepDurationSeconds,
} from "./instrument-model.ts";
import type { ChordQuality, NoteEvent } from "./instrument-model.ts";

type Timbre = "grand" | "felt" | "electric";

interface PianoVoice {
  readonly gain: GainNode;
  readonly oscillators: OscillatorNode[];
  release(at: number): void;
}

interface TimelineStep {
  readonly offset: number;
  readonly duration: number;
  readonly barIndex: number;
  readonly stepIndex: number;
}

interface VisualTrail {
  readonly midi: number;
  readonly velocity: number;
  readonly colour: string;
  readonly started: number;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function requiredCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is required for the piano visual");
  return context;
}

const stage = required<HTMLElement>("#piano-stage");
const keyboard = required<HTMLElement>("#piano-keyboard");
const keyboardScroller = required<HTMLElement>('[data-testid="keyboard-scroll"]');
const keyboardPosition = required<HTMLInputElement>('[data-testid="keyboard-navigator"]');
const whiteKeys = required<HTMLElement>(".white-keys");
const blackKeys = required<HTMLElement>(".black-keys");
const beginButton = required<HTMLButtonElement>('[data-testid="begin-piano"]');
const demoButton = required<HTMLButtonElement>('[data-testid="piano-demo"]');
const demoLabel = required<HTMLElement>("[data-demo-label]");
const status = required<HTMLElement>('[data-testid="piano-status"]');
const sectionLabel = required<HTMLElement>('[data-testid="piano-section"]');
const phraseLabel = required<HTMLElement>('[data-testid="piano-phrase"]');
const progress = required<HTMLElement>("[data-piano-progress]");
const octaveOutput = required<HTMLOutputElement>("[data-octave-output]");
const registerLow = required<HTMLElement>("[data-register-low]");
const registerHigh = required<HTMLElement>("[data-register-high]");
const sustainButton = required<HTMLButtonElement>('[data-testid="sustain-toggle"]');
const sustainLabel = required<HTMLElement>("[data-sustain-label]");
const volumeInput = required<HTMLInputElement>('input[name="piano-volume"]');
const canvas = required<HTMLCanvasElement>("#piano-visual");
const canvasContext = requiredCanvasContext(canvas);

const composition = COMPOSITIONS[0];
const KEY_COLOURS = [
  "#ff725e", "#ff8a65", "#f2bf4b", "#d4c957", "#52c896", "#56c3c0",
  "#5aa7ff", "#7d9dff", "#a787ff", "#c47ee7", "#ff8fc2", "#ff7890",
] as const;
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
const KEYBOARD_KEYS = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k"] as const;
const FULL_KEYBOARD_LOW = 21;
const FULL_KEYBOARD_HIGH = 108;
const CHORD_INTERVALS: Record<ChordQuality, readonly number[]> = {
  major: [0, 4, 7, 12],
  minor: [0, 3, 7, 12],
  sus2: [0, 2, 7, 12],
};

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let roomInput: ConvolverNode | null = null;
let analyser: AnalyserNode | null = null;
let currentTimbre: Timbre = "grand";
let register = 4;
let rangeLowMidi = FULL_KEYBOARD_LOW;
let rangeHighMidi = FULL_KEYBOARD_HIGH;
let sustain = false;
let demoPlaying = false;
let demoStartTime = 0;
let demoScheduleIndex = 0;
let demoInterval: number | null = null;
let demoBus: GainNode | null = null;

const manualVoices = new Map<string, PianoVoice>();
const sustainedSources = new Set<string>();
const pointerNotes = new Map<number, { midi: number; source: string }>();
const keyboardSources = new Map<string, string>();
const activeKeyTokens = new Map<number, Set<string>>();
const demoTimers = new Set<number>();
const visualTrails: VisualTrail[] = [];

function midiForOctave(octave: number): number {
  return (octave + 1) * 12;
}

function frequencyForMidi(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function isBlack(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(((midi % 12) + 12) % 12);
}

function fitToVisibleRange(midi: number): number {
  let fitted = midi;
  while (fitted < rangeLowMidi) fitted += 12;
  while (fitted > rangeHighMidi) fitted -= 12;
  return Math.min(rangeHighMidi, Math.max(rangeLowMidi, fitted));
}

function createKey(midi: number, whiteBefore: number, whiteCount: number): HTMLButtonElement {
  const key = document.createElement("button");
  const black = isBlack(midi);
  key.type = "button";
  key.className = `piano-key ${black ? "black" : "white"}`;
  key.dataset.midi = String(midi);
  key.setAttribute("aria-label", noteName(midi));
  key.style.setProperty("--key-colour", KEY_COLOURS[midi % 12]);
  key.style.setProperty("--white-before", String(whiteBefore));
  key.style.setProperty("--white-count", String(whiteCount));

  const mappingIndex = midi - midiForOctave(register);
  const keyHint = mappingIndex >= 0 && mappingIndex < KEYBOARD_KEYS.length ? KEYBOARD_KEYS[mappingIndex] : null;

  if (keyHint || midi % 12 === 0) {
    const label = document.createElement("span");
    label.className = "piano-key-label";
    const note = document.createElement("span");
    note.textContent = noteName(midi);
    label.append(note);
    if (keyHint) {
      const hint = document.createElement("kbd");
      hint.textContent = keyHint.toUpperCase();
      label.append(hint);
    }
    key.append(label);
  }

  return key;
}

function renderKeyboard(): void {
  rangeLowMidi = FULL_KEYBOARD_LOW;
  rangeHighMidi = FULL_KEYBOARD_HIGH;
  const midis = Array.from({ length: rangeHighMidi - rangeLowMidi + 1 }, (_, index) => rangeLowMidi + index);
  const whiteCount = midis.filter((midi) => !isBlack(midi)).length;
  let whiteBefore = 0;

  whiteKeys.replaceChildren();
  blackKeys.replaceChildren();
  keyboard.style.setProperty("--white-count", String(whiteCount));

  for (const midi of midis) {
    const key = createKey(midi, whiteBefore, whiteCount);
    if (isBlack(midi)) {
      blackKeys.append(key);
    } else {
      whiteKeys.append(key);
      whiteBefore += 1;
    }
  }

  octaveOutput.value = `OCT ${register}`;
  octaveOutput.textContent = `OCT ${register}`;
  registerLow.textContent = "A0";
  registerHigh.textContent = "C8";

  for (const [midi, tokens] of activeKeyTokens) {
    if (tokens.size > 0) keyElement(midi)?.classList.add("is-active");
  }

  requestAnimationFrame(() => scrollToMidi(midiForOctave(register), false));
}

function keyElement(midi: number): HTMLElement | null {
  return keyboard.querySelector<HTMLElement>(`[data-midi="${midi}"]`);
}

function scrollToMidi(midi: number, smooth = true): void {
  const clamped = Math.min(FULL_KEYBOARD_HIGH, Math.max(FULL_KEYBOARD_LOW, midi));
  const key = keyElement(clamped);
  if (!key) return;
  const left = key.offsetLeft + key.offsetWidth / 2 - keyboardScroller.clientWidth / 2;
  keyboardScroller.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
  keyboardPosition.value = String(clamped);
}

function keyFromPoint(x: number, y: number): HTMLElement | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-midi]");
  return element && keyboard.contains(element) ? element : null;
}

function velocityFromPointer(key: HTMLElement, clientY: number): number {
  const rect = key.getBoundingClientRect();
  const position = Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(1, rect.height)));
  return 0.52 + position * 0.46;
}

function makeRoomImpulse(context: AudioContext): AudioBuffer {
  const duration = 2.2;
  const length = Math.floor(context.sampleRate * duration);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const decay = (1 - index / length) ** 3.2;
      data[index] = (Math.random() * 2 - 1) * decay * 0.48;
    }
  }
  return impulse;
}

function createHammerTransient(
  context: AudioContext,
  frequency: number,
  when: number,
  velocity: number,
  amount: number,
  destination: AudioNode,
): AudioBufferSourceNode {
  const duration = 0.045;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    const decay = (1 - index / data.length) ** 5;
    data[index] = (Math.random() * 2 - 1) * decay;
  }

  const source: AudioBufferSourceNode = context.createBufferSource();
  const hammerFilter: BiquadFilterNode = context.createBiquadFilter();
  const hammerGain: GainNode = context.createGain();
  source.buffer = buffer;
  hammerFilter.type = "bandpass";
  hammerFilter.frequency.value = Math.min(9500, Math.max(700, frequency * 7));
  hammerFilter.Q.value = 0.75;
  hammerGain.gain.setValueAtTime(0.0001, when);
  hammerGain.gain.linearRampToValueAtTime(Math.max(0.0001, velocity * amount * 0.22), when + 0.0015);
  hammerGain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  source.connect(hammerFilter);
  hammerFilter.connect(hammerGain);
  hammerGain.connect(destination);
  source.start(when);
  source.stop(when + duration + 0.01);
  return source;
}

async function ensureAudio(): Promise<AudioContext> {
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    const compressor = audioContext.createDynamicsCompressor();
    roomInput = audioContext.createConvolver();
    const roomGain = audioContext.createGain();
    analyser = audioContext.createAnalyser();

    masterGain.gain.value = Number(volumeInput.value) / 100 * 0.72;
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.24;
    roomInput.buffer = makeRoomImpulse(audioContext);
    roomGain.gain.value = 0.16;
    analyser.fftSize = 128;

    masterGain.connect(compressor);
    roomInput.connect(roomGain);
    roomGain.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") await audioContext.resume();
  stage.dataset.state = "active";
  return audioContext;
}

function createPianoVoice(
  midi: number,
  when: number,
  velocity: number,
  destination?: AudioNode,
): PianoVoice {
  if (!audioContext || !masterGain || !roomInput) throw new Error("Audio engine is not ready");

  const context = audioContext;
  const filter: BiquadFilterNode = context.createBiquadFilter();
  const gain: GainNode = context.createGain();
  const panner: StereoPannerNode = context.createStereoPanner();
  const oscillators: OscillatorNode[] = [];
  const baseFrequency = frequencyForMidi(midi);
  const recipes: Record<Timbre, readonly { ratio: number; type: OscillatorType; amount: number; detune?: number }[]> = {
    grand: [
      { ratio: 1, type: "sine", amount: 0.62, detune: -1.4 },
      { ratio: 1, type: "sine", amount: 0.62, detune: 1.6 },
      { ratio: 2.005, type: "sine", amount: 0.28 },
      { ratio: 3.018, type: "sine", amount: 0.13 },
      { ratio: 4.04, type: "sine", amount: 0.055 },
    ],
    felt: [
      { ratio: 1, type: "triangle", amount: 0.78, detune: -1 },
      { ratio: 1, type: "sine", amount: 0.52, detune: 1.2 },
      { ratio: 2.003, type: "sine", amount: 0.16 },
      { ratio: 3.012, type: "sine", amount: 0.05 },
    ],
    electric: [
      { ratio: 1, type: "sine", amount: 0.92 },
      { ratio: 2.01, type: "sine", amount: 0.34 },
      { ratio: 3.99, type: "sine", amount: 0.16 },
      { ratio: 7.98, type: "sine", amount: 0.045 },
    ],
  };
  const pitchPosition = (midi - FULL_KEYBOARD_LOW) / (FULL_KEYBOARD_HIGH - FULL_KEYBOARD_LOW);
  const settings = {
    grand: {
      attack: 0.003,
      decay: 3.2 - pitchPosition * 1.55,
      sustain: 0.045,
      filter: Math.min(11000, Math.max(3000, baseFrequency * (6 + velocity * 7))),
      release: 0.82,
      hammer: 0.9,
    },
    felt: {
      attack: 0.012,
      decay: 2.25 - pitchPosition * 0.9,
      sustain: 0.075,
      filter: Math.min(5200, Math.max(1500, baseFrequency * 5)),
      release: 1.05,
      hammer: 0.24,
    },
    electric: {
      attack: 0.006,
      decay: 2.5 - pitchPosition * 0.65,
      sustain: 0.16,
      filter: 9800,
      release: 1.55,
      hammer: 0.04,
    },
  }[currentTimbre];
  const peak = Math.max(0.0001, velocity * (currentTimbre === "grand" ? 0.085 : 0.105));

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(settings.filter, when);
  filter.Q.value = currentTimbre === "electric" ? 1.15 : 0.55;
  filter.connect(gain);
  gain.connect(panner);
  panner.pan.value = Math.max(-0.55, Math.min(0.55, (midi - 64) / 60));
  if (destination) {
    panner.connect(destination);
  } else {
    panner.connect(masterGain);
    panner.connect(roomInput);
  }

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + settings.attack);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * settings.sustain), when + settings.attack + settings.decay);

  for (const recipe of recipes[currentTimbre]) {
    const oscillator: OscillatorNode = context.createOscillator();
    const partialGain = context.createGain();
    oscillator.type = recipe.type;
    oscillator.frequency.setValueAtTime(baseFrequency * recipe.ratio, when);
    oscillator.detune.value = recipe.detune ?? 0;
    partialGain.gain.value = recipe.amount;
    oscillator.connect(partialGain);
    partialGain.connect(filter);
    oscillator.start(when);
    oscillators.push(oscillator);
  }
  createHammerTransient(context, baseFrequency, when, velocity, settings.hammer, filter);

  let released = false;
  return {
    gain,
    oscillators,
    release(at: number) {
      if (released) return;
      released = true;
      const releaseAt = Math.max(context.currentTime, at);
      gain.gain.cancelAndHoldAtTime(releaseAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt + settings.release);
      for (const oscillator of oscillators) oscillator.stop(releaseAt + settings.release + 0.08);
    },
  };
}

function setKeyIllumination(midi: number, token: string, active: boolean): void {
  const fitted = fitToVisibleRange(midi);
  let tokens = activeKeyTokens.get(fitted);
  if (!tokens) {
    tokens = new Set();
    activeKeyTokens.set(fitted, tokens);
  }
  if (active) tokens.add(token);
  else tokens.delete(token);
  keyElement(fitted)?.classList.toggle("is-active", tokens.size > 0);
}

function addVisualTrail(midi: number, velocity: number): void {
  const fitted = fitToVisibleRange(midi);
  visualTrails.push({
    midi: fitted,
    velocity,
    colour: KEY_COLOURS[fitted % 12],
    started: performance.now(),
  });
}

async function playManual(midi: number, velocity: number, source: string): Promise<void> {
  const context = await ensureAudio();
  const fitted = fitToVisibleRange(midi);
  releaseManual(source, true);
  manualVoices.set(source, createPianoVoice(fitted, context.currentTime, velocity));
  setKeyIllumination(fitted, source, true);
  addVisualTrail(fitted, velocity);
  status.textContent = `${noteName(fitted)} / ${currentTimbre.toUpperCase()}`;
}

function releaseManual(source: string, immediate = false): void {
  const voice = manualVoices.get(source);
  if (!voice || !audioContext) return;
  if (sustain && !immediate) {
    sustainedSources.add(source);
    return;
  }
  voice.release(audioContext.currentTime);
  manualVoices.delete(source);
  sustainedSources.delete(source);
  for (const [midi] of activeKeyTokens) setKeyIllumination(midi, source, false);
}

function releaseSustainedVoices(): void {
  for (const source of [...sustainedSources]) releaseManual(source, true);
}

function later(callback: () => void, delay: number): void {
  const timer = window.setTimeout(() => {
    demoTimers.delete(timer);
    callback();
  }, Math.max(0, delay));
  demoTimers.add(timer);
}

function scheduleVisual(midi: number, velocity: number, token: string, when: number, duration: number): void {
  if (!audioContext) return;
  const delay = (when - audioContext.currentTime) * 1000;
  later(() => {
    setKeyIllumination(midi, token, true);
    addVisualTrail(midi, velocity);
  }, delay);
  later(() => setKeyIllumination(midi, token, false), delay + Math.min(900, duration * 1000));
}

function eventPitches(event: NoteEvent): readonly number[] {
  if (event.pitch === undefined) return [];
  if (!event.chord) return [fitToVisibleRange(event.pitch)];
  return [...new Set(CHORD_INTERVALS[event.chord].map((interval) => fitToVisibleRange(event.pitch! + interval)))];
}

function scheduleEvent(event: NoteEvent, trackIndex: number, when: number, stepSeconds: number, identity: string): void {
  if (!demoBus) return;
  const trackLevels = [0, 0, 0.72, 0.66, 0.9, 0.54] as const;
  const duration = Math.max(0.25, event.length * stepSeconds * (trackIndex === 3 ? 1.35 : 1.05));
  const pitches = eventPitches(event);
  for (const [pitchIndex, pitch] of pitches.entries()) {
    const velocity = event.velocity * trackLevels[trackIndex] * (pitchIndex === 0 ? 1 : 0.82);
    const voice = createPianoVoice(pitch, when, velocity, demoBus);
    voice.release(when + duration);
    scheduleVisual(pitch, velocity, `${identity}-${pitch}`, when, duration);
  }
}

function buildTimeline(): { readonly steps: readonly TimelineStep[]; readonly duration: number } {
  const steps: TimelineStep[] = [];
  let offset = 0;
  for (let barIndex = 0; barIndex < composition.bars.length; barIndex += 1) {
    for (let stepIndex = 0; stepIndex < STEPS_PER_BAR; stepIndex += 1) {
      const duration = stepDurationSeconds(composition.tempo, stepIndex, composition.swing / 100);
      steps.push({ offset, duration, barIndex, stepIndex });
      offset += duration;
    }
  }
  return { steps, duration: offset };
}

const timeline = buildTimeline();

function scheduleDemo(): void {
  if (!audioContext || !demoPlaying) return;
  const horizon = audioContext.currentTime + 0.16;

  while (demoScheduleIndex < timeline.steps.length) {
    const timelineStep = timeline.steps[demoScheduleIndex];
    const when = demoStartTime + timelineStep.offset;
    if (when > horizon) break;

    const bar = composition.bars[timelineStep.barIndex];
    for (let trackIndex = 2; trackIndex <= 5; trackIndex += 1) {
      const event = bar.rows[trackIndex][timelineStep.stepIndex];
      if (event) scheduleEvent(event, trackIndex, when, timelineStep.duration, `demo-${demoScheduleIndex}-${trackIndex}`);
    }

    if (timelineStep.stepIndex === 0) {
      const delay = (when - audioContext.currentTime) * 1000;
      later(() => {
        sectionLabel.textContent = bar.section;
        phraseLabel.textContent = bar.name;
        status.textContent = `${bar.section} / ${bar.name}`;
      }, delay);
    }
    demoScheduleIndex += 1;
  }

  if (audioContext.currentTime - demoStartTime >= timeline.duration + 0.1) finishDemo();
}

function clearDemoVisuals(): void {
  for (const timer of demoTimers) window.clearTimeout(timer);
  demoTimers.clear();
  for (const [midi, tokens] of activeKeyTokens) {
    for (const token of [...tokens]) {
      if (token.startsWith("demo-")) setKeyIllumination(midi, token, false);
    }
  }
}

function resetPerformanceLabels(): void {
  sectionLabel.textContent = composition.bars[0].section;
  phraseLabel.textContent = composition.bars[0].name;
  progress.style.transform = "scaleX(0)";
}

function stopDemo(message = "Performance stopped. The piano is yours."): void {
  demoPlaying = false;
  if (demoInterval !== null) window.clearInterval(demoInterval);
  demoInterval = null;
  demoButton.setAttribute("aria-pressed", "false");
  demoLabel.textContent = "Perform the song";
  clearDemoVisuals();
  resetPerformanceLabels();
  status.textContent = message;

  if (audioContext && demoBus) {
    demoBus.gain.cancelAndHoldAtTime(audioContext.currentTime);
    demoBus.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
    const oldBus = demoBus;
    window.setTimeout(() => oldBus.disconnect(), 500);
  }
  demoBus = null;
}

function finishDemo(): void {
  stopDemo("Performance complete. Back at the opening.");
}

async function startDemo(): Promise<void> {
  const context = await ensureAudio();
  clearDemoVisuals();
  demoBus = context.createGain();
  demoBus.gain.value = 1;
  if (!masterGain || !roomInput) return;
  demoBus.connect(masterGain);
  demoBus.connect(roomInput);
  demoPlaying = true;
  demoScheduleIndex = 0;
  demoStartTime = context.currentTime + 0.08;
  demoButton.setAttribute("aria-pressed", "true");
  demoLabel.textContent = "Stop performance";
  status.textContent = "Glasshouse Morning / full piano performance";
  scheduleDemo();
  demoInterval = window.setInterval(scheduleDemo, 25);
}

function drawVisual(): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvasContext.fillStyle = "#151518";
  canvasContext.fillRect(0, 0, width, height);

  canvasContext.strokeStyle = "#29292d";
  canvasContext.lineWidth = 1;
  for (let line = 0; line < 7; line += 1) {
    const y = 28 + (line / 6) * Math.max(1, height - 56);
    canvasContext.beginPath();
    canvasContext.moveTo(0, y);
    canvasContext.lineTo(width, y);
    canvasContext.stroke();
  }

  const totalSteps = composition.bars.length * STEPS_PER_BAR;
  for (let barIndex = 0; barIndex < composition.bars.length; barIndex += 1) {
    const bar = composition.bars[barIndex];
    for (let trackIndex = 3; trackIndex <= 5; trackIndex += 1) {
      for (let stepIndex = 0; stepIndex < STEPS_PER_BAR; stepIndex += 1) {
        const event = bar.rows[trackIndex][stepIndex];
        if (!event || event.pitch === undefined) continue;
        const fitted = fitToVisibleRange(event.pitch);
        const x = ((barIndex * STEPS_PER_BAR + stepIndex + 0.5) / totalSteps) * width;
        const pitchPosition = (fitted - rangeLowMidi) / Math.max(1, rangeHighMidi - rangeLowMidi);
        const y = height - 35 - pitchPosition * Math.max(1, height - 70);
        canvasContext.globalAlpha = trackIndex === 3 ? 0.08 : trackIndex === 4 ? 0.16 : 0.1;
        canvasContext.fillStyle = KEY_COLOURS[fitted % 12];
        canvasContext.fillRect(x, y, Math.max(3, event.length * 1.7), trackIndex === 4 ? 3 : 2);
      }
    }
  }
  canvasContext.globalAlpha = 1;

  const now = performance.now();
  for (let index = visualTrails.length - 1; index >= 0; index -= 1) {
    const trail = visualTrails[index];
    const age = now - trail.started;
    if (age > 2100) {
      visualTrails.splice(index, 1);
      continue;
    }
    const progressThroughLife = age / 2100;
    const x = ((trail.midi - rangeLowMidi + 0.5) / Math.max(1, rangeHighMidi - rangeLowMidi + 1)) * width;
    const yBottom = height + 18 - progressThroughLife * height * 0.7;
    const yTop = yBottom - (52 + trail.velocity * 100);
    canvasContext.globalAlpha = (1 - progressThroughLife) * (0.25 + trail.velocity * 0.52);
    canvasContext.strokeStyle = trail.colour;
    canvasContext.lineWidth = 2 + trail.velocity * 7;
    canvasContext.beginPath();
    canvasContext.moveTo(x, yBottom);
    canvasContext.bezierCurveTo(x - 20, yBottom - 25, x + 18, yTop + 24, x, yTop);
    canvasContext.stroke();
  }
  canvasContext.globalAlpha = 1;

  if (analyser) {
    const levels = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(levels);
    const segmentWidth = width / levels.length;
    canvasContext.fillStyle = "#f2bf4b";
    canvasContext.globalAlpha = 0.18;
    for (let index = 0; index < levels.length; index += 1) {
      const barHeight = levels[index] / 255 * 30;
      canvasContext.fillRect(index * segmentWidth, height - barHeight, Math.max(1, segmentWidth - 2), barHeight);
    }
    canvasContext.globalAlpha = 1;
  }

  if (demoPlaying && audioContext) {
    const ratio = Math.min(1, Math.max(0, (audioContext.currentTime - demoStartTime) / timeline.duration));
    progress.style.transform = `scaleX(${ratio})`;
    canvasContext.strokeStyle = "#fffefa";
    canvasContext.globalAlpha = 0.22;
    canvasContext.lineWidth = 1;
    canvasContext.beginPath();
    canvasContext.moveTo(ratio * width, 0);
    canvasContext.lineTo(ratio * width, height);
    canvasContext.stroke();
    canvasContext.globalAlpha = 1;
  }

  requestAnimationFrame(drawVisual);
}

keyboard.addEventListener("pointerdown", (event) => {
  const key = (event.target as Element).closest<HTMLElement>("[data-midi]");
  if (!key) return;
  event.preventDefault();
  keyboard.setPointerCapture(event.pointerId);
  const midi = Number(key.dataset.midi);
  const source = `pointer-${event.pointerId}`;
  pointerNotes.set(event.pointerId, { midi, source });
  void playManual(midi, velocityFromPointer(key, event.clientY), source);
});

keyboard.addEventListener("pointermove", (event) => {
  const active = pointerNotes.get(event.pointerId);
  if (!active) return;
  const key = keyFromPoint(event.clientX, event.clientY);
  if (!key) return;
  const midi = Number(key.dataset.midi);
  if (midi === active.midi) return;
  releaseManual(active.source);
  pointerNotes.set(event.pointerId, { midi, source: active.source });
  void playManual(midi, velocityFromPointer(key, event.clientY), active.source);
});

function endPointer(event: PointerEvent): void {
  const active = pointerNotes.get(event.pointerId);
  if (!active) return;
  releaseManual(active.source);
  pointerNotes.delete(event.pointerId);
}

keyboard.addEventListener("pointerup", endPointer);
keyboard.addEventListener("pointercancel", endPointer);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const offset = KEYBOARD_KEYS.indexOf(key as typeof KEYBOARD_KEYS[number]);
  if (offset < 0 || event.repeat || keyboardSources.has(key)) return;
  if (event.target instanceof HTMLInputElement) return;
  event.preventDefault();
  const source = `key-${key}`;
  keyboardSources.set(key, source);
  void playManual(midiForOctave(register) + offset, 0.76, source);
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  const source = keyboardSources.get(key);
  if (!source) return;
  releaseManual(source);
  keyboardSources.delete(key);
});

window.addEventListener("blur", () => {
  for (const source of manualVoices.keys()) releaseManual(source, true);
  pointerNotes.clear();
  keyboardSources.clear();
});

beginButton.addEventListener("click", async () => {
  const context = await ensureAudio();
  const notes = [0, 4, 7, 12];
  notes.forEach((offset, index) => {
    const midi = fitToVisibleRange(midiForOctave(register) + offset);
    const when = context.currentTime + index * 0.13;
    const voice = createPianoVoice(midi, when, 0.68 - index * 0.05);
    voice.release(when + 0.48);
    scheduleVisual(midi, 0.7, `opening-${index}`, when, 0.55);
  });
  status.textContent = "Piano open / CONCERT";
});

demoButton.addEventListener("click", () => {
  if (demoPlaying) stopDemo();
  else void startDemo();
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-timbre]")) {
  button.addEventListener("click", () => {
    currentTimbre = button.dataset.timbre as Timbre;
    for (const option of document.querySelectorAll<HTMLButtonElement>("[data-timbre]")) {
      option.setAttribute("aria-pressed", String(option === button));
    }
    status.textContent = `${button.textContent?.trim()} voice selected.`;
  });
}

required<HTMLButtonElement>('[data-testid="octave-down"]').addEventListener("click", () => {
  register = Math.max(1, register - 1);
  renderKeyboard();
  status.textContent = `Register ${register}.`;
});

required<HTMLButtonElement>('[data-testid="octave-up"]').addEventListener("click", () => {
  register = Math.min(7, register + 1);
  renderKeyboard();
  status.textContent = `Register ${register}.`;
});

keyboardPosition.addEventListener("input", () => {
  scrollToMidi(Number(keyboardPosition.value), false);
});

keyboardScroller.addEventListener("scroll", () => {
  const maximum = Math.max(1, keyboardScroller.scrollWidth - keyboardScroller.clientWidth);
  const ratio = keyboardScroller.scrollLeft / maximum;
  const midi = Math.round(FULL_KEYBOARD_LOW + ratio * (FULL_KEYBOARD_HIGH - FULL_KEYBOARD_LOW));
  keyboardPosition.value = String(midi);
});

keyboardScroller.addEventListener("wheel", (event) => {
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();
  keyboardScroller.scrollLeft += event.deltaY;
}, { passive: false });

sustainButton.addEventListener("click", () => {
  sustain = !sustain;
  sustainButton.setAttribute("aria-checked", String(sustain));
  sustainLabel.textContent = sustain ? "On" : "Off";
  if (!sustain) releaseSustainedVoices();
  status.textContent = `Sustain ${sustain ? "on" : "off"}.`;
});

volumeInput.addEventListener("input", () => {
  if (audioContext && masterGain) {
    masterGain.gain.setTargetAtTime(Number(volumeInput.value) / 100 * 0.72, audioContext.currentTime, 0.02);
  }
});

window.matchMedia("(max-width: 700px)").addEventListener("change", renderKeyboard);
renderKeyboard();
requestAnimationFrame(drawVisual);
