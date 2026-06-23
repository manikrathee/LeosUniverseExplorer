import { clamp, lerp, mulberry32, randn, colorForStar } from "./utils.js";

export const TOOL_META = {
  pulse: { label: "Pulse", cost: 12, color: "#86e5ff" },
  nova: { label: "Nova", cost: 24, color: "#ffd38e" },
  singularity: { label: "Singularity", cost: 30, color: "#ff6e78" },
  rift: { label: "Rift", cost: 18, color: "#b8a6ff" }
};

export const WORLD_LIMIT = 1550;

const AUTO_EVENT_SEQUENCE = ["shooting", "cluster", "birth", "shooting", "death", "cluster"];
const BIRTH_LOGS = [
  "Birth flare wave {n} in galaxy {g}: a new ember ignites.",
  "Wave {n} in galaxy {g}: a fresh stellar core kindles.",
  "Wave {n} births a new star inside galaxy {g}.",
  "Galaxy {g} seeds another bright point on wave {n}."
];
const DEATH_LOGS = [
  "Star death wave {n} in cluster {g}: collapse and flare.",
  "Cluster {g} loses a bright thread on wave {n}.",
  "Wave {n} closes a star in cluster {g}; dust returns.",
  "Cluster {g} flashes through a final collapse on wave {n}."
];
const CLUSTER_LOGS = [
  "Cluster pulse wave {n} in galaxy {g}: ion wash rolls outward.",
  "Galaxy {g} breathes out a cyan pulse on wave {n}.",
  "A cluster halo in galaxy {g} brightens on wave {n} and relaxes.",
  "Galaxy {g} sends a quiet wave {n} through the web."
];
const SHOOTING_LOGS = [
  "Shooting star wave {n}: {dir} streak crossing the field.",
  "Meteor trail wave {n}: {dir} streak across the field.",
  "Shooting star wave {n}: a fast {dir} slash crosses the view.",
  "Streak event wave {n}: {dir} flare threads the field."
];

export function createState() {
  return {
    width: 0,
    height: 0,
    dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
    isCompact: false,
    time: 0,
    lastFrame: performance.now(),
    paused: false,
    tool: "pulse",
    energy: 100,
    entropy: 0,
    fracture: 0,
    camera: { x: 0, y: 0, z: -240, zoom: 1, zoomTarget: 1 },
    cameraTarget: { x: 0, y: 0 },
    pointer: { x: 0, y: 0, down: false, worldX: 0, worldY: 0, prevWorldX: 0, prevWorldY: 0 },
    dragSamples: [],
    stars: [],
    clusters: [],
    nebulae: [],
    galaxies: [],
    effects: [],
    events: [],
    sparks: [],
    eventClock: 0,
    nextEventAt: 0.9,
    eventCursor: 0,
    lastEventLabel: "Awaiting field activity",
    log: [
      "Launch sequence green. Observatory online.",
      "Universe shell stabilized.",
      "Tool rack armed."
    ]
  };
}

