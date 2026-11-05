import * as THREE from 'three';
import { distance2D } from './utils.js';

// Sistema de misiones por fases. Cada mision es una secuencia de objetivos
// que el jugador completa en orden. El HUD lee el objetivo activo.
export class MissionSystem {
  constructor(scene, ctx) {
    this.scene = scene;
    this.ctx = ctx;            // { player, combat, city, hud }
    this.missions = this._defineMissions();
    this.index = 0;
    this.stepIndex = 0;
    this.marker = this._makeMarker();
    this.done = false;
    this.completedCount = 0;   // para que el audio detecte flancos
  }

  _makeMarker() {
    const geo = new THREE.CylinderGeometry(2, 2, 16, 20, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd23f, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = 8;
    m.visible = false;
    this.scene.add(m);
    return m;
  }

  _defineMissions() {
    const c = this.ctx.city;
    const p1 = c.randomRoadPoint();
    const p2 = c.randomRoadPoint();
    const p3 = c.randomRoadPoint();
    return [
      {
        title: 'MISIÓN 1 — PRIMER CONTACTO',
        steps: [
          { kind: 'goto', text: 'Dirígete al punto marcado', at: p1, radius: 5 },
          { kind: 'goto', text: 'Sube a un vehículo y conduce al garaje', at: p2, radius: 6, requireVehicle: true },
        ],
      },
      {
        title: 'MISIÓN 2 — AJUSTE DE CUENTAS',
        steps: [
          { kind: 'goto', text: 'Ve al callejón del encuentro', at: p3, radius: 5 },
          { kind: 'eliminate', text: 'Elimina a los 3 objetivos', count: 3, spawnAround: p3 },
          { kind: 'goto', text: 'Escapa al punto de extracción', at: p1, radius: 6 },
        ],
      },
    ];
  }

  get current() { return this.missions[this.index]; }
  get step() { return this.current?.steps[this.stepIndex]; }

  start() { this._enterStep(); }

  _enterStep() {
    const step = this.step;
    if (!step) return;
    if (step.at) {
      this.marker.position.set(step.at.x, 8, step.at.z);
      this.marker.visible = true;
    } else {
      this.marker.visible = false;
    }
    if (step.kind === 'eliminate') {
      this._spawned = [];
      const r = 12;
      for (let i = 0; i < step.count; i++) {
        const ang = (i / step.count) * Math.PI * 2;
        const x = step.spawnAround.x + Math.cos(ang) * r;
        const z = step.spawnAround.z + Math.sin(ang) * r;
        this._spawned.push(this.ctx.combat.spawnEnemy(x, z));
      }
    }
    this.ctx.hud.flash(step.text);
  }

  update(dt) {
    if (this.done) return;
    const step = this.step;
    if (!step) return;
    const player = this.ctx.player;

    let complete = false;
    if (step.kind === 'goto') {
      const px = player.inVehicle ? player.inVehicle.position.x : player.position.x;
      const pz = player.inVehicle ? player.inVehicle.position.z : player.position.z;
      const near = distance2D(px, pz, step.at.x, step.at.z) < step.radius;
      const vehicleOk = !step.requireVehicle || !!player.inVehicle;
      complete = near && vehicleOk;
    } else if (step.kind === 'eliminate') {
      complete = this._spawned.every((e) => !e.alive);
    }

    if (complete) this._advance();

    // Animacion del marcador.
    if (this.marker.visible) this.marker.rotation.y += dt * 1.5;
  }

  _advance() {
    this.stepIndex++;
    if (this.stepIndex >= this.current.steps.length) {
      this.ctx.hud.flash(`✓ ${this.current.title} COMPLETADA`, 2500);
      this.completedCount++;
      this.index++;
      this.stepIndex = 0;
      if (this.index >= this.missions.length) {
        this.done = true;
        this.marker.visible = false;
        this.ctx.hud.flash('★ TODAS LAS MISIONES COMPLETADAS ★', 5000);
        return;
      }
    }
    this._enterStep();
  }

  restart() {
    this.ctx.combat.clear();
    this.index = 0;
    this.stepIndex = 0;
    this.done = false;
    this._enterStep();
  }

  get objectiveText() {
    if (this.done) return 'Ciudad libre. Buen trabajo.';
    return this.step?.text ?? '—';
  }

  get titleText() {
    if (this.done) return 'LIBERTY-LITE';
    return this.current?.title ?? '—';
  }

  get markerPos() {
    return this.marker.visible ? this.marker.position : null;
  }
}
