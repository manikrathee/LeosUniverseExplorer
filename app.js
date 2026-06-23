import {
  createState,
  createUniverse,
  fireToolAt,
  traceRift,
  applySimulationStep,
  addLog,
  TOOL_META
} from "./universe-sim.js";
import { renderScene, screenToWorld, sampleTelemetry } from "./universe-render.js";
import { clamp, lerp } from "./utils.js";

const canvas = document.getElementById("universe");
const ctx = canvas.getContext("2d");
const toolButtons = [...document.querySelectorAll("[data-tool]")];
const starReadout = document.getElementById("starReadout");
const energyReadout = document.getElementById("energyReadout");
const entropyReadout = document.getElementById("entropyReadout");
const fieldReadout = document.getElementById("fieldReadout");
const telemetryReadout = document.getElementById("telemetryReadout");
const zoomReadout = document.getElementById("zoomReadout");
const fieldLoadReadout = document.getElementById("fieldLoadReadout");
const nextEventReadout = document.getElementById("nextEventReadout");
const recentEventReadout = document.getElementById("recentEventReadout");
const fractureBar = document.getElementById("fractureBar");
const driftBar = document.getElementById("driftBar");
const logList = document.getElementById("logList");
const resetBtn = document.getElementById("resetBtn");
const pauseBtn = document.getElementById("pauseBtn");
const reticle = document.getElementById("reticle");

const state = createState();

function resize() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.isCompact = window.matchMedia("(max-width: 1100px), (pointer: coarse)").matches;
  state.dpr = Math.max(1, Math.min(state.isCompact ? 1.35 : 2, window.devicePixelRatio || 1));
  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

function renderHud() {
  const telemetry = sampleTelemetry(state);
  starReadout.textContent = state.stars.length.toLocaleString();
  energyReadout.textContent = `${Math.round(state.energy)}%`;
  entropyReadout.textContent = `${Math.round(state.entropy)}%`;
  fieldReadout.textContent = "Full field";
  zoomReadout.textContent = `${state.camera.zoom.toFixed(2)}x`;
  fieldLoadReadout.textContent = `${telemetry.visibleStars.toLocaleString()} stars`;
  nextEventReadout.textContent = `${Math.max(0, state.nextEventAt - state.eventClock).toFixed(1)}s`;
  recentEventReadout.textContent = state.lastEventLabel || "None";
  telemetryReadout.textContent = `Effects ${telemetry.visibleEffects} / Events ${telemetry.visibleEvents}`;
  fractureBar.style.width = `${clamp(state.fracture, 0, 100)}%`;
  driftBar.style.width = `${clamp(10 + telemetry.visibleStars / 36 + state.entropy * 0.12, 0, 100)}%`;
  toolButtons.forEach((button) => button.classList.toggle("active", button.dataset.tool === state.tool));
  logList.innerHTML = state.log.map((entry) => `<li>${entry}</li>`).join("");
}

function selectTool(tool) {
  state.tool = tool;
  document.documentElement.style.setProperty("--tool-color", TOOL_META[tool].color);
  renderHud();
}

function handlePointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  state.pointer.x = x;
  state.pointer.y = y;
  reticle.style.left = `${x}px`;
  reticle.style.top = `${y}px`;

  const world = screenToWorld(state, x, y);
  state.pointer.prevWorldX = state.pointer.worldX;
  state.pointer.prevWorldY = state.pointer.worldY;
  state.pointer.worldX = world.x;
  state.pointer.worldY = world.y;

  if (state.pointer.down && state.tool === "rift") {
    const dx = state.pointer.worldX - state.pointer.prevWorldX;
    const dy = state.pointer.worldY - state.pointer.prevWorldY;
    if (Math.hypot(dx, dy) > 6) {
      state.dragSamples.push({ x: world.x, y: world.y });
      if (state.dragSamples.length > 12) state.dragSamples.shift();
      if (state.dragSamples.length >= 2) {
        const a = state.dragSamples[state.dragSamples.length - 2];
        const b = state.dragSamples[state.dragSamples.length - 1];
        traceRift(state, a, b);
      }
    }
  }

  const parallaxX = (x - state.width / 2) * 0.035;
  const parallaxY = (y - state.height / 2) * 0.035;
  state.cameraTarget.x = lerp(state.cameraTarget.x, parallaxX, 0.05);
  state.cameraTarget.y = lerp(state.cameraTarget.y, parallaxY, 0.05);
}

function handlePointerDown(event) {
  canvas.setPointerCapture?.(event.pointerId);
  state.pointer.down = true;
  state.dragSamples = [{ x: state.pointer.worldX, y: state.pointer.worldY }];
  if (state.tool !== "rift") {
    fireToolAt(state, state.pointer.worldX, state.pointer.worldY, state.tool);
  } else {
    fireToolAt(state, state.pointer.worldX, state.pointer.worldY, "rift");
    renderHud();
  }
}

function handlePointerUp() {
  state.pointer.down = false;
  state.dragSamples = [];
}

function handleWheel(event) {
  event.preventDefault();
  const direction = Math.sign(event.deltaY);
  const intensity = clamp(Math.abs(event.deltaY) / 120, 0.35, 2.2);
  const step = 0.028 * intensity;
  const nextTarget = state.camera.zoomTarget ?? state.camera.zoom;
  state.camera.zoomTarget = clamp(nextTarget * (1 - direction * step), 0.72, 1.7);
}

function setupInput() {
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("wheel", handleWheel, { passive: false });

  toolButtons.forEach((button) => {
    button.addEventListener("click", () => selectTool(button.dataset.tool));
  });

  resetBtn.addEventListener("click", () => {
    createUniverse(state);
    renderHud();
    addLog(state, "Universe reset. Cluster lattice restored.");
    renderHud();
  });

  pauseBtn.addEventListener("click", () => {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    addLog(state, state.paused ? "Simulation paused." : "Simulation resumed.");
    renderHud();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "1") selectTool("pulse");
    if (event.key === "2") selectTool("nova");
    if (event.key === "3") selectTool("singularity");
    if (event.key === "4") selectTool("rift");
    if (event.key.toLowerCase() === "r") {
      createUniverse(state);
      addLog(state, "Universe reset. Cluster lattice restored.");
      renderHud();
    }
    if (event.key === " ") {
      event.preventDefault();
      state.paused = !state.paused;
      pauseBtn.textContent = state.paused ? "Resume" : "Pause";
      addLog(state, state.paused ? "Simulation paused." : "Simulation resumed.");
      renderHud();
    }
  });

  window.addEventListener("resize", resize);
  window.__universeDebug = {
    state,
    isCompact: () => Boolean(state.isCompact),
    getEffects: () => state.effects.map((effect) => ({
      kind: effect.kind,
      radius: Number(effect.radius.toFixed(2)),
      age: Number(effect.age.toFixed(2))
    })),
    getStarSample: () => state.stars.slice(0, 3).map((star) => ({
      x: Number(star.x.toFixed(2)),
      y: Number(star.y.toFixed(2)),
      z: Number(star.z.toFixed(2))
    }))
  };
}

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.033, (now - state.lastFrame) / 1000 || 0.016);
  state.lastFrame = now;
  state.time += dt;

  if (!state.paused) {
    applySimulationStep(state, dt);
  }

  renderScene(state, ctx);
  canvas.style.filter = `brightness(${1 + (state.camera.zoom - 1) * 0.18}) saturate(${1 + (state.camera.zoom - 1) * 0.12})`;
  renderHud();
}

resize();
createUniverse(state);
selectTool("pulse");
setupInput();
renderHud();
requestAnimationFrame(tick);
