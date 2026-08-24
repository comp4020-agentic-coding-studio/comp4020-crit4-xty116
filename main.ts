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
  type InstrumentNote,
  type Pattern,
} from "./instrument-model";

type VoiceMode = "felt" | "wire" | "chrome";

interface AudioEngine {
  context: AudioContext;
  master: GainNode;
  echoInput: GainNode;
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
const grid = required<HTMLElement>("#matrix-grid");
const beatHeader = required<HTMLElement>("#beat-header");
const beginButton = required<HTMLButtonElement>('[data-testid="begin-instrument"]');
const transportButton = required<HTMLButtonElement>('[data-testid="transport-toggle"]');
const transportLabel = required<HTMLElement>("[data-transport-label]");
const status = required<HTMLElement>('[data-testid="instrument-status"]');
const currentStepDisplay = required<HTMLElement>('[data-testid="current-step"]');
const currentVoiceDisplay = required<HTMLElement>('[data-testid="current-voice"]');
const tempoInput = required<HTMLInputElement>('#tempo');
const tempoOutput = required<HTMLOutputElement>('#tempo-output');
const swingInput = required<HTMLInputElement>('#swing');
const swingOutput = required<HTMLOutputElement>('#swing-output');
const clearButton = required<HTMLButtonElement>('[data-testid="clear-pattern"]');
const variationButton = required<HTMLButtonElement>('[data-testid="variation-pattern"]');
const presetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-preset]"));
const voiceButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-voice]"));
const notePads = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-note-pad]"));

let pattern: Pattern = createEmptyPattern();
let audio: AudioEngine | null = null;
let voiceMode: VoiceMode = "felt";
let selectedPreset: string | null = null;
let paintGesture: PaintGesture | null = null;
let loopRunning = false;
let sequenceStep = 0;
let nextStepAt = 0;
let schedulerTimer: number | null = null;
const visualTimers = new Set<number>();

function ensureAudio(): AudioEngine | null {
  if (typeof AudioContext === "undefined") return null;

  if (!audio) {
    const context = new AudioContext({ latencyHint: "interactive" });
    const master = new GainNode(context, { gain: 0.62 });
    const compressor = new DynamicsCompressorNode(context, {
      threshold: -22,
      knee: 18,
      ratio: 7,
      attack: 0.005,
      release: 0.22,
    });
    const echo = new DelayNode(context, { delayTime: 0.18, maxDelayTime: 0.5 });
    const echoInput = new GainNode(context, { gain: 0.1 });
    const echoReturn = new GainNode(context, { gain: 0.16 });

    echoInput.connect(echo);
    echo.connect(echoReturn).connect(compressor);
    master.connect(compressor).connect(context.destination);
    audio = { context, master, echoInput };
  }

  if (audio.context.state === "suspended") void audio.context.resume();
  return audio;
}

function clockSeconds(): number {
  return transportClockSeconds(
    audio?.context.state,
    audio?.context.currentTime ?? 0,
    performance.now() / 1000,
  );
}

function activateInstrument(): void {
  stage.dataset.state = "active";
  beginButton.hidden = true;
  ensureAudio();
}

function triggerVoice(
  engine: AudioEngine,
  note: InstrumentNote,
  at: number,
  step: number,
  velocity = 0.72,
): void {
  const start = Math.max(at, engine.context.currentTime);
  const duration = voiceMode === "felt" ? 0.74 : voiceMode === "wire" ? 0.48 : 1.08;
  const primaryType: OscillatorType = voiceMode === "felt" ? "triangle" : voiceMode === "wire" ? "sawtooth" : "sine";
  const overtoneType: OscillatorType = voiceMode === "chrome" ? "sine" : "triangle";
  const primary = new OscillatorNode(engine.context, { frequency: note.frequency, type: primaryType });
  const overtone = new OscillatorNode(engine.context, {
    frequency: note.frequency * (voiceMode === "chrome" ? 2 : 1),
    detune: voiceMode === "wire" ? 8 : -4,
    type: overtoneType,
  });
  const primaryLevel = new GainNode(engine.context, { gain: 0.72 });
  const overtoneLevel = new GainNode(engine.context, { gain: voiceMode === "chrome" ? 0.24 : 0.11 });
  const filter = new BiquadFilterNode(engine.context, {
    type: "lowpass",
    frequency: voiceMode === "wire" ? 2900 : voiceMode === "chrome" ? 5200 : 1800,
    Q: voiceMode === "felt" ? 1.8 : 0.7,
  });
  const envelope = new GainNode(engine.context, { gain: 0.0001 });
  const pan = new StereoPannerNode(engine.context, { pan: (step / (STEP_COUNT - 1)) * 1.5 - 0.75 });
  const peak = 0.025 + velocity * 0.048;

  primary.connect(primaryLevel).connect(filter);
  overtone.connect(overtoneLevel).connect(filter);
  filter.connect(envelope).connect(pan);
  pan.connect(engine.master);
  pan.connect(engine.echoInput);

  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(peak * 0.4, start + duration * 0.42);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  primary.start(start);
  overtone.start(start);
  primary.stop(start + duration + 0.04);
  overtone.stop(start + duration + 0.04);
}

