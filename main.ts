import {
  BARS_PER_SONG,
  COMPOSITIONS,
  INSTRUMENT_TRACKS,
  STEPS_PER_BAR,
  createEmptyPattern,
  patternFromBar,
  setPatternCell,
  stepDurationSeconds,
  trackIndexForKey,
  transportClockSeconds,
  type Composition,
  type Pattern,
  type SoundPalette,
} from "./instrument-model";

interface AudioEngine {
  context: AudioContext;
  master: GainNode;
  echoInput: GainNode;
  noise: AudioBuffer;
}

interface PaintGesture {
  pointerId: number;
  active: boolean;
  visited: Set<string>;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const stage = required<HTMLElement>("#instrument-stage");
const stepRuler = required<HTMLElement>("#step-ruler");
const grid = required<HTMLElement>("#track-grid");
const barNavigator = required<HTMLElement>('[data-testid="bar-navigator"]');
const beginButton = required<HTMLButtonElement>('[data-testid="begin-instrument"]');
const transportButton = required<HTMLButtonElement>('[data-testid="transport-toggle"]');
const transportState = required<HTMLElement>("[data-transport-state]");
const previousBarButton = required<HTMLButtonElement>('[data-testid="previous-bar"]');
const nextBarButton = required<HTMLButtonElement>('[data-testid="next-bar"]');
const title = required<HTMLElement>('[data-testid="composition-title"]');
const character = required<HTMLElement>('[data-testid="composition-character"]');
const songPosition = required<HTMLElement>('[data-testid="song-position"]');
const barName = required<HTMLElement>('[data-testid="bar-name"]');
const editState = required<HTMLElement>('[data-testid="edit-state"]');
const status = required<HTMLElement>('[data-testid="instrument-status"]');
const tempoInput = required<HTMLInputElement>("#tempo");
const tempoOutput = required<HTMLOutputElement>("#tempo-output");
const swingInput = required<HTMLInputElement>("#swing");
const swingOutput = required<HTMLOutputElement>("#swing-output");
const variationButton = required<HTMLButtonElement>('[data-testid="variation-bar"]');
const clearButton = required<HTMLButtonElement>('[data-testid="clear-bar"]');
const compositionButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-composition]"),
);
const paletteButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-palette]"));
const trackPads = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-track-pad]"));

let compositionIndex = 0;
let composition: Composition = COMPOSITIONS[compositionIndex]!;
let arrangement: Pattern[] = composition.bars.map(patternFromBar);
let palette: SoundPalette = composition.palette;
let displayedBar = 0;
let playbackBar = 0;
let visualBar = 0;
let sequenceStep = 0;
let audio: AudioEngine | null = null;
let paintGesture: PaintGesture | null = null;
let isPlaying = false;
let nextStepAt = 0;
let schedulerTimer: number | null = null;
const visualTimers = new Set<number>();
const editedBars = new Set<number>();

function makeNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 0.45);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function ensureAudio(): AudioEngine | null {
  if (typeof AudioContext === "undefined") return null;

  if (!audio) {
    const context = new AudioContext({ latencyHint: "interactive" });
    const master = new GainNode(context, { gain: 0.52 });
    const compressor = new DynamicsCompressorNode(context, {
      threshold: -20,
      knee: 16,
      ratio: 6,
      attack: 0.004,
      release: 0.2,
    });
    const delay = new DelayNode(context, { delayTime: 0.22, maxDelayTime: 0.7 });
    const echoInput = new GainNode(context, { gain: 0.13 });
    const echoReturn = new GainNode(context, { gain: 0.15 });

    master.connect(compressor);
    echoInput.connect(delay).connect(echoReturn).connect(compressor);
    compressor.connect(context.destination);
    audio = { context, master, echoInput, noise: makeNoiseBuffer(context) };
  }

  if (audio.context.state === "suspended") void audio.context.resume();
  return audio;
}

// The page clock keeps the playhead reliable even while a browser is resuming Web Audio.
function clockSeconds(): number {
  return transportClockSeconds(undefined, audio?.context.currentTime ?? 0, performance.now() / 1000);
}