export function createUniverse(state) {
  const rng = mulberry32(0x6e0f2026);
  state.stars = [];
  state.clusters = [];
  state.galaxies = [];
  state.effects = [];
  state.events = [];
  state.sparks = [];
  state.eventClock = 0;
  state.nextEventAt = 0.9;
  state.eventCursor = 0;
  state.lastEventLabel = "Awaiting field activity";
  state.fracture = 0;
  state.entropy = 0;
  state.energy = 100;
  state.camera.x = 0;
  state.camera.y = 0;
  state.camera.z = -240;
  state.camera.zoom = 1;
  state.camera.zoomTarget = 1;
  state.cameraTarget.x = 0;
  state.cameraTarget.y = 0;
  state.pointer.down = false;
  state.pointer.worldX = 0;
  state.pointer.worldY = 0;
  state.pointer.prevWorldX = 0;
  state.pointer.prevWorldY = 0;
  state.dragSamples = [];

  for (let i = 0; i < 13; i += 1) {
    const angle = (Math.PI * 2 * i) / 13 + randn(rng) * 0.18;
    const band = 280 + rng() * 820;
    state.clusters.push({
      x: Math.cos(angle) * band + randn(rng) * 120,
      y: Math.sin(angle * 1.16) * band + randn(rng) * 90,
      z: randn(rng) * 240,
      vx: randn(rng) * 0.25,
      vy: randn(rng) * 0.25,
      vz: randn(rng) * 0.08,
      spin: 0.001 + rng() * 0.002
    });
  }

  const galaxySeeds = [
    { x: -980, y: -260, z: -160, radius: 760, armTwist: 1.2, color: "134,229,255" },
    { x: 920, y: -180, z: 220, radius: 680, armTwist: 1.45, color: "255,211,142" },
    { x: -520, y: 720, z: 60, radius: 520, armTwist: 1.18, color: "255,110,120" }
  ];

  for (const galaxy of galaxySeeds) {
    state.galaxies.push(galaxy);
  }

  seedGalaxyStars(state, rng, galaxySeeds[0], 520, 0.8);
  seedGalaxyStars(state, rng, galaxySeeds[1], 430, 0.9);
  seedGalaxyStars(state, rng, galaxySeeds[2], 300, 1.1);
  seedFieldStars(state, rng, 1100);

  while (state.stars.length < 3800) {
    const clusterIndex = Math.floor(rng() * state.clusters.length);
    const cluster = state.clusters[clusterIndex];
    const arm = rng() * Math.PI * 2;
    const spread = 30 + Math.pow(rng(), 0.35) * 650;
    const filament = rng() < 0.28 ? 1.45 : 1;
    const x = cluster.x + Math.cos(arm) * spread * filament + randn(rng) * 28;
    const y = cluster.y + Math.sin(arm) * spread * filament + randn(rng) * 28;
    const z = cluster.z + randn(rng) * 200;
    pushStar(state, rng, {
      x,
      y,
      z,
      vx: cluster.vx + randn(rng) * 0.05,
      vy: cluster.vy + randn(rng) * 0.05,
      vz: cluster.vz + randn(rng) * 0.03
    }, clusterIndex);
  }

  state.nebulae = [
    { x: -640, y: -220, z: -120, radius: 420, color: "134,229,255" },
    { x: 420, y: -360, z: 80, radius: 350, color: "255,211,142" },
    { x: 280, y: 470, z: -220, radius: 390, color: "255,110,120" },
    { x: -180, y: 360, z: 140, radius: 300, color: "169,141,255" }
  ];

  state.log = [
    "Launch sequence green. Observatory online.",
    "Universe shell stabilized.",
    "Tool rack armed."
  ];
}

export function addLog(state, message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 6);
}

function pushStar(state, rng, point, clusterIndex) {
  state.stars.push({
    x: point.x,
    y: point.y,
    z: point.z,
    vx: point.vx ?? randn(rng) * 0.03,
    vy: point.vy ?? randn(rng) * 0.03,
    vz: point.vz ?? randn(rng) * 0.02,
    cluster: clusterIndex,
    size: point.size ?? 0.36 + rng() * 1.7,
    color: colorForStar(rng),
    twinkle: rng() * Math.PI * 2,
    phase: rng() * Math.PI * 2,
    driftX: randn(rng) * 0.28,
    driftY: randn(rng) * 0.28,
    driftZ: randn(rng) * 0.12,
    homeX: point.x,
    homeY: point.y,
    homeZ: point.z,
    alpha: point.alpha ?? 0.7 + rng() * 0.3,
    pulse: 0,
    respawn: 0
  });
}

