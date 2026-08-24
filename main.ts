import { HARMONIC_SCALE, pointForKey, voiceForPoint, type GestureVoice } from "./instrument-model";

type VoiceMode = "glass" | "ember" | "pulse";

interface VisualNote extends GestureVoice {
  x: number;
  y: number;
  born: number;
  life: number;
  mode: VoiceMode;
}

interface BackgroundStar {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  colour: string;
}

interface PointerTrail {
  x: number;
  y: number;
  playedAt: number;
}

interface AudioEngine {
  context: AudioContext;
  master: GainNode;
  echo: DelayNode;
  echoInput: GainNode;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function canvasContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const canvasRenderingContext = canvasElement.getContext("2d");
  if (!canvasRenderingContext) throw new Error("Canvas 2D context is unavailable");
  return canvasRenderingContext;
}

const stage = required<HTMLElement>("#instrument-stage");
const canvas = required<HTMLCanvasElement>("#star-field");
const context = canvasContext(canvas);

const beginButton = required<HTMLButtonElement>('[data-testid="begin-instrument"]');
const status = required<HTMLElement>('[data-testid="instrument-status"]');
const noteName = required<HTMLElement>('[data-testid="note-name"]');
const noteCount = required<HTMLElement>('[data-testid="note-count"]');
const clearButton = required<HTMLButtonElement>('[data-testid="clear-sky"]');
const voiceButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-voice]"));

let width = 0;
let height = 0;
let pixelRatio = 1;
let audio: AudioEngine | null = null;
let currentMode: VoiceMode = "glass";
let constellationCount = 0;
let lastFrameTime = 0;
let backgroundStars: BackgroundStar[] = [];
let visualNotes: VisualNote[] = [];
const activePointers = new Map<number, PointerTrail>();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeBackgroundStars(): void {
  const random = seededRandom(Math.round(width * 3 + height * 7));
  const amount = Math.max(80, Math.round((width * height) / 9000));
  const colours = ["#f5f1e8", "#6fe7d2", "#f4bd5b", "#c6b9ff"];
  backgroundStars = Array.from({ length: amount }, () => ({
    x: random() * width,
    y: random() * height,
    radius: 0.35 + random() * 1.25,
    alpha: 0.18 + random() * 0.58,
    phase: random() * Math.PI * 2,
    colour: colours[Math.floor(random() * colours.length)] ?? colours[0],
  }));
}

function resizeCanvas(): void {
  const rect = stage.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  makeBackgroundStars();
}

function drawOrbitLines(time: number): void {
  context.save();
  context.translate(width * 0.64, height * 0.52);
  context.rotate(-0.17);
  const motion = reducedMotion ? 0 : Math.sin(time * 0.00014) * 5;
  const rings = [
    [width * 0.23 + motion, height * 0.15, "rgba(111, 231, 210, 0.24)"],
    [width * 0.38 - motion, height * 0.25, "rgba(244, 189, 91, 0.18)"],
    [width * 0.54 + motion, height * 0.35, "rgba(255, 121, 95, 0.13)"],
  ] as const;

  for (const [radiusX, radiusY, stroke] of rings) {
    context.beginPath();
    context.ellipse(0, 0, Math.max(70, radiusX), Math.max(40, radiusY), 0, 0, Math.PI * 2);
    context.strokeStyle = stroke;
    context.lineWidth = 0.8;
    context.stroke();
  }
  context.restore();
}

function drawScaleStars(time: number): void {
  HARMONIC_SCALE.forEach((note, index) => {
    const progress = (index + 0.5) / HARMONIC_SCALE.length;
    const x = progress * width;
    const y = height * (0.57 + Math.sin(progress * Math.PI * 3.2) * 0.13);
    const twinkle = reducedMotion ? 1 : 0.76 + Math.sin(time * 0.0018 + index) * 0.24;
    context.beginPath();
    context.arc(x, y, 1.3 + twinkle, 0, Math.PI * 2);
    context.fillStyle = note.colour;
    context.globalAlpha = 0.32 * twinkle;
    context.fill();
  });
  context.globalAlpha = 1;
}

function drawBackground(time: number): void {
  context.fillStyle = "#05070b";
  context.fillRect(0, 0, width, height);
  drawOrbitLines(time);

  for (const star of backgroundStars) {
    const twinkle = reducedMotion ? 1 : 0.78 + Math.sin(time * 0.001 + star.phase) * 0.22;
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fillStyle = star.colour;
    context.globalAlpha = star.alpha * twinkle;
    context.fill();
  }
  context.globalAlpha = 1;
  drawScaleStars(time);
}

function drawConstellation(now: number): void {
  const visible = visualNotes.filter((note) => now - note.born < note.life);
  visualNotes = visible.slice(-80);

  const recent = visible.slice(-12);
  for (let index = 1; index < recent.length; index += 1) {
    const previous = recent[index - 1];
    const current = recent[index];
    if (!previous || !current) continue;
    const age = (now - current.born) / current.life;
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(current.x, current.y);
    context.strokeStyle = current.note.colour;
    context.globalAlpha = Math.max(0, (1 - age) * 0.28);
    context.lineWidth = 0.75;
    context.stroke();
  }

  for (const note of visible) {
    const age = (now - note.born) / note.life;
    const opacity = Math.max(0, 1 - age);
    const radius = 3 + note.intensity * 5;
    const ringRadius = radius + age * (note.mode === "pulse" ? 46 : 70);

    context.beginPath();
    context.arc(note.x, note.y, ringRadius, 0, Math.PI * 2);
    context.strokeStyle = note.note.colour;
    context.globalAlpha = opacity * 0.38;
    context.lineWidth = 1;
    context.stroke();

    context.beginPath();
    context.moveTo(note.x - radius * 2.2, note.y);
    context.lineTo(note.x + radius * 2.2, note.y);
    context.moveTo(note.x, note.y - radius * 2.2);
    context.lineTo(note.x, note.y + radius * 2.2);
    context.strokeStyle = note.note.colour;
    context.globalAlpha = opacity * 0.76;
    context.stroke();

    context.beginPath();
    context.arc(note.x, note.y, radius, 0, Math.PI * 2);
    context.fillStyle = "#f9f6ee";
    context.globalAlpha = opacity;
    context.fill();
  }
  context.globalAlpha = 1;
}