function audioStart(engine: AudioEngine, pageTime: number): number {
  return Math.max(engine.context.currentTime, engine.context.currentTime + pageTime - clockSeconds());
}

function activateInstrument(): AudioEngine | null {
  stage.dataset.state = "active";
  return ensureAudio();
}

function connectVoice(engine: AudioEngine, output: AudioNode, echoAmount = 0.12): void {
  output.connect(engine.master);
  if (echoAmount > 0) {
    const send = new GainNode(engine.context, { gain: echoAmount });
    output.connect(send).connect(engine.echoInput);
  }
}

function midiFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function harmonicRoot(bar: number, step: number): number {
  const progressions = [
    [0, 5, 9, 7, 0, 5, 7, 0],
    [0, 3, 7, 10, 5, 8, 7, 0],
    [0, 7, 5, 9, 2, 5, 7, 0],
  ];
  const movement = [0, 2, 4, 7, 9, 7, 4, 2];
  return (progressions[compositionIndex]?.[bar] ?? 0) + (movement[Math.floor(step / 2) % movement.length] ?? 0);
}

function triggerKick(engine: AudioEngine, at: number, step: number): void {
  const oscillator = new OscillatorNode(engine.context, {
    frequency: palette === "voltage" ? 170 : 140,
    type: palette === "porcelain" ? "triangle" : "sine",
  });
  const click = new OscillatorNode(engine.context, { frequency: 720, type: "triangle" });
  const body = new GainNode(engine.context, { gain: 0.0001 });
  const clickGain = new GainNode(engine.context, { gain: 0.0001 });
  const pan = new StereoPannerNode(engine.context, { pan: -0.05 });
  const duration = palette === "velvet" ? 0.42 : 0.3;

  oscillator.connect(body).connect(pan);
  click.connect(clickGain).connect(pan);
  connectVoice(engine, pan, 0.02);
  oscillator.frequency.exponentialRampToValueAtTime(46, at + duration * 0.72);
  body.gain.exponentialRampToValueAtTime(0.75, at + 0.006);
  body.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  clickGain.gain.exponentialRampToValueAtTime(step % 4 === 0 ? 0.12 : 0.07, at + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
  oscillator.start(at);
  click.start(at);
  oscillator.stop(at + duration + 0.03);
  click.stop(at + 0.05);
}

function triggerSnare(engine: AudioEngine, at: number, step: number): void {
  const noise = new AudioBufferSourceNode(engine.context, { buffer: engine.noise });
  const noiseFilter = new BiquadFilterNode(engine.context, {
    type: palette === "porcelain" ? "bandpass" : "highpass",
    frequency: palette === "voltage" ? 1900 : 1350,
    Q: palette === "porcelain" ? 1.8 : 0.7,
  });
  const noiseGain = new GainNode(engine.context, { gain: 0.0001 });
  const body = new OscillatorNode(engine.context, { frequency: 176, type: "triangle" });
  const bodyGain = new GainNode(engine.context, { gain: 0.0001 });
  const pan = new StereoPannerNode(engine.context, { pan: step % 2 === 0 ? 0.08 : 0.18 });
  const duration = palette === "velvet" ? 0.2 : 0.13;

  noise.connect(noiseFilter).connect(noiseGain).connect(pan);
  body.connect(bodyGain).connect(pan);
  connectVoice(engine, pan, 0.05);
  noiseGain.gain.exponentialRampToValueAtTime(palette === "voltage" ? 0.38 : 0.28, at + 0.003);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  bodyGain.gain.exponentialRampToValueAtTime(0.16, at + 0.003);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  noise.start(at);
  body.start(at);
  noise.stop(at + duration + 0.03);
  body.stop(at + 0.12);
}

function triggerBass(engine: AudioEngine, at: number, step: number, bar: number): void {
  const root = 35 + compositionIndex * 2 + harmonicRoot(bar, step) % 12;
  const primary = new OscillatorNode(engine.context, {
    frequency: midiFrequency(root),
    type: palette === "voltage" ? "sawtooth" : "triangle",
  });
  const sub = new OscillatorNode(engine.context, {
    frequency: midiFrequency(root - 12),
    type: "sine",
  });
  const primaryGain = new GainNode(engine.context, { gain: 0.7 });
  const subGain = new GainNode(engine.context, { gain: 0.25 });
  const filter = new BiquadFilterNode(engine.context, {
    type: "lowpass",
    frequency: palette === "voltage" ? 1050 : palette === "porcelain" ? 720 : 540,
    Q: palette === "voltage" ? 5.5 : 1.6,
  });
  const envelope = new GainNode(engine.context, { gain: 0.0001 });
  const pan = new StereoPannerNode(engine.context, { pan: -0.22 });
  const duration = palette === "velvet" ? 0.62 : 0.4;

  primary.connect(primaryGain).connect(filter);
  sub.connect(subGain).connect(filter);
  filter.connect(envelope).connect(pan);
  connectVoice(engine, pan, 0.04);
  envelope.gain.exponentialRampToValueAtTime(0.18, at + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  filter.frequency.setValueAtTime(filter.frequency.value, at);
  filter.frequency.exponentialRampToValueAtTime(230, at + duration);
  primary.start(at);
  sub.start(at);
  primary.stop(at + duration + 0.04);
  sub.stop(at + duration + 0.04);
}

function triggerKeys(engine: AudioEngine, at: number, step: number, bar: number): void {
  const root = 52 + compositionIndex * 2 + (harmonicRoot(bar, step) % 12);
  const intervals = palette === "porcelain" ? [0, 7, 12] : [0, 4, 7];
  const filter = new BiquadFilterNode(engine.context, {
    type: "lowpass",
    frequency: palette === "velvet" ? 1450 : 2700,
    Q: 0.7,
  });
  const envelope = new GainNode(engine.context, { gain: 0.0001 });
  const pan = new StereoPannerNode(engine.context, { pan: 0.08 });
  const duration = palette === "velvet" ? 1.15 : palette === "porcelain" ? 0.82 : 0.58;

  for (const [index, interval] of intervals.entries()) {
    const oscillator = new OscillatorNode(engine.context, {
      frequency: midiFrequency(root + interval),
      detune: index === 1 ? -4 : index === 2 ? 5 : 0,
      type: palette === "voltage" ? "sawtooth" : "triangle",
    });
    const level = new GainNode(engine.context, { gain: index === 0 ? 0.5 : 0.28 });
    oscillator.connect(level).connect(filter);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.08);
  }
  filter.connect(envelope).connect(pan);
  connectVoice(engine, pan, 0.16);
  envelope.gain.exponentialRampToValueAtTime(0.105, at + 0.035);
  envelope.gain.exponentialRampToValueAtTime(0.04, at + duration * 0.55);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
}

function triggerPluck(engine: AudioEngine, at: number, step: number, bar: number): void {
  const note = 65 + compositionIndex * 2 + (harmonicRoot(bar, step) % 12);
  const primary = new OscillatorNode(engine.context, {
    frequency: midiFrequency(note),
    type: palette === "porcelain" ? "triangle" : "square",
  });
  const overtone = new OscillatorNode(engine.context, {
    frequency: midiFrequency(note + 12),
    type: "triangle",
    detune: 7,
  });
  const overtoneGain = new GainNode(engine.context, { gain: 0.18 });
  const filter = new BiquadFilterNode(engine.context, {
    type: "lowpass",
    frequency: palette === "voltage" ? 4300 : 2700,
    Q: 2.3,
  });
  const envelope = new GainNode(engine.context, { gain: 0.0001 });
  const pan = new StereoPannerNode(engine.context, { pan: step % 4 < 2 ? -0.42 : 0.42 });
  const duration = palette === "velvet" ? 0.34 : 0.2;

  primary.connect(filter);
  overtone.connect(overtoneGain).connect(filter);
  filter.connect(envelope).connect(pan);
  connectVoice(engine, pan, 0.11);
  envelope.gain.exponentialRampToValueAtTime(0.095, at + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  primary.start(at);
  overtone.start(at);
  primary.stop(at + duration + 0.03);
  overtone.stop(at + duration + 0.03);
}

function triggerBell(engine: AudioEngine, at: number, step: number, bar: number): void {
  const root = 76 + compositionIndex * 2 + (harmonicRoot(bar, step) % 12);
  const envelope = new GainNode(engine.context, { gain: 0.0001 });
  const highpass = new BiquadFilterNode(engine.context, { type: "highpass", frequency: 480, Q: 0.6 });
  const pan = new StereoPannerNode(engine.context, { pan: 0.48 });
  const duration = palette === "porcelain" ? 1.6 : palette === "velvet" ? 1.25 : 0.78;
  const harmonics = [1, 2.01, 3.98];

  harmonics.forEach((ratio, index) => {
    const oscillator = new OscillatorNode(engine.context, {
      frequency: midiFrequency(root) * ratio,
      type: "sine",
    });
    const level = new GainNode(engine.context, { gain: [0.65, 0.22, 0.09][index] ?? 0.1 });
    oscillator.connect(level).connect(highpass);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.08);
  });
  highpass.connect(envelope).connect(pan);
  connectVoice(engine, pan, 0.23);
  envelope.gain.exponentialRampToValueAtTime(0.1, at + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
}

function pulseTrack(trackIndex: number, step: number, delaySeconds = 0): void {
  const delay = Math.max(0, delaySeconds * 1000);
  const startTimer = window.setTimeout(() => {
    const pad = trackPads.find((candidate) => Number(candidate.dataset.trackIndex) === trackIndex);
    const cell = grid.querySelector<HTMLElement>(
      `[data-track-index="${trackIndex}"][data-step="${step}"]`,
    );
    pad?.classList.add("is-sounding");
    cell?.classList.add("is-sounding");
    const endTimer = window.setTimeout(() => {
      pad?.classList.remove("is-sounding");
      cell?.classList.remove("is-sounding");
      visualTimers.delete(endTimer);
    }, 120);
    visualTimers.add(endTimer);
    visualTimers.delete(startTimer);
  }, delay);
  visualTimers.add(startTimer);
}

function performTrack(
  trackIndex: number,
  step: number,
  bar: number,
  at = clockSeconds(),
  announce = true,
): void {
  const track = INSTRUMENT_TRACKS[trackIndex];
  if (!track) return;
  const engine = audio ?? activateInstrument();
  if (engine) {
    const start = audioStart(engine, at);
    const triggers = [triggerKick, triggerSnare, triggerBass, triggerKeys, triggerPluck, triggerBell];
    triggers[trackIndex]?.(engine, start, step, bar);
  }
  pulseTrack(trackIndex, step, at - clockSeconds());
  if (announce) status.textContent = `${track.name} played in the ${palette} palette.`;
}

function renderStepRuler(): void {
  const fragment = document.createDocumentFragment();
  const label = document.createElement("span");
  label.textContent = "STEP";
  fragment.append(label);
  for (let step = 0; step < STEPS_PER_BAR; step += 1) {
    const number = document.createElement("span");
    number.textContent = String(step + 1).padStart(2, "0");
    fragment.append(number);
  }
  stepRuler.replaceChildren(fragment);
}

function renderGrid(): void {
  const pattern = arrangement[displayedBar] ?? createEmptyPattern();
  const fragment = document.createDocumentFragment();

  INSTRUMENT_TRACKS.forEach((track, trackIndex) => {
    const label = document.createElement("div");
    label.className = "track-label";
    label.setAttribute("role", "rowheader");
    label.style.setProperty("--track-colour", track.colour);
    label.textContent = track.name.toUpperCase();
    fragment.append(label);

    for (let step = 0; step < STEPS_PER_BAR; step += 1) {
      const active = pattern[trackIndex]?.[step] ?? false;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sequence-cell";
      cell.classList.toggle("is-active", active);
      cell.dataset.trackIndex = String(trackIndex);
      cell.dataset.step = String(step);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${track.name}, bar ${displayedBar + 1}, step ${step + 1}`);
      cell.setAttribute("aria-pressed", String(active));
      cell.style.setProperty("--track-colour", track.colour);
      fragment.append(cell);
    }
  });

  grid.replaceChildren(fragment);
}

function renderBarNavigator(): void {
  const fragment = document.createDocumentFragment();
  composition.bars.forEach((bar, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bar-button";
    button.classList.toggle("is-selected", displayedBar === index);
    button.classList.toggle("is-playing", isPlaying && visualBar === index);
    button.style.setProperty("--composition-accent", composition.accent);
    button.dataset.barIndex = String(index);
    button.setAttribute("aria-pressed", String(displayedBar === index));
    button.setAttribute("aria-label", `Edit bar ${index + 1}: ${bar.name}`);
    const number = document.createElement("b");
    number.textContent = `${String(index + 1).padStart(2, "0")}${editedBars.has(index) ? " *" : ""}`;
    const name = document.createElement("small");
    name.textContent = bar.name;
    button.append(number, name);
    fragment.append(button);
  });
  barNavigator.replaceChildren(fragment);
}

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  return `0:${String(rounded).padStart(2, "0")}`;
}

function compositionDuration(current: Composition): number {
  return (BARS_PER_SONG * STEPS_PER_BAR * 30) / current.tempo;
}

function renderComposition(): void {
  title.textContent = composition.title;
  character.textContent = `${composition.character} / ${BARS_PER_SONG} bars / ${formatDuration(compositionDuration(composition))}`;
  songPosition.textContent = `BAR ${String(displayedBar + 1).padStart(2, "0")} / ${String(BARS_PER_SONG).padStart(2, "0")}`;
  barName.textContent = composition.bars[displayedBar]?.name ?? `Bar ${displayedBar + 1}`;
  editState.textContent = editedBars.has(displayedBar) ? "YOUR ARRANGEMENT" : "ORIGINAL ARRANGEMENT";
  compositionButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.composition === composition.id));
  });
  paletteButtons.forEach((button) => {
    const active = button.dataset.palette === palette;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  tempoInput.value = String(composition.tempo);
  swingInput.value = String(composition.swing);
  tempoOutput.textContent = `${tempoInput.value} BPM`;
  swingOutput.textContent = `${swingInput.value}%`;
  renderBarNavigator();
  renderGrid();
}

function selectBar(index: number, followPlayback = false): void {
  displayedBar = (index + BARS_PER_SONG) % BARS_PER_SONG;
  if (followPlayback && !isPlaying) playbackBar = displayedBar;
  songPosition.textContent = `BAR ${String(displayedBar + 1).padStart(2, "0")} / ${String(BARS_PER_SONG).padStart(2, "0")}`;
  barName.textContent = composition.bars[displayedBar]?.name ?? `Bar ${displayedBar + 1}`;
  editState.textContent = editedBars.has(displayedBar) ? "YOUR ARRANGEMENT" : "ORIGINAL ARRANGEMENT";
  renderBarNavigator();
  renderGrid();
}

function loadComposition(next: Composition): void {
  if (isPlaying) stopPlayback(false);
  compositionIndex = COMPOSITIONS.findIndex((candidate) => candidate.id === next.id);
  composition = next;
  arrangement = composition.bars.map(patternFromBar);
  palette = composition.palette;
  displayedBar = 0;
  playbackBar = 0;
  visualBar = 0;
  sequenceStep = 0;
  editedBars.clear();
  renderComposition();
  const now = clockSeconds();
  [3, 4, 5].forEach((trackIndex, offset) => performTrack(trackIndex, offset * 2, 0, now + offset * 0.045, false));
  status.textContent = `${composition.title} loaded. Eight bars are ready to play or reshape.`;
}

function markBarEdited(): void {
  editedBars.add(displayedBar);
  editState.textContent = "YOUR ARRANGEMENT";
  renderBarNavigator();
}

function editCell(cell: HTMLButtonElement, active: boolean, withSound = true): void {
  const trackIndex = Number(cell.dataset.trackIndex);
  const step = Number(cell.dataset.step);
  if (!Number.isInteger(trackIndex) || !Number.isInteger(step)) return;
  const current = arrangement[displayedBar] ?? createEmptyPattern();
  arrangement[displayedBar] = setPatternCell(current, trackIndex, step, active);
  cell.classList.toggle("is-active", active);
  cell.setAttribute("aria-pressed", String(active));
  markBarEdited();
  if (withSound) performTrack(trackIndex, step, displayedBar);
}

function cellFromTarget(target: EventTarget | null): HTMLButtonElement | null {
  return target instanceof Element ? target.closest<HTMLButtonElement>(".sequence-cell") : null;
}

function cellKey(cell: HTMLButtonElement): string {
  return `${cell.dataset.trackIndex}:${cell.dataset.step}`;
}

grid.addEventListener("pointerdown", (event) => {
  const cell = cellFromTarget(event.target);
  if (!cell) return;
  event.preventDefault();
  activateInstrument();
  grid.setPointerCapture(event.pointerId);
  const active = cell.getAttribute("aria-pressed") !== "true";
  paintGesture = { pointerId: event.pointerId, active, visited: new Set([cellKey(cell)]) };
  editCell(cell, active);
});

grid.addEventListener("pointermove", (event) => {
  if (!paintGesture || paintGesture.pointerId !== event.pointerId) return;
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const cell = cellFromTarget(element);
  if (!cell || paintGesture.visited.has(cellKey(cell))) return;
  paintGesture.visited.add(cellKey(cell));
  editCell(cell, paintGesture.active);
});

function endPaint(event: PointerEvent): void {
  if (paintGesture?.pointerId === event.pointerId) paintGesture = null;
}

grid.addEventListener("pointerup", endPaint);
grid.addEventListener("pointercancel", endPaint);
grid.addEventListener("click", (event) => {
  if (event.detail !== 0) return;
  const cell = cellFromTarget(event.target);
  if (!cell) return;
  activateInstrument();
  editCell(cell, cell.getAttribute("aria-pressed") !== "true");
});

function setPlayhead(bar: number, step: number | null): void {
  visualBar = bar;
  grid.querySelectorAll<HTMLElement>(".sequence-cell").forEach((cell) => {
    cell.classList.toggle("is-current", step !== null && Number(cell.dataset.step) === step);
  });
  renderBarNavigator();
}

function clearVisualTimers(): void {
  for (const timer of visualTimers) window.clearTimeout(timer);
  visualTimers.clear();
  trackPads.forEach((pad) => pad.classList.remove("is-sounding"));
  grid.querySelectorAll<HTMLElement>(".sequence-cell").forEach((cell) => {
    cell.classList.remove("is-sounding", "is-current");
  });
}

function scheduleStep(bar: number, step: number, at: number): void {
  const pattern = arrangement[bar] ?? createEmptyPattern();
  for (let trackIndex = 0; trackIndex < INSTRUMENT_TRACKS.length; trackIndex += 1) {
    if (pattern[trackIndex]?.[step]) performTrack(trackIndex, step, bar, at, false);
  }

  const delay = Math.max(0, (at - clockSeconds()) * 1000);
  const timer = window.setTimeout(() => {
    if (isPlaying) {
      if (displayedBar !== bar) selectBar(bar);
      setPlayhead(bar, step);
      status.textContent = `${composition.title} / ${composition.bars[bar]?.name} / step ${String(step + 1).padStart(2, "0")}`;
    }
    visualTimers.delete(timer);
  }, delay);
  visualTimers.add(timer);
}

function scheduleAhead(): void {
  if (!isPlaying) return;
  const horizon = clockSeconds() + 0.12;
  const tempo = Number(tempoInput.value);
  const swing = Number(swingInput.value) / 100;

  while (nextStepAt < horizon) {
    scheduleStep(playbackBar, sequenceStep, nextStepAt);
    nextStepAt += stepDurationSeconds(tempo, sequenceStep, swing);
    sequenceStep += 1;
    if (sequenceStep >= STEPS_PER_BAR) {
      sequenceStep = 0;
      playbackBar = (playbackBar + 1) % BARS_PER_SONG;
    }
  }
  schedulerTimer = window.setTimeout(scheduleAhead, 25);
}

function updateTransport(): void {
  transportButton.setAttribute("aria-pressed", String(isPlaying));
  transportButton.setAttribute("aria-label", isPlaying ? "Stop complete piece" : "Play complete piece");
  transportState.textContent = isPlaying ? "PLAYING FULL PIECE" : "READY";
}

function startPlayback(): void {
  activateInstrument();
  isPlaying = true;
  playbackBar = displayedBar;
  visualBar = displayedBar;
  sequenceStep = 0;
  nextStepAt = clockSeconds() + 0.06;
  updateTransport();
  renderBarNavigator();
  status.textContent = `${composition.title} is playing from bar ${displayedBar + 1}.`;
  scheduleAhead();
}

function stopPlayback(announce = true): void {
  isPlaying = false;
  if (schedulerTimer !== null) window.clearTimeout(schedulerTimer);
  schedulerTimer = null;
  clearVisualTimers();
  setPlayhead(displayedBar, null);
  playbackBar = displayedBar;
  updateTransport();
  if (announce) status.textContent = `${composition.title} paused. Every bar remains editable.`;
}

beginButton.addEventListener("click", () => {
  activateInstrument();
  const now = clockSeconds();
  performTrack(3, 0, displayedBar, now, false);
  performTrack(4, 3, displayedBar, now + 0.06, false);
  performTrack(5, 7, displayedBar, now + 0.12, false);
  status.textContent = `First chord heard. ${composition.title} is ready.`;
});

transportButton.addEventListener("click", () => {
  if (isPlaying) stopPlayback();
  else startPlayback();
});

previousBarButton.addEventListener("click", () => selectBar(displayedBar - 1, true));
nextBarButton.addEventListener("click", () => selectBar(displayedBar + 1, true));

barNavigator.addEventListener("click", (event) => {
  const button = event.target instanceof Element
    ? event.target.closest<HTMLButtonElement>("[data-bar-index]")
    : null;
  if (!button) return;
  selectBar(Number(button.dataset.barIndex), true);
});

compositionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateInstrument();
    const selected = COMPOSITIONS.find((candidate) => candidate.id === button.dataset.composition);
    if (selected) loadComposition(selected);
  });
});

paletteButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateInstrument();
    palette = button.dataset.palette as SoundPalette;
    paletteButtons.forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    performTrack(4, sequenceStep, displayedBar);
    status.textContent = `${palette[0]?.toUpperCase()}${palette.slice(1)} palette selected for all six instruments.`;
  });
});

tempoInput.addEventListener("input", () => {
  tempoOutput.textContent = `${tempoInput.value} BPM`;
  status.textContent = `Tempo set to ${tempoInput.value} BPM.`;
});

swingInput.addEventListener("input", () => {
  swingOutput.textContent = `${swingInput.value}%`;
  status.textContent = `Swing set to ${swingInput.value}%.`;
});

variationButton.addEventListener("click", () => {
  activateInstrument();
  const source = arrangement[displayedBar] ?? createEmptyPattern();
  arrangement[displayedBar] = source.map((row, trackIndex) =>
    row.map((active, step) => {
      if (trackIndex < 2 && step % 4 === 0) return active;
      if ((step + trackIndex + displayedBar) % 7 === 0) return !active;
      return active;
    }),
  );
  markBarEdited();
  renderGrid();
  performTrack(5, 10, displayedBar);
  status.textContent = `${composition.bars[displayedBar]?.name} varied. The rest of the piece is unchanged.`;
});

clearButton.addEventListener("click", () => {
  arrangement[displayedBar] = createEmptyPattern();
  markBarEdited();
  renderGrid();
  status.textContent = `${composition.bars[displayedBar]?.name} cleared. Add a new gesture with the grid.`;
});

trackPads.forEach((pad) => {
  pad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const trackIndex = Number(pad.dataset.trackIndex);
    performTrack(trackIndex, sequenceStep, displayedBar);
  });
});

window.addEventListener("keydown", (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof HTMLInputElement) return;
  const trackIndex = trackIndexForKey(event.key);
  if (trackIndex === null) return;
  event.preventDefault();
  performTrack(trackIndex, sequenceStep, displayedBar);
});

renderStepRuler();
renderComposition();
updateTransport();
