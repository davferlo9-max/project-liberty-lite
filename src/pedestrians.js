import * as THREE from 'three';
import { CONFIG } from './config.js';
import { rand, pick, distance2D, wrapAngle } from './utils.js';

// Peatones: caminan hacia un destino aleatorio; huyen si hay peligro cerca
// (disparos o un vehiculo a gran velocidad).
export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.list = [];
    for (let i = 0; i < CONFIG.pedestrians.count; i++) this._spawn();
  }

  _spawn() {
    const node = this.city.randomRoadPoint();
    const color = pick([0xd1d5db, 0xb08968, 0x9a8c98, 0xe09f3e, 0x6d6875]);
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.9, 4, 6),
      new THREE.MeshLambertMaterial({ color })
    );
    body.position.y = 0.85;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xe0b48a })
    );
    head.position.y = 1.6;
    group.add(head);
    group.position.set(node.x + rand(-3, 3), 0, node.z + rand(-3, 3));
    this.scene.add(group);

    this.list.push({
      mesh: group,
      target: this.city.randomRoadPoint(),
      heading: rand(-Math.PI, Math.PI),
      fleeing: false,
      alive: true,
      phase: rand(0, Math.PI * 2),
    });
  }

  // threat: {x, z, radius} opcional -> los peatones cercanos huyen.
  update(dt, threat) {
    for (const p of this.list) {
      if (!p.alive) continue;
      const pos = p.mesh.position;

      p.fleeing = false;
      if (threat) {
        const d = distance2D(pos.x, pos.z, threat.x, threat.z);
        if (d < threat.radius) p.fleeing = true;
      }

      let tx, tz, speed;
      if (p.fleeing) {
        tx = pos.x + (pos.x - threat.x);
        tz = pos.z + (pos.z - threat.z);
        speed = CONFIG.pedestrians.speed * 2.4;
      } else {
        tx = p.target.x; tz = p.target.z;
        speed = CONFIG.pedestrians.speed;
        if (distance2D(pos.x, pos.z, tx, tz) < 2) p.target = this.city.randomRoadPoint();
      }

      const desired = Math.atan2(tx - pos.x, tz - pos.z);
      p.heading += wrapAngle(desired - p.heading) * Math.min(1, dt * 5);
      pos.x += Math.sin(p.heading) * speed * dt;
      pos.z += Math.cos(p.heading) * speed * dt;
      p.mesh.rotation.y = p.heading;

      // Pequeno balanceo al caminar.
      p.phase += dt * speed;
      p.mesh.position.y = Math.abs(Math.sin(p.phase)) * 0.06;
    }
  }

  // Elimina un peaton por impacto; devuelve true si acerto.
  hitAt(x, z, radius = 1.2) {
    for (const p of this.list) {
      if (!p.alive) continue;
      if (distance2D(p.mesh.position.x, p.mesh.position.z, x, z) < radius) {
        p.alive = false;
        this.scene.remove(p.mesh);
        return true;
      }
    }
    return false;
  }
}
