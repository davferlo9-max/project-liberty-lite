import * as THREE from 'three';
import { CONFIG } from './config.js';
import { rand, distance2D, wrapAngle, pick } from './utils.js';

// Sistema de combate: enemigos con vida que persiguen y disparan al jugador,
// y disparo del jugador por raycast con efecto visual de trazador.
export class Combat {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.enemies = [];
    this.tracers = [];
    this.cooldown = 0;
    this.raycaster = new THREE.Raycaster();
    this.playerShots = 0;   // contador para que el audio detecte flancos
    this.enemyShots = 0;
  }

  spawnEnemy(x, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 1, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x8b1e1e })
    );
    body.position.y = 1;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0x3a1010 })
    );
    head.position.y = 1.85;
    group.add(head);
    group.position.set(x, 0, z);
    this.scene.add(group);

    const enemy = {
      mesh: group, health: CONFIG.combat.enemyHealth, alive: true,
      fireTimer: rand(0.5, 1.5), heading: 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  get aliveEnemies() { return this.enemies.filter((e) => e.alive); }

  // extraHittables: array de objetos con tryHitByRay(origin, dir, range) -> {killed, dist}
  // para que el disparo del jugador tambien alcance otras facciones (p.ej. policia).
  update(dt, player, camera, input, extraHittables = []) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this._extraHittables = extraHittables;
    this._lastKills = [];

    // Enemigos: perseguir + disparar en rango.
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const pos = e.mesh.position;
      const d = distance2D(pos.x, pos.z, player.position.x, player.position.z);
      const desired = Math.atan2(player.position.x - pos.x, player.position.z - pos.z);
      e.heading += wrapAngle(desired - e.heading) * Math.min(1, dt * 4);
      e.mesh.rotation.y = e.heading;

      if (d > 6) {
        const sp = 4;
        pos.x += Math.sin(e.heading) * sp * dt;
        pos.z += Math.cos(e.heading) * sp * dt;
      }
      if (d < CONFIG.combat.range) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = rand(1.2, 2.4);
          this.enemyShots++;
          if (player.alive && Math.random() < 0.6) player.damage(8);
          this._tracer(pos.clone().setY(1.4), player.position.clone().setY(1.4), 0xff6b6b);
        }
      }
    }

    // Disparo del jugador (solo a pie).
    const wantFire = input.mouseDown || input.isDown('Space');
    if (wantFire && !player.inVehicle && player.alive && this.cooldown === 0) {
      this.cooldown = CONFIG.combat.fireCooldown;
      this.playerShots++;
      this._playerShoot(player, camera);
    }

    this._updateTracers(dt);
  }

  _playerShoot(player, camera) {
    const origin = player.position.clone().setY(1.5);
    const dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));

    let hit = null, hitDist = Infinity;
    for (const e of this.aliveEnemies) {
      const to = e.mesh.position.clone().setY(1.2).sub(origin);
      const along = to.dot(dir);
      if (along < 0 || along > CONFIG.combat.range) continue;
      const perp = to.clone().sub(dir.clone().multiplyScalar(along)).length();
      if (perp < 0.9 && along < hitDist) { hit = e; hitDist = along; }
    }

    // Comprueba tambien facciones externas (policia). Nos quedamos con el
    // impacto mas cercano entre enemigos de mision y objetivos externos.
    let extraDist = Infinity;
    for (const faction of this._extraHittables || []) {
      const res = faction.tryHitByRay(origin, dir, CONFIG.combat.range);
      if (res.dist != null && res.dist < extraDist) extraDist = res.dist;
      if (res.killed) this._lastKills.push(faction);
    }

    const nearest = Math.min(hit ? hitDist : Infinity, extraDist, CONFIG.combat.range);
    const end = origin.clone().add(dir.clone().multiplyScalar(nearest));
    this._tracer(origin, end, 0xffd23f);

    // Solo aplica dano al enemigo de mision si estaba mas cerca que el externo.
    if (hit && hitDist <= extraDist) {
      hit.health -= CONFIG.combat.damage;
      if (hit.health <= 0) { hit.alive = false; this.scene.remove(hit.mesh); }
    }
  }

  // Facciones externas cuyas unidades murieron por el ultimo disparo del jugador.
  consumeKills() {
    const k = this._lastKills || [];
    this._lastKills = [];
    return k;
  }

  _tracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  _updateTracers(dt) {
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => {
      if (t.life <= 0) { this.scene.remove(t.line); return false; }
      return true;
    });
  }

  clear() {
    for (const e of this.enemies) if (e.alive) this.scene.remove(e.mesh);
    this.enemies = [];
  }
}