function seedGalaxyStars(state, rng, galaxy, count, thickness) {
  for (let i = 0; i < count; i += 1) {
    const radius = 60 + Math.pow(rng(), 0.42) * galaxy.radius;
    const arm = rng() * Math.PI * 2;
    const armOffset = radius * galaxy.armTwist * 0.0015;
    const height = randn(rng) * 30 * thickness;
    const x = galaxy.x + Math.cos(arm + armOffset) * radius + randn(rng) * 34;
    const y = galaxy.y + Math.sin(arm + armOffset) * radius + randn(rng) * 34;
    const z = galaxy.z + height + randn(rng) * 24;
    const vx = -Math.sin(arm) * 0.02 + randn(rng) * 0.01;
    const vy = Math.cos(arm) * 0.02 + randn(rng) * 0.01;
    const vz = randn(rng) * 0.01;
    const clusterIndex = Math.floor(rng() * state.clusters.length);
    pushStar(state, rng, { x, y, z, vx, vy, vz }, clusterIndex);
  }
}

function seedFieldStars(state, rng, count) {
  for (let i = 0; i < count; i += 1) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(lerp(-1, 1, rng()));
    const radius = 160 + Math.pow(rng(), 0.28) * 1480;
    const wobble = 0.72 + rng() * 0.32;
    const x = Math.cos(theta) * Math.sin(phi) * radius + randn(rng) * 40;
    const y = Math.sin(theta) * Math.sin(phi) * radius * wobble + randn(rng) * 40;
    const z = Math.cos(phi) * radius * 0.74 + randn(rng) * 48;
    const clusterIndex = Math.floor(rng() * state.clusters.length);
    pushStar(state, rng, {
      x,
      y,
      z,
      vx: randn(rng) * 0.03,
      vy: randn(rng) * 0.03,
      vz: randn(rng) * 0.02,
      size: 0.16 + rng() * 0.48,
      alpha: 0.42 + rng() * 0.24
    }, clusterIndex);
  }
}

export function fireToolAt(state, x, y, tool) {
  const meta = TOOL_META[tool];
  if (state.energy < meta.cost * 0.35) {
    addLog(state, "Energy depleted. Core needs a beat to recover.");
    return;
  }

  state.energy = clamp(state.energy - meta.cost, 0, 100);
  const z = state.camera.z;

  if (tool === "pulse") {
    spawnEffect(state, { kind: "pulse", x, y, z, radius: 0, maxRadius: 700, life: 1.1, age: 0, strength: 1.5, impact: 7, color: meta.color, ringCount: 12, ringSpacing: 34 });
    spawnSpark(state, x, y, z, meta.color, 1.5);
    addLog(state, "Pulse bloom deployed.");
  } else if (tool === "nova") {
    spawnEffect(state, { kind: "nova", x, y, z, radius: 0, maxRadius: 2050, life: 3.0, age: 0, strength: 2.8, impact: 14, color: meta.color });
    spawnSpark(state, x, y, z, meta.color, 2.2);
    addLog(state, "Nova detonation fired.");
  } else if (tool === "singularity") {
    spawnEffect(state, { kind: "singularity", x, y, z, radius: 0, maxRadius: 320, life: 5.5, age: 0, strength: 3.3, impact: 20, color: meta.color, pulseRate: 4.2 });
    spawnSpark(state, x, y, z, meta.color, 1.4);
    addLog(state, "Singularity seeded. Matter collapse in progress.");
  } else if (tool === "rift") {
    spawnEffect(state, { kind: "rift", x, y, z, radius: 0, maxRadius: 170, life: 1.25, age: 0, strength: 1.9, impact: 10, color: meta.color });
    spawnSpark(state, x, y, z, meta.color, 1.7);
    addLog(state, "Rift line carved.");
  }
}

export function traceRift(state, from, to) {
  const meta = TOOL_META.rift;
  const x = to.x;
  const y = to.y;
  spawnEffect(state, {
    kind: "rift",
    x,
    y,
    z: state.camera.z,
    radius: 0,
    maxRadius: 170,
    life: 1.25,
    age: 0,
    strength: 1.9,
    impact: 2.2,
    color: meta.color,
    segment: { from, to }
  });
  spawnSpark(state, x, y, state.camera.z, meta.color, 0.55);
}

