import {
  BARS_PER_SONG,
  COMPOSITIONS,
  INSTRUMENT_TRACKS,
  STEPS_PER_BAR,
  createEmptyPattern,
  eventForTrack,
  noteName,
  patternFromBar,
  setPatternCell,
  stepDurationSeconds,
  trackIndexForKey,
  transportClockSeconds,
  type Composition,
  type NoteEvent,
  type Pattern,
  type SoundPalette,
  type StepCell,
} from "./instrument-model";

interface AudioEngine {
  context: AudioContext;
  master: GainNode;
  echoInput: GainNode;
  reverbInput: GainNode;
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
const canvas = required<HTMLCanvasElement>('[data-testid="sound-canvas"]');
const canvasContext = canvas.getContext("2d");
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
const currentSection = required<HTMLElement>('[data-testid="current-section"]');
const keyLabel = required<HTMLElement>("[data-key-label]");
const durationLabel = required<HTMLElement>("[data-duration]");
const tempoLabel = required<HTMLElement>("[data-tempo-label]");
const songPosition = required<HTMLElement>('[data-testid="song-position"]');
const barName = required<HTMLElement>('[data-testid="bar-name"]');
const phraseTitle = required<HTMLElement>("#phrase-title");
const phraseSection = required<HTMLElement>("[data-phrase-section]");
const editState = required<HTMLElement>("[data-edit-state]");
const progress = required<HTMLElement>("[data-song-progress]");
const status = required<HTMLElement>('[data-testid="instrument-status"]');
const tempoInput = required<HTMLInputElement>("#tempo");
const tempoOutput = required<HTMLOutputElement>("#tempo-output");
const swingInput = required<HTMLInputElement>("#swing");
const swingOutput = required<HTMLOutputElement>("#swing-output");
const variationButton = required<HTMLButtonElement>('[data-testid="variation-bar"]');
const clearButton = required<HTMLButtonElement>('[data-testid="clear-bar"]');
const compositionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-composition]"));
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
let visualStep = 0;
let audio: AudioEngine | null = null;
let paintGesture: PaintGesture | null = null;
let isPlaying = false;
let nextStepAt = 0;
let schedulerTimer: number | null = null;
let completionTimer: number | null = null;
const visualTimers = new Set<number>();
const editedBars = new Set<number>();
const visualEnergy = INSTRUMENT_TRACKS.map(() => 0);

function makeNoiseBuffer(context: AudioContext, duration = 0.5): AudioBuffer {
  const length = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
  return buffer;
}

function makeImpulseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 1.8);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channelIndex = 0; channelIndex < 2; channelIndex += 1) {
    const channel = buffer.getChannelData(channelIndex);
    for (let index = 0; index < length; index += 1) {
      const decay = (1 - index / length) ** 2.7;
      channel[index] = (Math.random() * 2 - 1) * decay;
    }
  }
  return buffer;
}

function ensureAudio(): AudioEngine | null {
  if (typeof AudioContext === "undefined") return null;
  if (!audio) {
    const context = new AudioContext({ latencyHint: "interactive" });
    const master = new GainNode(context, { gain: 0.45 });
    const compressor = new DynamicsCompressorNode(context, {
      threshold: -20,
      knee: 18,
      ratio: 6,
      attack: 0.005,
      release: 0.24,
    });
    const delay = new DelayNode(context, { delayTime: 0.23, maxDelayTime: 0.7 });
    const echoInput = new GainNode(context, { gain: 0.12 });
    const echoReturn = new GainNode(context, { gain: 0.13 });
    const convolver = new ConvolverNode(context, { buffer: makeImpulseBuffer(context) });
    const reverbInput = new GainNode(context, { gain: 0.12 });
    const reverbReturn = new GainNode(context, { gain: 0.2 });

    master.connect(compressor);
    echoInput.connect(delay).connect(echoReturn).connect(compressor);
    reverbInput.connect(convolver).connect(reverbReturn).connect(compressor);
    compressor.connect(context.destination);
    audio = { context, master, echoInput, reverbInput, noise: makeNoiseBuffer(context) };
  }
  if (audio.context.state === "suspended") void audio.context.resume();
  return audio;
}

