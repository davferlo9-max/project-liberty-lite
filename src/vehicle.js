import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';
import { clamp } from './utils.js';

// Vehiculo con fisica de cuerpo rigido (Cannon-es). Modelo "arcade":
// fuerza hacia delante segun input y giro proporcional a la velocidad.
// Soporta varios tipos (deportivo, sedan, camion, furgoneta, moto) con
// dimensiones, masa, potencia y manejo propios.
export class Vehicle {
  constructor(scene, world, x = 6, z = 6, color = 0xd83b3b, type = 'sedan') {
    this.scene = scene;
    this.world = world;
    this.occupied = false;
    this.type = type;
    this.spec = CONFIG.vehicleTypes[type] || CONFIG.vehicleTypes.sedan;

    const { w, h, d } = this.spec;
    this.mesh = this._buildBody(type, w, h, d, color);
    scene.add(this.mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
    this.body = new CANNON.Body({
      mass: this.spec.mass,
      shape,
      position: new CANNON.Vec3(x, 1.2, z),
      linearDamping: 0.4,
      angularDamping: 0.8,
    });
    world.addBody(this.body);
  }

  // Construye la carroceria distintiva de cada tipo.
  _buildBody(type, w, h, d, color) {
    const group = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color });
    const glass = new THREE.MeshLambertMaterial({ color: 0x1a1d24 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x111317 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint);
    chassis.position.y = 0.1;
    chassis.castShadow = true;
    group.add(chassis);

    if (type === 'motorcycle') {
      // Asiento + manillar; ruedas grandes delante/detras.
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 1.2), glass);
      seat.position.set(0, 0.55, 0);
      group.add(seat);
      this._wheel(group, 0, -0.1, d / 2 - 0.2, 0.5);
      this._wheel(group, 0, -0.1, -d / 2 + 0.2, 0.5);
    } else if (type === 'truck') {
      // Cabina delantera + caja de carga.
      const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, h * 0.5, d * 0.3), glass);
      cab.position.set(0, h * 0.75, d * 0.3);
      group.add(cab);
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, h * 0.9, d * 0.6), dark);
      cargo.position.set(0, h * 0.55, -d * 0.18);
      group.add(cargo);
      this._wheelSet(group, w, d, 0.6);
    } else if (type === 'van') {
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.75, d * 0.75), glass);
      cabin.position.set(0, h * 0.7, -0.1);
      group.add(cabin);
      this._wheelSet(group, w, d, 0.45);
    } else {
      // Deportivo / sedan: cabina acristalada.
      const cabinLen = type === 'sport' ? 0.4 : 0.45;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, h * 0.7, d * cabinLen), glass);
      cabin.position.set(0, h * 0.75, -0.2);
      group.add(cabin);
      this._wheelSet(group, w, d, 0.4);
    }

    return group;
  }

  _wheelSet(group, w, d, r) {
    const off = w / 2 - 0.1;
    const fz = d / 2 - 0.6, bz = -d / 2 + 0.6;
    this._wheel(group, -off, -0.1, fz, r);
    this._wheel(group, off, -0.1, fz, r);
    this._wheel(group, -off, -0.1, bz, r);
    this._wheel(group, off, -0.1, bz, r);
  }

  _wheel(group, x, y, z, r) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.3, 12),
      new THREE.MeshLambertMaterial({ color: 0x0a0a0a })
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
  }

  get speedKmh() {
    const v = this.body.velocity;
    return Math.round(Math.hypot(v.x, v.z) * 3.6);
  }

  get typeLabel() { return this.spec.label; }

  update(dt, input) {
    this.syncMesh();
    if (!this.occupied) return;

    let throttle = 0, steer = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) throttle += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) throttle -= 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) steer += 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) steer -= 1;

    // Direccion "hacia delante" del vehiculo en espacio mundo.
    const q = this.body.quaternion;
    const forward = new CANNON.Vec3(0, 0, -1);
    q.vmult(forward, forward);

    // Fuerza de motor segun la potencia del tipo.
    const power = this.spec.power * throttle;
    this.body.applyForce(forward.scale(power), this.body.position);

    // Giro: proporcional a la velocidad, con la agilidad del tipo.
    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
    const steerStrength = clamp(speed / 6, 0, 1) * this.spec.steer;
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

  get heading() {
    const forward = new CANNON.Vec3(0, 0, -1);
    this.body.quaternion.vmult(forward, forward);
    return Math.atan2(forward.x, forward.z);
  }
}