export function applySimulationStep(state, dt) {
  const step = dt * 60;

  for (const effect of state.effects) {
    effect.age += dt;
    if (effect.kind === "shooting") {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.z += effect.vz * dt;
      effect.vx *= 0.996;
      effect.vy *= 0.996;
      effect.vz *= 0.996;
    }
    const growthRate = effect.kind === "rift" ? 0.22 : effect.kind === "pulse" ? 0.34 : 0.13;
    effect.radius = lerp(effect.radius, effect.maxRadius, growthRate);
  }
  state.effects = state.effects.filter((effect) => effect.age < effect.life);

  updateAutomaticEvents(state, dt);

  for (const star of state.stars) {
    if (star.respawn > 0) {
      star.respawn -= dt;
      if (star.respawn <= 0) respawnStar(state, star);
      continue;
    }
    let ax = 0;
    let ay = 0;
    let az = 0;

    ax += (star.homeX - star.x) * 0.000018;
    ay += (star.homeY - star.y) * 0.000018;
    az += (star.homeZ - star.z) * 0.000018;

    ax += Math.sin(state.time * 0.45 + star.phase) * 0.00012 + star.driftX * 0.000004;
    ay += Math.cos(state.time * 0.37 + star.phase * 1.17) * 0.00012 + star.driftY * 0.000004;
    az += Math.sin(state.time * 0.29 + star.phase * 0.83) * 0.00006 + star.driftZ * 0.000003;

    const zoomBoost = clamp((state.camera.zoom - 1) * 0.45, 0, 0.45);
    const detailAttractor = 0.000012 + zoomBoost * 0.00002;
    ax += (star.homeX - star.x) * detailAttractor;
    ay += (star.homeY - star.y) * detailAttractor;
    az += (star.homeZ - star.z) * detailAttractor;

    for (const effect of state.effects) {
      if (effect.kind === "rift") {
        applyRiftForce(star, effect, state, (fx, fy, fz, burst) => {
          ax += fx * burst;
          ay += fy * burst;
          az += fz * burst;
        });
        continue;
      }

      const dx = star.x - effect.x;
      const dy = star.y - effect.y;
      const dz = star.z - effect.z;
      const dist = Math.hypot(dx, dy, dz) + 0.001;
      const edge = effect.radius + 30;

      if (dist < edge) {
        const falloff = 1 - dist / edge;
        if (effect.kind === "singularity") {
          const pull = effect.strength * falloff * 0.0045;
          ax -= (dx / dist) * pull;
          ay -= (dy / dist) * pull;
          az -= (dz / dist) * pull * 0.7;
        } else {
          const push = effect.strength * falloff * 0.0028;
          ax += (dx / dist) * push;
          ay += (dy / dist) * push;
          az += (dz / dist) * push * 0.65;
        }
        star.pulse = Math.max(star.pulse, falloff);

        if (effect.kind === "singularity" && dist < effect.radius * 0.12) {
          star.respawn = 1.4 + Math.random() * 1.2;
          star.alpha = 0;
          spawnSpark(state, star.x, star.y, star.z, effect.color, 0.7);
        } else if (effect.kind !== "singularity" && falloff > 0.7) {
          spawnSpark(state, star.x, star.y, star.z, effect.color, 0.2 + falloff * 0.3);
        }
      }
    }

    star.vx += ax * step;
    star.vy += ay * step;
    star.vz += az * step;
    star.vx *= 0.9945;
    star.vy *= 0.9945;
    star.vz *= 0.9945;

    star.x += star.vx * step;
    star.y += star.vy * step;
    star.z += star.vz * step;
    wrapStarAroundView(state, star);

    star.pulse = Math.max(0, star.pulse - dt * 0.9);
    star.alpha = lerp(star.alpha, 0.9, 0.015);
  }

  for (const spark of state.sparks) {
    spark.life -= dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.z += spark.vz * dt;
    spark.vx *= 0.985;
    spark.vy *= 0.985;
    spark.vz *= 0.985;
  }

  state.sparks = state.sparks.filter((spark) => spark.life > 0);
  state.energy = clamp(state.energy + dt * 7, 0, 100);
  state.entropy = clamp(state.entropy - dt * 1.2, 0, 100);
  state.fracture = clamp(state.fracture - dt * 1.8, 0, 100);

  state.camera.x = lerp(state.camera.x, state.cameraTarget.x, 0.018);
  state.camera.y = lerp(state.camera.y, state.cameraTarget.y, 0.018);
  state.camera.zoom = lerp(state.camera.zoom, state.camera.zoomTarget ?? state.camera.zoom, 0.085);
  state.camera.z = lerp(state.camera.z, -220 + Math.sin(state.time * 0.18) * 10, 0.01);
}

