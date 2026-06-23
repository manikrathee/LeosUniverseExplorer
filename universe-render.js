import { clamp, rgba } from "./utils.js";

export function screenToWorld(state, x, y) {
  const zoom = state.camera.zoom || 1;
  return {
    x: (x - state.width / 2) / zoom + state.camera.x,
    y: (y - state.height / 2) / zoom + state.camera.y
  };
}

export function renderScene(state, ctx) {
  ctx.clearRect(0, 0, state.width, state.height);

  const sky = ctx.createLinearGradient(0, 0, state.width, state.height);
  sky.addColorStop(0, "#04060b");
  sky.addColorStop(0.48, "#05070f");
  sky.addColorStop(1, "#020307");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, state.width, state.height);

  renderHUDGlow(state, ctx);
  renderGalaxies(state, ctx);
  renderNebulae(state, ctx);
  renderEvents(state, ctx);
  renderStars(state, ctx);
  renderEffects(state, ctx);
  renderSparks(state, ctx);
  renderVignette(state, ctx);
}

export function sampleTelemetry(state) {
  const drawList = collectVisibleStars(state);
  return {
    visibleStars: drawList.length,
    visibleEffects: state.effects.length,
    visibleEvents: state.events.length
  };
}

function worldToScreen(state, x, y, z) {
  const depth = 920 + z - state.camera.z;
  const perspective = (920 / Math.max(240, depth)) * state.camera.zoom;
  return {
    x: (x - state.camera.x) * perspective + state.width / 2,
    y: (y - state.camera.y) * perspective + state.height / 2,
    scale: perspective
  };
}

