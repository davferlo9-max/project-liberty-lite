import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp } from './utils.js';
import { buildCharacter, CHARACTER_PRESETS } from './characters.js';
import { buildPistol } from './weapon.js';

// Jugador a pie. Movimiento cinematico (sin fisica rigida: mas controlable).
// Usa un avatar articulado (characters.js) con arma equipada en la mano.
export class Player {
  constructor(scene, presetKey = 'MATEO') {
    this.scene = scene;
    this.health = CONFIG.player.maxHealth;
    this.heading = 0;        // orientacion horizontal (rad)
    this.position = new THREE.Vector3(0, 0, 0);
    this.inVehicle = null;
    this.alive = true;
    this.walkPhase = 0;
    this.aiming = false;

    this.presetKey = presetKey;
    this._buildAvatar(presetKey);
  }

  _buildAvatar(presetKey) {
    if (this.mesh) this.scene.remove(this.mesh);
    const preset = CHARACTER_PRESETS[presetKey] || CHARACTER_PRESETS.MATEO;
    const { group, parts } = buildCharacter(preset);
    this.mesh = group;
    this.parts = parts;
    this.presetName = preset.name;

    // Arma equipada en la mano derecha.
    this.weapon = buildPistol();
    this.weapon.position.set(0, -0.82, 0.1);
    this.parts.shoulderR.add(this.weapon);

    this.scene.add(this.mesh);
    this.mesh.position.copy(this.position);
  }

  // Cambia de personaje (Mateo <-> Lucia) conservando posicion y estado.
  switchCharacter(presetKey) {
    if (presetKey === this.presetKey) return;
    this.presetKey = presetKey;
    const visible = this.mesh.visible;
    this._buildAvatar(presetKey);
    this.mesh.visible = visible;
    this.mesh.rotation.y = this.heading;
  }

  setVisible(v) { this.mesh.visible = v; }

  update(dt, input) {
    if (this.inVehicle || !this.alive) return;

    // El raton rota la orientacion del jugador.
    this.heading -= input.consumeMouseDX() * 0.0025;

    const running = input.isDown('ShiftLeft');
    const speed = running ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
    let fwd = 0, strafe = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) fwd += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) fwd -= 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) strafe -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) strafe += 1;

    const moving = fwd !== 0 || strafe !== 0;
    const sin = Math.sin(this.heading), cos = Math.cos(this.heading);
    const dx = (sin * fwd + cos * strafe) * speed * dt;
    const dz = (cos * fwd - sin * strafe) * speed * dt;
    this.position.x += dx;
    this.position.z += dz;

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;

    this._animate(dt, moving, speed);
  }

  // Animacion procedural: balanceo de piernas/brazos al caminar y pose de
  // apuntado (brazo derecho adelante) al disparar.
  _animate(dt, moving, speed) {
    const { legL, legR, shoulderL, shoulderR } = this.parts;
    if (moving) {
      this.walkPhase += dt * speed * 0.9;
    } else {
      this.walkPhase *= 0.85;
    }
    const swing = Math.sin(this.walkPhase) * 0.5;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    shoulderL.rotation.x = -swing * 0.6;

    // Brazo derecho: si apunta, lo extiende al frente; si no, balanceo normal.
    const aimPose = this.aiming ? -Math.PI / 2 : swing * 0.6;
    shoulderR.rotation.x += (aimPose - shoulderR.rotation.x) * Math.min(1, dt * 12);
  }

  // Posicion mundial de la boca del canon, para el fogonazo.
  getMuzzleWorldPos() {
    const v = new THREE.Vector3(0, -0.82, 0.55);
    this.parts.shoulderR.localToWorld(v);
    return v;
  }

  damage(amount) {
    if (!this.alive) return;
    this.health = clamp(this.health - amount, 0, CONFIG.player.maxHealth);
    if (this.health <= 0) { this.alive = false; }
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, CONFIG.player.maxHealth);
  }

  teleport(x, z) {
    this.position.set(x, 0, z);
    this.mesh.position.copy(this.position);
  }
}