function spawnEffect(state, effect) {
  state.effects.push(effect);
  state.fracture = clamp(state.fracture + effect.impact, 0, 100);
  state.entropy = clamp(state.entropy + effect.impact * 1.5, 0, 100);
}

function spawnSpark(state, x, y, z, baseColor, intensity = 1) {
  if (state.sparks.length > 280) {
    state.sparks.splice(0, state.sparks.length - 280);
  }
  const count = Math.round(6 * intensity);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (16 + Math.random() * 70) * intensity;
    state.sparks.push({
      x,
      y,
      z,
      vx: Math.cos(angle) * speed + randn(Math.random) * 4,
      vy: Math.sin(angle) * speed + randn(Math.random) * 4,
      vz: randn(Math.random) * 10,
      life: 0.45 + Math.random() * 0.7,
      size: 0.8 + Math.random() * 1.9,
      color: baseColor
    });
  }
}

function updateAutomaticEvents(state, dt) {
  state.eventClock += dt;
  if (state.eventClock >= state.nextEventAt) {
    state.eventClock = 0;
    state.nextEventAt = 0.72 + Math.random() * 0.58 + clamp((state.entropy + state.fracture) * 0.002, 0, 0.3);
    triggerAutomaticEvent(state);
  }

  state.events = state.events.filter((event) => {
    event.age += dt;
    return event.age < event.life;
  });
}

function triggerAutomaticEvent(state) {
  const slot = state.eventCursor % AUTO_EVENT_SEQUENCE.length;
  state.eventCursor += 1;
  const kind = AUTO_EVENT_SEQUENCE[slot];

  if (kind === "birth") {
    spawnStarBirth(state);
    return;
  }

  if (kind === "death") {
    if (state.stars.length > 1100) {
      spawnStarDeath(state);
    } else {
      pulseCluster(state);
    }
    return;
  }

  if (kind === "cluster") {
    pulseCluster(state);
    return;
  }

  spawnShootingStar(state);
}

function spawnStarBirth(state) {
  const rng = Math.random;
  const galaxyIndex = Math.floor(rng() * state.galaxies.length);
  const galaxy = state.galaxies[galaxyIndex];
  const angle = rng() * Math.PI * 2;
  const radius = 20 + rng() * galaxy.radius * 0.25;
  const x = galaxy.x + Math.cos(angle) * radius + randn(rng) * 10;
  const y = galaxy.y + Math.sin(angle) * radius + randn(rng) * 10;
  const z = galaxy.z + randn(rng) * 18;
  const star = {
    x,
    y,
    z,
    vx: randn(rng) * 0.05,
    vy: randn(rng) * 0.05,
    vz: randn(rng) * 0.03,
    cluster: Math.floor(rng() * state.clusters.length),
    size: 0.25 + rng() * 0.7,
    color: "255,240,220",
    twinkle: rng() * Math.PI * 2,
    phase: rng() * Math.PI * 2,
    driftX: randn(rng) * 0.1,
    driftY: randn(rng) * 0.1,
    driftZ: randn(rng) * 0.1,
    homeX: x,
    homeY: y,
    homeZ: z,
    alpha: 0.3,
    pulse: 1,
    respawn: 0
  };
  state.stars.push(star);
  state.events.push({ kind: "birth", x, y, z, age: 0, life: 1.6 });
  const wave = (state.eventCursor % 9) + 1;
  const message = BIRTH_LOGS[(state.eventCursor + galaxyIndex) % BIRTH_LOGS.length]
    .replace("{g}", String(galaxyIndex + 1))
    .replace("{n}", String(wave));
  pushEventLog(state, "birth", message);
}