function render(time: number): void {
  if (time - lastFrameTime < 1000 / 30) {
    requestAnimationFrame(render);
    return;
  }
  lastFrameTime = time;
  drawBackground(time);
  drawConstellation(time);
  requestAnimationFrame(render);
}

function ensureAudio(): AudioEngine {
  if (!audio) {
    const context = new AudioContext({ latencyHint: "interactive" });
    const master = new GainNode(context, { gain: 0.58 });
    const compressor = new DynamicsCompressorNode(context, {
      threshold: -24,
      knee: 16,
      ratio: 7,
      attack: 0.006,
      release: 0.25,
    });
    const echo = new DelayNode(context, { delayTime: 0.22, maxDelayTime: 0.6 });
    const echoInput = new GainNode(context, { gain: 0.16 });
    const echoReturn = new GainNode(context, { gain: 0.14 });

    echoInput.connect(echo);
    echo.connect(echoReturn);
    echoReturn.connect(compressor);
    master.connect(compressor);
    compressor.connect(context.destination);
    audio = { context, master, echo, echoInput };
  }

  if (audio.context.state === "suspended") void audio.context.resume();
  return audio;
}

function triggerVoice(engine: AudioEngine, voice: GestureVoice, mode: VoiceMode): void {
  const now = engine.context.currentTime;
  const duration = mode === "pulse" ? 0.58 : mode === "ember" ? 1.45 : 1.05;
  const primaryType: OscillatorType = mode === "glass" ? "sine" : mode === "ember" ? "triangle" : "square";
  const primary = new OscillatorNode(engine.context, { frequency: voice.note.frequency, type: primaryType });
  const overtone = new OscillatorNode(engine.context, {
    frequency: voice.note.frequency * (mode === "glass" ? 2 : 1),
    detune: mode === "ember" ? 7 : mode === "pulse" ? -5 : 0,
    type: mode === "glass" ? "sine" : "triangle",
  });
  const primaryLevel = new GainNode(engine.context, { gain: mode === "pulse" ? 0.38 : 0.72 });
  const overtoneLevel = new GainNode(engine.context, { gain: mode === "glass" ? 0.26 : 0.12 });
  const filter = new BiquadFilterNode(engine.context, {
    type: "lowpass",
    frequency: 680 + voice.brightness * 5400,
    Q: mode === "ember" ? 2.4 : 0.8,
  });
  const envelope = new GainNode(engine.context, { gain: 0.0001 });
  const pan = new StereoPannerNode(engine.context, { pan: voice.pan });
  const level = 0.026 + voice.intensity * 0.052;

  primary.connect(primaryLevel).connect(filter);
  overtone.connect(overtoneLevel).connect(filter);
  filter.connect(envelope).connect(pan);
  pan.connect(engine.master);
  pan.connect(engine.echoInput);

  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(level, now + 0.018);
  envelope.gain.exponentialRampToValueAtTime(level * 0.42, now + duration * 0.38);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  primary.start(now);
  overtone.start(now);
  primary.stop(now + duration + 0.04);
  overtone.stop(now + duration + 0.04);
}

function performAt(x: number, y: number, pressure = 0.66): void {
  stage.dataset.state = "playing";
  const voice = voiceForPoint(x, y, width, height, pressure);

  constellationCount += 1;
  noteName.textContent = voice.note.name;
  noteCount.textContent = String(constellationCount).padStart(2, "0");
  status.textContent = `${voice.note.name}, ${currentMode} voice.`;
  visualNotes.push({
    ...voice,
    x,
    y,
    born: performance.now(),
    life: currentMode === "pulse" ? 900 : 1900,
    mode: currentMode,
  });

  if (typeof AudioContext !== "undefined") {
    triggerVoice(ensureAudio(), voice, currentMode);
  }
}

function pointFromEvent(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

beginButton.addEventListener("click", () => {
  performAt(width * 0.58, height * 0.46, 0.72);
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const point = pointFromEvent(event);
  activePointers.set(event.pointerId, { ...point, playedAt: performance.now() });
  performAt(point.x, point.y, event.pressure || 0.66);
});

canvas.addEventListener("pointermove", (event) => {
  const previous = activePointers.get(event.pointerId);
  if (!previous) return;
  const point = pointFromEvent(event);
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
  const now = performance.now();
  if (distance < 28 || now - previous.playedAt < 72) return;
  activePointers.set(event.pointerId, { ...point, playedAt: now });
  performAt(point.x, point.y, event.pressure || 0.66);
});

function releasePointer(event: PointerEvent): void {
  activePointers.delete(event.pointerId);
}

canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);

window.addEventListener("keydown", (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const point = pointForKey(event.key, width, height);
  if (!point) return;
  event.preventDefault();
  performAt(point.x, point.y, 0.72);
});

voiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const voice = button.dataset.voice as VoiceMode;
    currentMode = voice;
    voiceButtons.forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    performAt(width * 0.5, height * 0.48, 0.58);
  });
});

clearButton.addEventListener("click", () => {
  visualNotes = [];
  constellationCount = 0;
  noteCount.textContent = "00";
  status.textContent = "A clear field, ready for a new constellation.";
});

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(stage);
resizeCanvas();
requestAnimationFrame(render);