function pulseNote(noteIndex: number, step: number, delaySeconds = 0): void {
  const delay = Math.max(0, delaySeconds * 1000);
  const startTimer = window.setTimeout(() => {
    const pad = notePads.find((candidate) => Number(candidate.dataset.noteIndex) === noteIndex);
    const cell = grid.querySelector<HTMLElement>(`[data-note-index="${noteIndex}"][data-step="${step}"]`);
    pad?.classList.add("is-sounding");
    cell?.classList.add("is-sounding");

    const endTimer = window.setTimeout(() => {
      pad?.classList.remove("is-sounding");
      cell?.classList.remove("is-sounding");
      visualTimers.delete(endTimer);
    }, 130);
    visualTimers.add(endTimer);
    visualTimers.delete(startTimer);
  }, delay);
  visualTimers.add(startTimer);
}

function performNote(noteIndex: number, step: number, at = clockSeconds(), announce = true): void {
  const note = INSTRUMENT_NOTES[noteIndex];
  if (!note) return;
  if (audio) {
    const audioStart = audio.context.state === "running" ? at : audio.context.currentTime;
    triggerVoice(audio, note, audioStart, step);
  }
  pulseNote(noteIndex, step, at - clockSeconds());
  if (announce) status.textContent = `${note.name} printed in ${voiceMode} voice.`;
}

function renderBeatHeader(): void {
  const fragment = document.createDocumentFragment();
  const label = document.createElement("span");
  label.textContent = "BEAT";
  fragment.append(label);
  for (let step = 0; step < STEP_COUNT; step += 1) {
    const number = document.createElement("span");
    number.textContent = String(step + 1).padStart(2, "0");
    fragment.append(number);
  }
  beatHeader.replaceChildren(fragment);
}