function spawnStarDeath(state) {
  if (state.stars.length < 900) return;
  const rng = Math.random;
  const index = Math.floor(rng() * state.stars.length);
  const star = state.stars[index];
  const clusterIndex = typeof star.cluster === "number" ? star.cluster + 1 : 0;
  state.events.push({ kind: "death", x: star.x, y: star.y, z: star.z, age: 0, life: 1.5 });
  spawnSpark(state, star.x, star.y, star.z, "255,180,120", 1.1);
  star.respawn = 1.8 + rng() * 1.4;
  star.alpha = 0;
  const wave = (state.eventCursor % 9) + 1;
  const message = DEATH_LOGS[(state.eventCursor + index) % DEATH_LOGS.length]
    .replace("{g}", String(clusterIndex))
    .replace("{n}", String(wave));
  pushEventLog(state, "death", message);
}

function spawnShootingStar(state) {
  const rng = Math.random;
  const edge = 1500 + rng() * 300;
  const angle = rng() * Math.PI * 2;
  const x = state.camera.x + Math.cos(angle) * edge;
  const y = state.camera.y + Math.sin(angle) * edge;
  const z = state.camera.z - 180 + rng() * 360;
  const vx = -Math.cos(angle + 0.7) * (180 + rng() * 120);
  const vy = -Math.sin(angle + 0.7) * (180 + rng() * 120);
  const vz = randn(rng) * 25;
  state.effects.push({ kind: "shooting", x, y, z, vx, vy, vz, radius: 0, maxRadius: 0, life: 1.7, age: 0, color: "255,255,255", impact: 0 });
  const direction = Math.abs(vx) > Math.abs(vy) ? "horizontal" : "diagonal";
  const wave = (state.eventCursor % 9) + 1;
  const message = SHOOTING_LOGS[state.eventCursor % SHOOTING_LOGS.length]
    .replace("{dir}", direction)
    .replace("{n}", String(wave));
  pushEventLog(state, "shooting", message);
}

function pulseCluster(state) {
  const rng = Math.random;
  const galaxyIndex = Math.floor(rng() * state.galaxies.length);
  const galaxy = state.galaxies[galaxyIndex];
  const x = galaxy.x + randn(rng) * 80;
  const y = galaxy.y + randn(rng) * 80;
  const z = galaxy.z + randn(rng) * 30;
  state.events.push({ kind: "cluster", x, y, z, age: 0, life: 1.2 });
  const wave = (state.eventCursor % 9) + 1;
  const message = CLUSTER_LOGS[(state.eventCursor + galaxyIndex) % CLUSTER_LOGS.length]
    .replace("{g}", String(galaxyIndex + 1))
    .replace("{n}", String(wave));
  pushEventLog(state, "cluster", message);
}

function pushEventLog(state, kind, message) {
  state.lastEventLabel = message;
  state.log.unshift(message);
  state.log = state.log.slice(0, 6);
  state.lastEventKind = kind;
}