// Page time continues while browsers negotiate audio permission, so the visual song never freezes.
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

function connectVoice(engine: AudioEngine, output: AudioNode, echo = 0.1, reverb = 0.1): void {
  output.connect(engine.master);
  if (echo > 0) {
    const send = new GainNode(engine.context, { gain: echo });
    output.connect(send).connect(engine.echoInput);
  }
  if (reverb > 0) {
    const send = new GainNode(engine.context, { gain: reverb });
    output.connect(send).connect(engine.reverbInput);
  }
}

function midiFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function eventDuration(event: NoteEvent): number {
  return Math.max(0.08, event.length * (30 / Number(tempoInput.value)));
}

function triggerKick(engine: AudioEngine, at: number, event: NoteEvent): void {
  const oscillator = new OscillatorNode(engine.context, {
    frequency: palette === "voltage" ? 185 : 145,
    type: palette === "porcelain" ? "triangle" : "sine",
  });
  const click = new OscillatorNode(engine.context, { frequency: 760, type: "triangle" });
  const body = new GainNode(engine.context, { gain: 0.0001 });
  const clickGain = new GainNode(engine.context, { gain: 0.0001 });
  const output = new GainNode(engine.context, { gain: event.velocity });
  const duration = palette === "velvet" ? 0.43 : 0.31;
  oscillator.connect(body).connect(output);
  click.connect(clickGain).connect(output);
  connectVoice(engine, output, 0.01, 0.01);
  oscillator.frequency.exponentialRampToValueAtTime(45, at + duration * 0.75);
  body.gain.exponentialRampToValueAtTime(0.7, at + 0.005);
  body.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  clickGain.gain.exponentialRampToValueAtTime(0.11, at + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.032);
  oscillator.start(at); click.start(at);
  oscillator.stop(at + duration + 0.03); click.stop(at + 0.05);
}

function triggerSnare(engine: AudioEngine, at: number, event: NoteEvent): void {
  const noise = new AudioBufferSourceNode(engine.context, { buffer: engine.noise });
  const filter = new BiquadFilterNode(engine.context, {
    type: palette === "porcelain" ? "bandpass" : "highpass",
    frequency: palette === "voltage" ? 2100 : 1450,
    Q: palette === "porcelain" ? 2.2 : 0.75,
  });
  const noiseGain = new GainNode(engine.context, { gain: 0.0001 });
  const body = new OscillatorNode(engine.context, { frequency: 182, type: "triangle" });
  const bodyGain = new GainNode(engine.context, { gain: 0.0001 });
  const output = new StereoPannerNode(engine.context, { pan: 0.13 });
  const duration = palette === "velvet" ? 0.2 : 0.14;
  noise.connect(filter).connect(noiseGain).connect(output);
  body.connect(bodyGain).connect(output);
  connectVoice(engine, output, 0.04, 0.08);
  noiseGain.gain.exponentialRampToValueAtTime(0.3 * event.velocity, at + 0.003);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  bodyGain.gain.exponentialRampToValueAtTime(0.13, at + 0.003);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
  noise.start(at); body.start(at);
  noise.stop(at + duration + 0.03); body.stop(at + 0.12);
}