function renderHUDGlow(state, ctx) {
  if (state.isCompact) return;
  const center = worldToScreen(state, 0, 0, 0);
  const radius = Math.min(state.width, state.height) * 0.42;
  const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
  glow.addColorStop(0, "rgba(134,229,255,0.09)");
  glow.addColorStop(0.42, "rgba(134,229,255,0.025)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function renderNebulae(state, ctx) {
  const compact = Boolean(state.isCompact);
  for (const nebula of state.nebulae) {
    const p = worldToScreen(state, nebula.x, nebula.y, nebula.z);
    const radius = nebula.radius * p.scale * (compact ? 0.86 : 1);
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    gradient.addColorStop(0, `rgba(${nebula.color}, ${compact ? 0.11 : 0.15})`);
    gradient.addColorStop(0.35, `rgba(${nebula.color}, ${compact ? 0.06 : 0.08})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderGalaxies(state, ctx) {
  const compact = Boolean(state.isCompact);
  ctx.globalCompositeOperation = "lighter";
  for (const galaxy of state.galaxies) {
    const p = worldToScreen(state, galaxy.x, galaxy.y, galaxy.z);
    const scale = Math.min(compact ? 1.2 : 1.5, Math.max(compact ? 0.3 : 0.38, p.scale));
    const radius = galaxy.radius * 0.34 * scale;
    const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    halo.addColorStop(0, `rgba(${galaxy.color}, ${0.08 + scale * 0.1})`);
    halo.addColorStop(0.35, `rgba(${galaxy.color}, ${0.05 + scale * 0.05})`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius * 0.72, radius * 0.38, galaxy.armTwist * 0.3, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(16, radius * 0.16));
    core.addColorStop(0, "rgba(255,255,255,0.55)");
    core.addColorStop(0.45, `rgba(${galaxy.color}, 0.42)`);
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(16, radius * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function renderStars(state, ctx) {
  const drawList = collectVisibleStars(state);
  const compact = Boolean(state.isCompact);

  ctx.globalCompositeOperation = "lighter";
  for (const item of drawList) {
    const { star, x, y, scale } = item;
    if (star.respawn > 0) continue;

    const pulse = 1 + star.pulse * 1.2;
    const size = Math.max(compact ? 0.45 : 0.6, star.size * scale * pulse);
    const alpha = clamp(star.alpha * (0.3 + scale * 0.9), 0.05, 1);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, size * (compact ? 4.8 : 7));
    glow.addColorStop(0, `rgba(${star.color}, ${alpha})`);
    glow.addColorStop(0.2, `rgba(${star.color}, ${alpha * 0.45})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, size * 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(${star.color}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function collectVisibleStars(state) {
  const compact = Boolean(state.isCompact);
  const zoom = Math.max(0.35, state.camera.zoom || 1);
  const zoomInBonus = Math.max(0, (zoom - 1) * (compact ? 140 : 220));
  const zoomOutBonus = Math.max(0, (1 / zoom - 1) * (compact ? 120 : 180));
  const margin = (compact ? 88 : 120) + zoomInBonus + zoomOutBonus;
  return state.stars
    .map((star) => ({ star, ...worldToScreen(state, star.x, star.y, star.z) }))
    .filter((p) => p.x > -margin && p.x < state.width + margin && p.y > -margin && p.y < state.height + margin)
    .sort((a, b) => a.scale - b.scale);
}

function renderEffects(state, ctx) {
  const compact = Boolean(state.isCompact);
  ctx.globalCompositeOperation = "lighter";
  for (const effect of state.effects) {
    const p = worldToScreen(state, effect.x, effect.y, effect.z);
    const radius = effect.radius * p.scale;
    const progress = effect.age / effect.life;
    const alpha = 1 - progress;

    if (effect.kind === "rift") {
      const startWorld = effect.segment ? effect.segment.from : { x: effect.x - effect.maxRadius * 0.9, y: effect.y - effect.maxRadius * 0.08 };
      const endWorld = effect.segment ? effect.segment.to : { x: effect.x + effect.maxRadius * 0.9, y: effect.y + effect.maxRadius * 0.08 };
      const start = worldToScreen(state, startWorld.x, startWorld.y, effect.z);
      const end = worldToScreen(state, endWorld.x, endWorld.y, effect.z);
      const midX = (start.x + end.x) / 2 + Math.sin(effect.age * 22) * 12;
      const midY = (start.y + end.y) / 2 + Math.cos(effect.age * 18) * 12;
      const grad = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      grad.addColorStop(0, rgba(effect.color, 0));
      grad.addColorStop(0.22, rgba(effect.color, 0.1 + alpha * 0.5));
      grad.addColorStop(0.5, rgba(effect.color, 0.35 + alpha * 0.5));
      grad.addColorStop(0.78, rgba(effect.color, 0.1 + alpha * 0.5));
      grad.addColorStop(1, rgba(effect.color, 0));
      ctx.strokeStyle = grad;
      ctx.lineWidth = (compact ? 1.6 : 2) + alpha * (compact ? 2.2 : 3);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(midX, midY);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.04 + alpha * 0.06})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(start.x + 2, start.y - 2);
      ctx.lineTo(midX + 1, midY - 1);
      ctx.lineTo(end.x + 2, end.y - 2);
      ctx.stroke();
      continue;
    }

    if (effect.kind === "shooting") {
      const tail = 120 * (1 - progress);
      const head = worldToScreen(state, effect.x, effect.y, effect.z);
      const trailX = head.x - effect.vx * 0.03;
      const trailY = head.y - effect.vy * 0.03;
      const grad = ctx.createLinearGradient(head.x, head.y, trailX, trailY);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.35, "rgba(255,240,210,0.65)");
      grad.addColorStop(1, "rgba(255,240,210,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = compact ? 1.4 : 1.8;
      ctx.beginPath();
      ctx.moveTo(head.x, head.y);
      ctx.lineTo(head.x - effect.vx * 0.08 * tail, head.y - effect.vy * 0.08 * tail);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const ring = ctx.createRadialGradient(p.x, p.y, radius * 0.5, p.x, p.y, radius * 1.06);
    ring.addColorStop(0, rgba(effect.color, 0));
    ring.addColorStop(0.52, rgba(effect.color, 0.12 + alpha * 0.3));
    ring.addColorStop(0.68, rgba(effect.color, 0.22 + alpha * 0.5));
    ring.addColorStop(0.82, rgba(effect.color, 0.1 + alpha * 0.3));
    ring.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 1.06, 0, Math.PI * 2);
    ctx.fill();

    if (effect.kind === "pulse") {
      const ringCount = effect.ringCount || 12;
      const spacing = effect.ringSpacing || 60;
      for (let i = 0; i < ringCount; i += 1) {
        const radiusOffset = i * spacing;
        const ringRadius = Math.max(6, radius - radiusOffset);
        const ringAlpha = Math.max(0, alpha * (0.84 - i * 0.055));
        if (ringAlpha <= 0.01 || ringRadius <= 4) continue;
        ctx.strokeStyle = `rgba(134,229,255, ${ringAlpha})`;
        ctx.lineWidth = Math.max(0.9, (compact ? 1.7 : 2.2) - i * 0.06);
        ctx.beginPath();
        ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      continue;
    }

    if (effect.kind === "singularity") {
      const corePulse = Math.max(compact ? 7 : 8, radius * 0.14 + Math.sin(effect.age * (effect.pulseRate || 4.2)) * 4);
      const haloPulse = radius * (0.9 + Math.sin(effect.age * 2.8) * 0.03);
      ctx.fillStyle = `rgba(4, 6, 10, ${0.9 + alpha * 0.05})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, corePulse, 0, Math.PI * 2);
      ctx.fill();
      const singularityGlow = ctx.createRadialGradient(p.x, p.y, corePulse * 0.2, p.x, p.y, haloPulse);
      singularityGlow.addColorStop(0, rgba(effect.color, 0.28 + alpha * 0.2));
      singularityGlow.addColorStop(0.2, rgba(effect.color, 0.18 + alpha * 0.12));
      singularityGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = singularityGlow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(effect.color, 0.52 + alpha * 0.3);
      ctx.lineWidth = compact ? 1.3 : 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(14, radius * 0.28), 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    if (effect.kind === "nova") {
      const coreRadius = Math.max(compact ? 3.5 : 4, radius * 0.02);
      const ballRadius = Math.max(compact ? 15 : 18, radius * 0.08);
      const outerRadius = Math.max(ballRadius * 1.6, radius * 1.02);
      const ball = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, outerRadius);
      ball.addColorStop(0, "rgba(255,255,255,0.98)");
      ball.addColorStop(0.12, rgba(effect.color, 0.98 * alpha + 0.12));
      ball.addColorStop(0.28, rgba(effect.color, 0.72 * alpha + 0.08));
      ball.addColorStop(0.58, rgba(effect.color, 0.25 * alpha + 0.04));
      ball.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ball;
      ctx.beginPath();
      ctx.arc(p.x, p.y, outerRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.94 * alpha + 0.06})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, coreRadius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function renderEvents(state, ctx) {
  ctx.globalCompositeOperation = "lighter";
  for (const event of state.events) {
    const p = worldToScreen(state, event.x, event.y, event.z);
    const t = event.age / event.life;
    const alpha = 1 - t;

    if (event.kind === "birth") {
      const radius = 10 + t * 42;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      grad.addColorStop(0, `rgba(255,255,255,${0.85 * alpha})`);
      grad.addColorStop(0.35, `rgba(255,230,180,${0.45 * alpha})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (event.kind === "death") {
      const radius = 18 + t * 70;
      ctx.strokeStyle = `rgba(255,170,100,${0.75 * alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,210,${0.4 * alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    if (event.kind === "cluster") {
      const radius = 24 + Math.sin(t * Math.PI) * 26;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      grad.addColorStop(0, `rgba(134,229,255,${0.22 * alpha})`);
      grad.addColorStop(0.4, `rgba(134,229,255,${0.1 * alpha})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function renderSparks(state, ctx) {
  ctx.globalCompositeOperation = "lighter";
  for (const spark of state.sparks) {
    const p = worldToScreen(state, spark.x, spark.y, spark.z);
    const alpha = clamp(spark.life / 1.1, 0, 1);
    const size = spark.size * p.scale;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 9);
    glow.addColorStop(0, rgba(spark.color, alpha * 0.95));
    glow.addColorStop(0.25, rgba(spark.color, alpha * 0.4));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function renderVignette(state, ctx) {
  const vignette = ctx.createRadialGradient(
    state.width / 2,
    state.height / 2,
    Math.min(state.width, state.height) * 0.1,
    state.width / 2,
    state.height / 2,
    Math.max(state.width, state.height) * 0.72
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.8, "rgba(0,0,0,0.08)");
  vignette.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, state.width, state.height);
}