function wrapStarAroundView(state, star) {
  const dx = star.x - state.camera.x;
  const dy = star.y - state.camera.y;
  const dz = star.z - state.camera.z;
  const distance = Math.hypot(dx, dy, dz);
  const shellMin = 820;
  const shellMax = 1820;
  if (distance >= shellMax) {
    const nx = dx / distance;
    const ny = dy / distance;
    const nz = dz / distance;
    const wrapDistance = shellMin + Math.random() * 580;
    star.x = state.camera.x - nx * wrapDistance + randn(Math.random) * 18;
    star.y = state.camera.y - ny * wrapDistance + randn(Math.random) * 18;
    star.z = state.camera.z - nz * wrapDistance + randn(Math.random) * 28;
    star.vx *= 0.4;
    star.vy *= 0.4;
    star.vz *= 0.4;
    star.homeX = star.x;
    star.homeY = star.y;
    star.homeZ = star.z;
  } else if (distance <= shellMin) {
    const nx = dx / (distance || 1);
    const ny = dy / (distance || 1);
    const nz = dz / (distance || 1);
    const wrapDistance = shellMax - Math.random() * 420;
    star.x = state.camera.x + nx * wrapDistance + randn(Math.random) * 16;
    star.y = state.camera.y + ny * wrapDistance + randn(Math.random) * 16;
    star.z = state.camera.z + nz * wrapDistance + randn(Math.random) * 24;
    star.vx *= 0.4;
    star.vy *= 0.4;
    star.vz *= 0.4;
    star.homeX = star.x;
    star.homeY = star.y;
    star.homeZ = star.z;
  }
}

function respawnStar(state, star) {
  const rng = Math.random;
  const theta = rng() * Math.PI * 2;
  const phi = Math.acos(lerp(-1, 1, rng()));
  const radius = 820 + rng() * 900;
  const sx = Math.cos(theta) * Math.sin(phi);
  const sy = Math.sin(theta) * Math.sin(phi);
  const sz = Math.cos(phi);
  star.x = state.camera.x + sx * radius + randn(rng) * 12;
  star.y = state.camera.y + sy * radius + randn(rng) * 12;
  star.z = state.camera.z + sz * radius + randn(rng) * 18;
  star.vx = randn(rng) * 0.18;
  star.vy = randn(rng) * 0.18;
  star.vz = randn(rng) * 0.1;
  star.alpha = 0.55 + rng() * 0.4;
  star.respawn = 0;
  star.homeX = star.x;
  star.homeY = star.y;
  star.homeZ = star.z;
}

function applyRiftForce(star, effect, state, apply) {
  const segment = effect.segment;
  const startX = segment ? segment.from.x : effect.x - effect.maxRadius * 0.9;
  const startY = segment ? segment.from.y : effect.y - effect.maxRadius * 0.08;
  const endX = segment ? segment.to.x : effect.x + effect.maxRadius * 0.9;
  const endY = segment ? segment.to.y : effect.y + effect.maxRadius * 0.08;
  const line = lineForce(star.x, star.y, startX, startY, endX, endY);
  if (line.dist < 170) {
    const burst = (1 - line.dist / 170) * effect.strength * 0.8;
    const normalX = -line.dy / (line.dist + 0.01);
    const normalY = line.dx / (line.dist + 0.01);
    const tangentX = line.dx / (line.dist + 0.01);
    const tangentY = line.dy / (line.dist + 0.01);
    apply(normalX * 0.85, normalY * 0.85, Math.sin(state.time + line.dist) * 0.03, burst);
    star.vx += tangentX * burst * 0.12;
    star.vy += tangentY * burst * 0.12;
    star.pulse = Math.max(star.pulse, 0.9);
    if (burst > 1.2 && Math.random() < 0.02) {
      spawnSpark(state, star.x, star.y, star.z, effect.color, 0.3);
    }
  }
}

function lineForce(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby || 1;
  const t = clamp((apx * abx + apy * aby) / abLenSq, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return { dist: Math.hypot(dx, dy), dx, dy };
}