function renderGrid(): void {
  const fragment = document.createDocumentFragment();
  for (let displayRow = INSTRUMENT_NOTES.length - 1; displayRow >= 0; displayRow -= 1) {
    const note = INSTRUMENT_NOTES[displayRow];
    if (!note) continue;
    const rowLabel = document.createElement("div");
    rowLabel.className = "row-label";
    rowLabel.setAttribute("role", "rowheader");
    rowLabel.textContent = note.name;
    fragment.append(rowLabel);

    for (let step = 0; step < STEP_COUNT; step += 1) {
      const active = pattern[displayRow]?.[step] ?? false;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "matrix-cell";
      cell.classList.toggle("is-active", active);
      cell.dataset.noteIndex = String(displayRow);
      cell.dataset.step = String(step);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${note.name}, step ${step + 1}`);
      cell.setAttribute("aria-pressed", String(active));
      cell.style.setProperty("--note-colour", note.colour);
      fragment.append(cell);
    }
  }
  grid.replaceChildren(fragment);
}

function setPresetSelection(id: string | null): void {
  selectedPreset = id;
  for (const button of presetButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.preset === selectedPreset));
  }
}

function editCell(cell: HTMLButtonElement, active: boolean, withSound = true): void {
  const noteIndex = Number(cell.dataset.noteIndex);
  const step = Number(cell.dataset.step);
  if (!Number.isInteger(noteIndex) || !Number.isInteger(step)) return;

  pattern = setPatternCell(pattern, noteIndex, step, active);
  cell.classList.toggle("is-active", active);
  cell.setAttribute("aria-pressed", String(active));
  setPresetSelection(null);
  if (withSound) performNote(noteIndex, step);
}

function cellFromTarget(target: EventTarget | null): HTMLButtonElement | null {
  return target instanceof Element ? target.closest<HTMLButtonElement>(".matrix-cell") : null;
}

function cellKey(cell: HTMLButtonElement): string {
  return `${cell.dataset.noteIndex}:${cell.dataset.step}`;
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

function setPlayhead(step: number | null): void {
  currentStepDisplay.textContent = step === null ? "--" : String(step + 1).padStart(2, "0");
  grid.querySelectorAll<HTMLElement>(".matrix-cell").forEach((cell) => {
    cell.classList.toggle("is-current", step !== null && Number(cell.dataset.step) === step);
  });
}

function clearVisualTimers(): void {
  for (const timer of visualTimers) window.clearTimeout(timer);
  visualTimers.clear();
  notePads.forEach((pad) => pad.classList.remove("is-sounding"));
  grid.querySelectorAll<HTMLElement>(".matrix-cell").forEach((cell) => cell.classList.remove("is-sounding"));
}

function scheduleStep(step: number, at: number): void {
  for (let noteIndex = 0; noteIndex < INSTRUMENT_NOTES.length; noteIndex += 1) {
    if (pattern[noteIndex]?.[step]) performNote(noteIndex, step, at, false);
  }

  const visualDelay = Math.max(0, (at - clockSeconds()) * 1000);
  const timer = window.setTimeout(() => {
    if (loopRunning) setPlayhead(step);
    visualTimers.delete(timer);
  }, visualDelay);
  visualTimers.add(timer);
}

function scheduleAhead(): void {
  if (!loopRunning) return;
  const horizon = clockSeconds() + 0.12;
  const tempo = Number(tempoInput.value);
  const swing = Number(swingInput.value) / 100;

  while (nextStepAt < horizon) {
    scheduleStep(sequenceStep, nextStepAt);
    nextStepAt += stepDurationSeconds(tempo, sequenceStep, swing);
    sequenceStep = (sequenceStep + 1) % STEP_COUNT;
  }
  schedulerTimer = window.setTimeout(scheduleAhead, 25);
}

function patternIsEmpty(): boolean {
  return !pattern.some((row) => row.some(Boolean));
}

function updateTransport(): void {
  transportButton.setAttribute("aria-pressed", String(loopRunning));
  transportLabel.textContent = loopRunning ? "Stop loop" : "Start loop";
}

function startLoop(): void {
  if (patternIsEmpty()) {
    const defaultPreset = PATTERN_PRESETS[0];
    if (defaultPreset) {
      pattern = patternFromPreset(defaultPreset);
      setPresetSelection(defaultPreset.id);
      renderGrid();
    }
  }
  loopRunning = true;
  sequenceStep = 0;
  nextStepAt = clockSeconds() + 0.06;
  updateTransport();
  status.textContent = "Automatic press running.";
  scheduleAhead();
}

function stopLoop(): void {
  loopRunning = false;
  if (schedulerTimer !== null) window.clearTimeout(schedulerTimer);
  schedulerTimer = null;
  clearVisualTimers();
  setPlayhead(null);
  updateTransport();
  status.textContent = "Loop held. The plate stays editable.";
}

beginButton.addEventListener("click", () => {
  activateInstrument();
  pattern = setPatternCell(pattern, 0, 0, true);
  renderGrid();
  performNote(0, 0);
});

transportButton.addEventListener("click", () => {
  activateInstrument();
  if (loopRunning) stopLoop();
  else startLoop();
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const preset = PATTERN_PRESETS.find((candidate) => candidate.id === button.dataset.preset);
    if (!preset) return;
    activateInstrument();
    pattern = patternFromPreset(preset);
    setPresetSelection(preset.id);
    renderGrid();

    const previewNotes = pattern
      .map((row, noteIndex) => ({ noteIndex, active: row.some(Boolean) }))
      .filter(({ active }) => active)
      .slice(0, 3);
    const now = clockSeconds();
    previewNotes.forEach(({ noteIndex }, index) => performNote(noteIndex, index, now + index * 0.055, false));
    status.textContent = `${preset.name} loaded and ready to change.`;
  });
});

voiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateInstrument();
    voiceMode = button.dataset.voice as VoiceMode;
    currentVoiceDisplay.textContent = voiceMode.toUpperCase();
    voiceButtons.forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    performNote(2, sequenceStep);
  });
});

tempoInput.addEventListener("input", () => {
  tempoOutput.textContent = `${tempoInput.value} BPM`;
});

swingInput.addEventListener("input", () => {
  swingOutput.textContent = `${swingInput.value}%`;
});

clearButton.addEventListener("click", () => {
  if (loopRunning) stopLoop();
  pattern = createEmptyPattern();
  setPresetSelection(null);
  renderGrid();
  status.textContent = "The plate is clear.";
});

variationButton.addEventListener("click", () => {
  activateInstrument();
  pattern = INSTRUMENT_NOTES.map((_, noteIndex) =>
    Array.from({ length: STEP_COUNT }, (_, step) => {
      if (noteIndex === 0 && step === 0) return true;
      return Math.random() < (noteIndex < 2 ? 0.2 : 0.27);
    }),
  );
  setPresetSelection(null);
  renderGrid();
  const noteIndex = pattern.findIndex((row) => row.some(Boolean));
  performNote(Math.max(0, noteIndex), 0);
  status.textContent = "A new variation is on the plate.";
});

notePads.forEach((pad) => {
  const playPad = (): void => {
    const noteIndex = Number(pad.dataset.noteIndex);
    if (!Number.isInteger(noteIndex)) return;
    activateInstrument();
    performNote(noteIndex, sequenceStep);
  };

  pad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    playPad();
  });
  pad.addEventListener("click", (event) => {
    if (event.detail === 0) playPad();
  });
});

window.addEventListener("keydown", (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const noteIndex = noteIndexForKey(event.key);
  if (noteIndex === null) return;
  event.preventDefault();
  activateInstrument();
  performNote(noteIndex, sequenceStep);
});

renderBeatHeader();
renderGrid();
updateTransport();
