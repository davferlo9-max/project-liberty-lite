import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';
import { clamp } from './utils.js';

// Vehiculo con fisica de cuerpo rigido (Cannon-es). Modelo "arcade":
// fuerza hacia delante segun input y giro proporcional a la velocidad.
export class Vehicle {
  constructor(scene, world, x = 6, z = 6, color = 0xd83b3b) {
    this.scene = scene;
    this.world = world;
    this.occupied = false;

    const w = 2, h = 1, d = 4;
    const group = new THREE.Group();
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color })
    );
    bodyMesh.position.y = 0.1;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);
    // cabina
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.85, h * 0.7, d * 0.45),
      new THREE.MeshLambertMaterial({ color: 0x1a1d24 })
    );
    cabin.position.set(0, 0.8, -0.2);
    group.add(cabin);
    this.mesh = group;
    scene.add(group);

    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
    this.body = new CANNON.Body({
      mass: CONFIG.vehicle.mass,
      shape,
      position: new CANNON.Vec3(x, 1, z),
      linearDamping: 0.4,
      angularDamping: 0.8,
    });
    world.addBody(this.body);
  }

  get speedKmh() {
    const v = this.body.velocity;
    return Math.round(Math.hypot(v.x, v.z) * 3.6);
  }

  update(dt, input) {
    this.syncMesh();
    if (!this.occupied) return;

    let throttle = 0, steer = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) throttle += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) throttle -= 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) steer += 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) steer -= 1;

    // Direccion "hacia delante" del coche en espacio mundo.
    const q = this.body.quaternion;
    const forward = new CANNON.Vec3(0, 0, -1);
    q.vmult(forward, forward);

    // Fuerza de motor.
    const power = CONFIG.vehicle.enginePower * throttle;
    this.body.applyForce(forward.scale(power), this.body.position);

    // Giro: proporcional a la velocidad para que no rote parado.
    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
    const steerStrength = clamp(speed / 6, 0, 1) * CONFIG.vehicle.maxSteer;
    this.body.angularVelocity.y = steer * steerStrength * 3;

    // Freno/reversa suave al soltar acelerador.
    if (throttle === 0) {
      this.body.velocity.x *= 0.98;
      this.body.velocity.z *= 0.98;
    }
  }

  syncMesh() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  enter() { this.occupied = true; }
  exit() { this.occupied = false; }

  get position() { return this.body.position; }

  // Orientacion horizontal actual (rad), util para colocar al jugador al salir.
  get heading() {
    const forward = new CANNON.Vec3(0, 0, -1);
    this.body.quaternion.vmult(forward, forward);
    return Math.atan2(forward.x, forward.z);
  }
}
