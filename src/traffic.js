import * as THREE from 'three';
import { CONFIG } from './config.js';
import { rand, pick, distance2D, wrapAngle } from './utils.js';

// Trafico IA: coches que recorren la red de carriles saltando de nodo a nodo.
// Movimiento cinematico (barato) con frenado si hay obstaculo delante.
export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.list = [];
    for (let i = 0; i < CONFIG.traffic.count; i++) this._spawn();
  }

  _spawn() {
    const node = this.city.randomRoadPoint();
    const color = pick([0x4361ee, 0x2a9d8f, 0xe76f51, 0x8d99ae, 0xf4a261, 0x457b9d]);
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 4),
      new THREE.MeshLambertMaterial({ color })
    );
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.7, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x1a1d24 })
    );
    cabin.position.set(0, 1.25, -0.2);
    group.add(cabin);
    group.position.set(node.x, 0, node.z);
    this.scene.add(group);

    this.list.push({
      mesh: group,
      target: this.city.randomRoadPoint(),
      heading: rand(-Math.PI, Math.PI),
      speed: CONFIG.traffic.speed * rand(0.8, 1.2),
      alive: true,
    });
  }

  update(dt, avoidList = []) {
    for (const c of this.list) {
      if (!c.alive) continue;
      const pos = c.mesh.position;

      if (distance2D(pos.x, pos.z, c.target.x, c.target.z) < 3) {
        c.target = this.city.randomRoadPoint();
      }

      // Frenado si hay algo justo delante (jugador, vehiculo, otro coche).
      const fx = pos.x + Math.sin(c.heading) * 5;
      const fz = pos.z + Math.cos(c.heading) * 5;
      let blocked = false;
      for (const a of avoidList) {
        if (a && distance2D(fx, fz, a.x, a.z) < 3.5) { blocked = true; break; }
      }

      const desired = Math.atan2(c.target.x - pos.x, c.target.z - pos.z);
      c.heading += wrapAngle(desired - c.heading) * Math.min(1, dt * 2.5);
      const v = blocked ? 0 : c.speed;
      pos.x += Math.sin(c.heading) * v * dt;
      pos.z += Math.cos(c.heading) * v * dt;
      c.mesh.rotation.y = c.heading;
    }
  }

  positions() {
    return this.list.filter((c) => c.alive).map((c) => c.mesh.position);
  }

  hitAt(x, z, radius = 2) {
    for (const c of this.list) {
      if (!c.alive) continue;
      if (distance2D(c.mesh.position.x, c.mesh.position.z, x, z) < radius) {
        c.alive = false;
        this.scene.remove(c.mesh);
        return true;
      }
    }
    return false;
  }
}
