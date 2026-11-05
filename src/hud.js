import { CONFIG } from './config.js';
import { clamp } from './utils.js';

// Capa de interfaz: salud, nivel de busqueda, mision, velocimetro y minimapa.
export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.healthFill = document.getElementById('health-fill');
    this.wanted = document.getElementById('wanted');
    this.missionTitle = document.getElementById('mission-title');
    this.missionObjective = document.getElementById('mission-objective');
    this.modeIndicator = document.getElementById('mode-indicator');
    this.speedo = document.getElementById('speedo');
    this.crosshair = document.getElementById('crosshair');
    this.message = document.getElementById('message');
    this.minimap = document.getElementById('minimap');
    this.mmCtx = this.minimap.getContext('2d');
    this._msgTimer = 0;
  }

  show() {
    document.getElementById('loading')?.classList.add('hidden');
    this.root.classList.remove('hidden');
  }

  flash(text, ms = 1800) {
    this.message.textContent = text;
    this.message.classList.add('show');
    this._msgTimer = ms / 1000;
  }

  update(dt, state) {
    // Salud.
    const hpPct = (state.health / CONFIG.player.maxHealth) * 100;
    this.healthFill.style.width = `${clamp(hpPct, 0, 100)}%`;
    this.healthFill.style.background = hpPct < 30 ? 'var(--danger)' : 'var(--health)';

    // Buscado.
    const stars = Math.round(state.wanted);
    this.wanted.textContent = '★'.repeat(stars) + '☆'.repeat(CONFIG.wanted.maxStars - stars);

    // Mision.
    this.missionTitle.textContent = state.missionTitle;
    this.missionObjective.textContent = state.objective;

    // Modo / velocimetro / crosshair.
    if (state.inVehicle) {
      this.modeIndicator.textContent = 'CONDUCIENDO';
      this.speedo.classList.remove('hidden');
      this.speedo.textContent = `${state.speed} km/h`;
      this.crosshair.classList.add('hidden');
    } else {
      this.modeIndicator.textContent = 'A PIE';
      this.speedo.classList.add('hidden');
      this.crosshair.classList.remove('hidden');
    }

    // Mensaje temporal.
    if (this._msgTimer > 0) {
      this._msgTimer -= dt;
      if (this._msgTimer <= 0) this.message.classList.remove('show');
    }

    this._drawMinimap(state);
  }

  _drawMinimap(state) {
    const ctx = this.mmCtx;
    const size = this.minimap.width;
    const scale = size / (state.worldExtent * 2);
    const cx = size / 2, cy = size / 2;
    const toMap = (wx, wz) => [cx + wx * scale, cy + wz * scale];

    ctx.clearRect(0, 0, size, size);

    // Trafico.
    ctx.fillStyle = '#6d8bd1';
    for (const p of state.traffic) {
      const [x, y] = toMap(p.x - state.player.x, p.z - state.player.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Enemigos.
    ctx.fillStyle = '#ff3b3b';
    for (const e of state.enemies) {
      const [x, y] = toMap(e.x - state.player.x, e.z - state.player.z);
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Policia.
    ctx.fillStyle = '#2f6bff';
    for (const u of state.police || []) {
      const [x, y] = toMap(u.x - state.player.x, u.z - state.player.z);
      ctx.beginPath(); ctx.arc(x, y, 2.8, 0, Math.PI * 2); ctx.fill();
    }
    // Objetivo de mision.
    if (state.marker) {
      const [x, y] = toMap(state.marker.x - state.player.x, state.marker.z - state.player.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Jugador (centro).
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
}