function triggerBass(engine: AudioEngine, at: number, event: NoteEvent): void {
  const pitch = event.pitch ?? 40;
  const primary = new OscillatorNode(engine.context, {
    frequency: midiFrequency(pitch),
    type: palette === "voltage" ? "sawtooth" : "triangle",
  });
  const sub = new OscillatorNode(engine.context, { frequency: midiFrequency(pitch - 12), type: "sine" });
  const primaryGain = new GainNode(engine.context, { gain: 0.64 });
  const subGain = new GainNode(engine.context, { gain: 0.22 });
  const filter = new BiquadFilterNode(engine.context, {
    type: "lowpass",
    frequency: palette === "voltage" ? 1100 : palette === "porcelain" ? 760 : 580,
    Q: palette === "voltage" ? 5 : 1.5,
  });
  const envelope = new GainNode(engine.context, { gain: 0.0001 });
  const pan = new StereoPannerNode(engine.context, { pan: -0.18 });
  const duration = Math.min(0.75, eventDuration(event));
  primary.connect(primaryGain).connect(filter); sub.connect(subGain).connect(filter);
  filter.connect(envelope).connect(pan); connectVoice(engine, pan, 0.03, 0.04);
  envelope.gain.exponentialRampToValueAtTime(0.17 * event.velocity, at + 0.014);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  filter.frequency.exponentialRampToValueAtTime(240, at + duration);
  primary.start(at); sub.start(at);
  primary.stop(at + duration + 0.04); sub.stop(at + duration + 0.04);
}

function triggerKeys(engine: AudioEngine, at: number, event: NoteEvent): void {
  const pitch = event.pitch ?? 48;
  const intervals = event.chord === "minor" ? [0, 3, 7, 12] : event.chord === "sus2" ? [0, 2, 7, 12] : [0, 4, 7, 12];
  const filter = new BiquadFilterNode(engine.context, {
    type: "lowpass",
    frequency: palette === "velvet" ? 1550 : palette === "voltage" ? 3100 : 2450,
    Q: 0.8,
  });
  const envelope = new GainNode(engine.context, { gain: 0.0001 });
  const pan = new StereoPannerNode(engine.context, { pan: 0.06 });
  const duration = Math.min(2.7, eventDuration(event));
  intervals.forEach((interval, index) => {
    const oscillator = new OscillatorNode(engine.context, {
      frequency: midiFrequency(pitch + interval),
      detune: index % 2 === 0 ? -4 : 5,
      type: palette === "voltage" ? "sawtooth" : index === 3 ? "sine" : "triangle",
    });
    const level = new GainNode(engine.context, { gain: index === 0 ? 0.42 : 0.2 });
    oscillator.connect(level).connect(filter);
    oscillator.start(at); oscillator.stop(at + duration + 0.08);
  });
  filter.connect(envelope).connect(pan); connectVoice(engine, pan, 0.12, 0.2);
  envelope.gain.exponentialRampToValueAtTime(0.085 * event.velocity, at + 0.035);
  envelope.gain.exponentialRampToValueAtTime(0.032, at + duration * 0.7);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
}

function triggerPluck(engine: AudioEngine, at: number, event: NoteEvent): void {
  const pitch = event.pitch ?? 69;
  const primary = new OscillatorNode(engine.context, {
    frequency: midiFrequency(pitch),
    type: palette === "voltage" ? "sawtooth" : "triangle",
  });
  const companion = new OscillatorNode(engine.context, {
    frequency: midiFrequency(pitch),
    detune: palette === "porcelain" ? 5 : -7,
    type: "sine",
  });
  const companionGain = new GainNode(engine.context, { gain: 0.28 });
  const filter = new BiquadFilterNode(engine.context, {
    type: "lowpass",
    frequency: palette === "voltage" ? 4300 : 2850,
    Q: 1.6,
  });
  const envelope = new GainNode(engine.context, { gain: 0.0001 });
  const pan = new StereoPannerNode(engine.context, { pan: -0.34 });
  const duration = Math.min(0.9, eventDuration(event));
  primary.connect(filter); companion.connect(companionGain).connect(filter);
  filter.connect(envelope).connect(pan); connectVoice(engine, pan, 0.11, 0.16);
  envelope.gain.exponentialRampToValueAtTime(0.105 * event.velocity, at + 0.01);
  envelope.gain.exponentialRampToValueAtTime(0.042, at + duration * 0.45);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  primary.start(at); companion.start(at);
  primary.stop(at + duration + 0.04); companion.stop(at + duration + 0.04);
}

