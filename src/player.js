import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp } from './utils.js';

// Jugador a pie. Movimiento cinematico (sin fisica rigida: mas controlable).
export class Player {
  constructor(scene) {
    this.scene = scene;
    this.health = CONFIG.player.maxHealth;
    this.heading = 0;        // orientacion horizontal (rad)
    this.position = new THREE.Vector3(0, 0, 0);
    this.inVehicle = null;
    this.alive = true;

    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2f7fd1 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1, 4, 8), bodyMat);
    torso.position.y = 1;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshLambertMaterial({ color: 0xe0b48a })
    );
    head.position.y = 1.85;
    group.add(head);
    // Marcador frontal (para ver hacia donde mira).
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xffd23f })
    );
    nose.position.set(0, 1.85, 0.3);
    group.add(nose);

    this.mesh = group;
    scene.add(group);
  }

  setVisible(v) { this.mesh.visible = v; }

  update(dt, input) {
    if (this.inVehicle || !this.alive) return;

    // El raton rota la orientacion del jugador.
    this.heading -= input.consumeMouseDX() * 0.0025;

    const speed = input.isDown('ShiftLeft') ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
    let fwd = 0, strafe = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) fwd += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) fwd -= 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) strafe -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) strafe += 1;

    const sin = Math.sin(this.heading), cos = Math.cos(this.heading);
    const dx = (sin * fwd + cos * strafe) * speed * dt;
    const dz = (cos * fwd - sin * strafe) * speed * dt;
    this.position.x += dx;
    this.position.z += dz;

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
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