function triggerBell(engine: AudioEngine, at: number, event: NoteEvent): void {
  const pitch = event.pitch ?? 81;
  const envelope = new GainNode(engine.context, { gain: 0.0001 });
  const highpass = new BiquadFilterNode(engine.context, { type: "highpass", frequency: 540, Q: 0.6 });
  const pan = new StereoPannerNode(engine.context, { pan: 0.42 });
  const duration = Math.min(1.8, eventDuration(event));
  [1, 2.01, 3.98].forEach((ratio, index) => {
    const oscillator = new OscillatorNode(engine.context, { frequency: midiFrequency(pitch) * ratio, type: "sine" });
    const level = new GainNode(engine.context, { gain: [0.58, 0.2, 0.07][index] ?? 0.08 });
    oscillator.connect(level).connect(highpass);
    oscillator.start(at); oscillator.stop(at + duration + 0.08);
  });
  highpass.connect(envelope).connect(pan); connectVoice(engine, pan, 0.2, 0.34);
  envelope.gain.exponentialRampToValueAtTime(0.09 * event.velocity, at + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
}

function pulseTrack(trackIndex: number, step: number, delaySeconds = 0): void {
  const startTimer = window.setTimeout(() => {
    visualEnergy[trackIndex] = 1;
    const pad = trackPads.find((candidate) => Number(candidate.dataset.trackIndex) === trackIndex);
    const cell = grid.querySelector<HTMLElement>(`[data-track-index="${trackIndex}"][data-step="${step}"]`);
    pad?.classList.add("is-sounding"); cell?.classList.add("is-sounding");
    const endTimer = window.setTimeout(() => {
      pad?.classList.remove("is-sounding"); cell?.classList.remove("is-sounding");
      visualTimers.delete(endTimer);
    }, 130);
    visualTimers.add(endTimer); visualTimers.delete(startTimer);
  }, Math.max(0, delaySeconds * 1000));
  visualTimers.add(startTimer);
}

function performTrack(
  trackIndex: number,
  step: number,
  bar: number,
  event: NoteEvent,
  at = clockSeconds(),
  announce = true,
): void {
  const track = INSTRUMENT_TRACKS[trackIndex];
  if (!track) return;
  const engine = audio ?? activateInstrument();
  if (engine) {
    const start = audioStart(engine, at);
    if (trackIndex === 0) triggerKick(engine, start, event);
    else if (trackIndex === 1) triggerSnare(engine, start, event);
    else if (trackIndex === 2) triggerBass(engine, start, event);
    else if (trackIndex === 3) triggerKeys(engine, start, event);
    else if (trackIndex === 4) triggerPluck(engine, start, event);
    else triggerBell(engine, start, event);
  }
  pulseTrack(trackIndex, step, at - clockSeconds());
  if (announce) {
    const pitch = event.pitch === undefined ? "" : ` ${noteName(event.pitch)}`;
    status.textContent = `${track.name}${pitch} played in the ${palette} ensemble.`;
  }
}

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  canvasContext?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawSoundCanvas(time: number): void {
  if (canvasContext) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvasContext.clearRect(0, 0, width, height);
    const startX = Math.min(width * 0.32, 390);
    const endX = width < 700 ? width + 30 : width - 330;
    INSTRUMENT_TRACKS.forEach((track, trackIndex) => {
      const energy = visualEnergy[trackIndex] ?? 0;
      const baseY = height * (0.27 + trackIndex * 0.085);
      const amplitude = 8 + trackIndex * 2 + energy * 29 + (isPlaying ? 5 : 0);
      canvasContext.beginPath();
      for (let point = 0; point <= 72; point += 1) {
        const progressX = point / 72;
        const x = startX + (endX - startX) * progressX;
        const wave = Math.sin(progressX * Math.PI * (3 + trackIndex * 0.45) + time * 0.0012 + trackIndex) * amplitude;
        const counterWave = Math.sin(progressX * Math.PI * 9 - time * 0.0007) * (3 + energy * 5);
        const y = baseY + wave * Math.sin(progressX * Math.PI) + counterWave;
        if (point === 0) canvasContext.moveTo(x, y);
        else canvasContext.lineTo(x, y);
      }
      canvasContext.strokeStyle = track.colour;
      canvasContext.globalAlpha = 0.23 + energy * 0.7;
      canvasContext.lineWidth = 1.2 + energy * 4.5;
      canvasContext.stroke();
      visualEnergy[trackIndex] = Math.max(0, energy * 0.92 - 0.004);
    });
    canvasContext.globalAlpha = 1;
  }
  requestAnimationFrame(drawSoundCanvas);
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
      const event = pattern[trackIndex]?.[step] ?? null;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sequence-cell";
      cell.classList.toggle("is-active", event !== null);
      cell.classList.toggle("is-percussion", trackIndex < 2);
      cell.dataset.trackIndex = String(trackIndex);
      cell.dataset.step = String(step);
      cell.dataset.noteName = noteName(event?.pitch);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${track.name}${event?.pitch === undefined ? "" : ` ${noteName(event.pitch)}`}, phrase ${displayedBar + 1}, step ${step + 1}`);
      cell.setAttribute("aria-pressed", String(event !== null));
      cell.style.setProperty("--track-colour", track.colour);
      cell.textContent = trackIndex >= 2 ? noteName(event?.pitch) : "";
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
    button.setAttribute("aria-label", `Edit ${bar.section.toLowerCase()} phrase ${index + 1}: ${bar.name}`);
    const number = document.createElement("b");
    number.textContent = `${String(index + 1).padStart(2, "0")}${editedBars.has(index) ? " *" : ""}`;
    const name = document.createElement("span");
    name.textContent = bar.name;
    const section = document.createElement("em");
    section.textContent = bar.section;
    button.append(number, name, section);
    fragment.append(button);
  });
  barNavigator.replaceChildren(fragment);
}

function formatDuration(seconds: number): string {
  return `0:${String(Math.round(seconds)).padStart(2, "0")}`;
}

function compositionDuration(current: Composition): number {
  return (BARS_PER_SONG * STEPS_PER_BAR * 30) / current.tempo;
}

function renderPhraseLabels(): void {
  const bar = composition.bars[displayedBar];
  if (!bar) return;
  currentSection.textContent = bar.section;
  barName.textContent = bar.name;
  phraseTitle.textContent = bar.name;
  phraseSection.textContent = `${bar.section} / PHRASE ${String(displayedBar + 1).padStart(2, "0")}`;
  songPosition.textContent = `${String(displayedBar + 1).padStart(2, "0")} / ${String(BARS_PER_SONG).padStart(2, "0")}`;
  editState.textContent = editedBars.has(displayedBar) ? "YOUR ARRANGEMENT" : "ORIGINAL ARRANGEMENT";
}

function renderComposition(): void {
  title.textContent = composition.title;
  character.textContent = composition.character;
  keyLabel.textContent = composition.keyLabel;
  durationLabel.textContent = formatDuration(compositionDuration(composition));
  tempoLabel.textContent = `${composition.tempo} BPM`;
  tempoInput.value = String(composition.tempo);
  swingInput.value = String(composition.swing);
  tempoOutput.textContent = `${tempoInput.value} BPM`;
  swingOutput.textContent = `${swingInput.value}%`;
  compositionButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.composition === composition.id)));
  paletteButtons.forEach((button) => {
    const active = button.dataset.palette === palette;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderPhraseLabels(); renderBarNavigator(); renderGrid();
}

function selectBar(index: number): void {
  displayedBar = (index + BARS_PER_SONG) % BARS_PER_SONG;
  renderPhraseLabels(); renderBarNavigator(); renderGrid();
}

function cellForOpening(bar: number, trackIndex: number, preferredStep = 0): NoteEvent {
  const row = arrangement[bar]?.[trackIndex];
  return row?.[preferredStep] ?? row?.find((cell): cell is NoteEvent => cell !== null) ?? eventForTrack(trackIndex, composition.scale[trackIndex] ?? 60);
}

function playOpening(): void {
  activateInstrument();
  const now = clockSeconds();
  performTrack(3, 0, 0, cellForOpening(0, 3), now, false);
  performTrack(4, 0, 0, cellForOpening(0, 4), now + 0.07, false);
  performTrack(5, 0, 0, cellForOpening(0, 5), now + 0.15, false);
  status.textContent = `${composition.title} is awake. Play the complete song or touch any voice.`;
}

function loadComposition(next: Composition): void {
  if (isPlaying) stopPlayback(false);
  compositionIndex = COMPOSITIONS.findIndex((candidate) => candidate.id === next.id);
  composition = next;
  arrangement = composition.bars.map(patternFromBar);
  palette = composition.palette;
  displayedBar = 0; playbackBar = 0; visualBar = 0; sequenceStep = 0; visualStep = 0;
  editedBars.clear(); progress.style.width = "0%";
  renderComposition(); playOpening();
  status.textContent = `${composition.title} loaded: intro, verse, chorus, bridge and outro.`;
}

function nearbyPitch(trackIndex: number, step: number): number {
  const row = arrangement[displayedBar]?.[trackIndex] ?? [];
  for (let distance = 1; distance < STEPS_PER_BAR; distance += 1) {
    const before = row[step - distance]?.pitch;
    if (before !== undefined) return before;
    const after = row[step + distance]?.pitch;
    if (after !== undefined) return after;
  }
  const scalePitch = composition.scale[(step + displayedBar + trackIndex) % composition.scale.length] ?? 60;
  if (trackIndex === 2) return scalePitch - 24;
  if (trackIndex === 3) return scalePitch - 12;
  if (trackIndex === 5) return scalePitch + 12;
  return scalePitch;
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
  const nextEvent = active ? eventForTrack(trackIndex, nearbyPitch(trackIndex, step)) : null;
  arrangement[displayedBar] = setPatternCell(current, trackIndex, step, nextEvent);
  markBarEdited(); renderGrid();
  if (withSound && nextEvent) performTrack(trackIndex, step, displayedBar, nextEvent);
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
  event.preventDefault(); activateInstrument(); grid.setPointerCapture(event.pointerId);
  const active = cell.getAttribute("aria-pressed") !== "true";
  paintGesture = { pointerId: event.pointerId, active, visited: new Set([cellKey(cell)]) };
  editCell(cell, active);
});

grid.addEventListener("pointermove", (event) => {
  if (!paintGesture || paintGesture.pointerId !== event.pointerId) return;
  const cell = cellFromTarget(document.elementFromPoint(event.clientX, event.clientY));
  if (!cell || paintGesture.visited.has(cellKey(cell))) return;
  paintGesture.visited.add(cellKey(cell)); editCell(cell, paintGesture.active);
});

function endPaint(event: PointerEvent): void {
  if (paintGesture?.pointerId === event.pointerId) paintGesture = null;
}
grid.addEventListener("pointerup", endPaint);
grid.addEventListener("pointercancel", endPaint);
grid.addEventListener("click", (event) => {
  if (event.detail !== 0) return;
  const cell = cellFromTarget(event.target);
  if (cell) editCell(cell, cell.getAttribute("aria-pressed") !== "true");
});

function setPlayhead(bar: number, step: number | null): void {
  visualBar = bar;
  visualStep = step ?? 0;
  grid.querySelectorAll<HTMLElement>(".sequence-cell").forEach((cell) => {
    cell.classList.toggle("is-current", step !== null && Number(cell.dataset.step) === step);
  });
  renderBarNavigator();
}

function clearVisualTimers(): void {
  for (const timer of visualTimers) window.clearTimeout(timer);
  visualTimers.clear();
  trackPads.forEach((pad) => pad.classList.remove("is-sounding"));
  grid.querySelectorAll<HTMLElement>(".sequence-cell").forEach((cell) => cell.classList.remove("is-sounding", "is-current"));
}

function scheduleStep(bar: number, step: number, at: number): void {
  const pattern = arrangement[bar] ?? createEmptyPattern();
  for (let trackIndex = 0; trackIndex < INSTRUMENT_TRACKS.length; trackIndex += 1) {
    const event = pattern[trackIndex]?.[step];
    if (event) performTrack(trackIndex, step, bar, event, at, false);
  }
  const timer = window.setTimeout(() => {
    if (isPlaying) {
      if (displayedBar !== bar) selectBar(bar);
      setPlayhead(bar, step);
      const position = bar * STEPS_PER_BAR + step;
      progress.style.width = `${(position / (BARS_PER_SONG * STEPS_PER_BAR - 1)) * 100}%`;
      status.textContent = `${composition.title} / ${composition.bars[bar]?.section} / ${composition.bars[bar]?.name}`;
    }
    visualTimers.delete(timer);
  }, Math.max(0, (at - clockSeconds()) * 1000));
  visualTimers.add(timer);
}

function finishPlayback(): void {
  isPlaying = false;
  schedulerTimer = null; completionTimer = null;
  displayedBar = 0; playbackBar = 0; visualBar = 0; sequenceStep = 0; visualStep = 0;
  clearVisualTimers(); progress.style.width = "0%";
  updateTransport(); renderPhraseLabels(); renderBarNavigator(); renderGrid();
  status.textContent = `${composition.title} completed and returned to its opening.`;
}

function scheduleAhead(): void {
  if (!isPlaying) return;
  const horizon = clockSeconds() + 0.12;
  const tempo = Number(tempoInput.value);
  const swing = Number(swingInput.value) / 100;
  while (nextStepAt < horizon) {
    const currentBar = playbackBar;
    const currentStep = sequenceStep;
    scheduleStep(currentBar, currentStep, nextStepAt);
    const duration = stepDurationSeconds(tempo, currentStep, swing);
    nextStepAt += duration;
    if (currentBar === BARS_PER_SONG - 1 && currentStep === STEPS_PER_BAR - 1) {
      const delay = Math.max(0, (nextStepAt - clockSeconds()) * 1000 + 650);
      completionTimer = window.setTimeout(finishPlayback, delay);
      schedulerTimer = null;
      return;
    }
    sequenceStep += 1;
    if (sequenceStep >= STEPS_PER_BAR) {
      sequenceStep = 0;
      playbackBar += 1;
    }
  }
  schedulerTimer = window.setTimeout(scheduleAhead, 25);
}

function updateTransport(): void {
  transportButton.setAttribute("aria-pressed", String(isPlaying));
  transportButton.setAttribute("aria-label", isPlaying ? "Stop full song" : "Play full song");
  transportState.textContent = isPlaying ? "Stop performance" : "Play the song";
}

function startPlayback(): void {
  activateInstrument();
  displayedBar = 0; playbackBar = 0; visualBar = 0; sequenceStep = 0; visualStep = 0;
  progress.style.width = "0%"; renderPhraseLabels(); renderBarNavigator(); renderGrid();
  isPlaying = true; nextStepAt = clockSeconds() + 0.06;
  updateTransport();
  status.textContent = `${composition.title} begins. The full sixteen-measure performance is running.`;
  scheduleAhead();
}

function stopPlayback(announce = true): void {
  isPlaying = false;
  if (schedulerTimer !== null) window.clearTimeout(schedulerTimer);
  if (completionTimer !== null) window.clearTimeout(completionTimer);
  schedulerTimer = null; completionTimer = null;
  clearVisualTimers(); setPlayhead(displayedBar, null); updateTransport();
  if (announce) status.textContent = `${composition.title} paused. Its phrases remain open to edit.`;
}

beginButton.addEventListener("click", playOpening);
transportButton.addEventListener("click", () => isPlaying ? stopPlayback() : startPlayback());
previousBarButton.addEventListener("click", () => selectBar(displayedBar - 1));
nextBarButton.addEventListener("click", () => selectBar(displayedBar + 1));

barNavigator.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-bar-index]") : null;
  if (button) selectBar(Number(button.dataset.barIndex));
});

compositionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selected = COMPOSITIONS.find((candidate) => candidate.id === button.dataset.composition);
    if (selected) loadComposition(selected);
  });
});

paletteButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateInstrument(); palette = button.dataset.palette as SoundPalette;
    paletteButtons.forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    const preview = cellForOpening(displayedBar, 4, visualStep);
    performTrack(4, visualStep, displayedBar, preview);
    status.textContent = `${palette[0]?.toUpperCase()}${palette.slice(1)} now colours the complete ensemble.`;
  });
});

tempoInput.addEventListener("input", () => {
  tempoOutput.textContent = `${tempoInput.value} BPM`;
  tempoLabel.textContent = `${tempoInput.value} BPM`;
  status.textContent = `Performance tempo set to ${tempoInput.value} BPM.`;
});
swingInput.addEventListener("input", () => {
  swingOutput.textContent = `${swingInput.value}%`;
  status.textContent = `Performance swing set to ${swingInput.value}%.`;
});

function nextScalePitch(pitch: number, movement: number): number {
  const candidates = composition.scale.flatMap((scalePitch) => [scalePitch - 24, scalePitch - 12, scalePitch, scalePitch + 12, scalePitch + 24]);
  const sorted = [...candidates].sort((a, b) => a - b);
  const closestIndex = sorted.reduce((best, candidate, index) => Math.abs(candidate - pitch) < Math.abs((sorted[best] ?? pitch) - pitch) ? index : best, 0);
  return sorted[Math.max(0, Math.min(sorted.length - 1, closestIndex + movement))] ?? pitch;
}

variationButton.addEventListener("click", () => {
  const source = arrangement[displayedBar] ?? createEmptyPattern();
  arrangement[displayedBar] = source.map((row, trackIndex) => row.map((cell, step) => {
    if (cell?.pitch !== undefined && (step + trackIndex + displayedBar) % 4 === 0) {
      return { ...cell, pitch: nextScalePitch(cell.pitch, step % 8 < 4 ? 1 : -1) };
    }
    if (trackIndex < 2 && (step + trackIndex + displayedBar) % 11 === 0) {
      return cell ? null : eventForTrack(trackIndex, 0);
    }
    return cell;
  }));
  markBarEdited(); renderGrid();
  const preview = cellForOpening(displayedBar, 4);
  performTrack(4, 0, displayedBar, preview);
  status.textContent = `${composition.bars[displayedBar]?.name} recomposed inside ${composition.keyLabel}.`;
});

clearButton.addEventListener("click", () => {
  arrangement[displayedBar] = createEmptyPattern();
  markBarEdited(); renderGrid();
  status.textContent = `${composition.bars[displayedBar]?.name} cleared. The other phrases still hold the song.`;
});

trackPads.forEach((pad) => {
  pad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const trackIndex = Number(pad.dataset.trackIndex);
    const row = arrangement[displayedBar]?.[trackIndex];
    const selected = row?.[visualStep] ?? row?.find((cell): cell is NoteEvent => cell !== null) ?? eventForTrack(trackIndex, nearbyPitch(trackIndex, visualStep));
    performTrack(trackIndex, visualStep, displayedBar, selected);
  });
});

window.addEventListener("keydown", (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement) return;
  const trackIndex = trackIndexForKey(event.key);
  if (trackIndex === null) return;
  event.preventDefault();
  const row = arrangement[displayedBar]?.[trackIndex];
  const selected = row?.[visualStep] ?? row?.find((cell): cell is NoteEvent => cell !== null) ?? eventForTrack(trackIndex, nearbyPitch(trackIndex, visualStep));
  performTrack(trackIndex, visualStep, displayedBar, selected);
});

window.addEventListener("resize", resizeCanvas);
renderStepRuler(); renderComposition(); updateTransport(); resizeCanvas(); requestAnimationFrame(drawSoundCanvas);
