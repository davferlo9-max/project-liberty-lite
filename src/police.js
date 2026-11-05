import * as THREE from 'three';
import { CONFIG } from './config.js';
import { rand, distance2D, wrapAngle } from './utils.js';

// Faccion policial. Reacciona al nivel de "buscado": aparecen unidades a pie
// (y coches patrulla en niveles altos) que persiguen y disparan al jugador.
// Maquina de estados simple por unidad: CHASE -> ATTACK.
export class Police {
  constructor(scene, city, combat) {
    this.scene = scene;
    this.city = city;
    this.combat = combat;       // reutilizamos sus trazadores de disparo
    this.units = [];
    this.spawnTimer = 0;
    this.heli = null;           // una sola unidad aerea a la vez
    this.sirenPhase = 0;        // reloj para el parpadeo de luces
    this.shotsFired = 0;        // contador para que el audio detecte flancos
  }

  get aliveUnits() { return this.units.filter((u) => u.alive); }

  // Crea el helicoptero policial (unidad aerea). Vuela alto, no colisiona.
  _spawnHeli(player) {
    const group = new THREE.Group();
    // Fuselaje.
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.9, 2.4, 6, 10),
      new THREE.MeshLambertMaterial({ color: 0x14203a })
    );
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    group.add(body);
    // Cola.
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.3, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x14203a })
    );
    tail.position.set(-2.4, 0.2, 0);
    group.add(tail);
    // Patines.
    const skidMat = new THREE.MeshLambertMaterial({ color: 0x0a0f1c });
    for (const sx of [-0.6, 0.6]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.1), skidMat);
      skid.position.set(0, -0.9, sx);
      group.add(skid);
    }
    // Rotor principal (gira).
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.08, 7),
      new THREE.MeshLambertMaterial({ color: 0x2b2b2b })
    );
    rotor.position.y = 1.1;
    group.add(rotor);
    // Reflector / luz.
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffef9f })
    );
    light.position.set(1.4, -0.5, 0);
    group.add(light);

    const ang = rand(0, Math.PI * 2);
    group.position.set(
      player.position.x + Math.cos(ang) * 40,
      CONFIG.police.heliAltitude,
      player.position.z + Math.sin(ang) * 40
    );
    this.scene.add(group);

    this.heli = {
      mesh: group, rotor, light,
      health: CONFIG.police.heliHealth, alive: true,
      heading: 0, fireTimer: rand(1, 2), isHeli: true,
    };
    return this.heli;
  }

  _updateHeli(dt, player) {
    const h = this.heli;
    if (!h || !h.alive) return;
    const pos = h.mesh.position;

    // Rotor en movimiento.
    h.rotor.rotation.y += dt * 30;

    // Persigue manteniendo altitud y un ligero orbitado sobre el jugador.
    const targetX = player.position.x;
    const targetZ = player.position.z;
    const desired = Math.atan2(targetX - pos.x, targetZ - pos.z);
    h.heading += wrapAngle(desired - h.heading) * Math.min(1, dt * 1.5);
    h.mesh.rotation.y = h.heading;

    const d = distance2D(pos.x, pos.z, targetX, targetZ);
    if (d > 14) {
      pos.x += Math.sin(h.heading) * CONFIG.police.heliSpeed * dt;
      pos.z += Math.cos(h.heading) * CONFIG.police.heliSpeed * dt;
    }
    pos.y += (CONFIG.police.heliAltitude - pos.y) * Math.min(1, dt * 2);

    // Dispara hacia abajo al jugador.
    if (d < CONFIG.police.heliFireRange) {
      h.fireTimer -= dt;
      if (h.fireTimer <= 0) {
        h.fireTimer = rand(0.5, 1.2);
        this.shotsFired++;
        if (player.alive && Math.random() < 0.5) player.damage(CONFIG.police.heliDamage);
        this.combat._tracer(
          pos.clone(),
          player.position.clone().setY(1.4),
          0xffef9f
        );
      }
    }
  }

  // Crea una unidad a pie cerca del jugador pero fuera de su vista inmediata.
  _spawnOfficer(player, asCar) {
    const ang = rand(0, Math.PI * 2);
    const dist = rand(35, 55);
    const px = player.position.x + Math.cos(ang) * dist;
    const pz = player.position.z + Math.sin(ang) * dist;

    let sirenMatL = null, sirenMatR = null;
    const group = new THREE.Group();
    if (asCar) {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2, 1, 4),
        new THREE.MeshLambertMaterial({ color: 0x1b2a4a })
      );
      body.position.y = 0.6; body.castShadow = true; group.add(body);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.7, 1.8),
        new THREE.MeshLambertMaterial({ color: 0xe8edf5 })
      );
      cabin.position.set(0, 1.25, -0.2); group.add(cabin);
      // Barra de luces (dos focos que alternan: sirena visual).
      sirenMatL = new THREE.MeshBasicMaterial({ color: 0x2f6bff });
      sirenMatR = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
      const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.4), sirenMatL);
      const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.4), sirenMatR);
      lightL.position.set(-0.32, 1.7, -0.2);
      lightR.position.set(0.32, 1.7, -0.2);
      group.add(lightL); group.add(lightR);
    } else {
      const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.4, 1, 4, 8),
        new THREE.MeshLambertMaterial({ color: 0x1b3a6b })
      );
      torso.position.y = 1; torso.castShadow = true; group.add(torso);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 10),
        new THREE.MeshLambertMaterial({ color: 0xe0b48a })
      );
      head.position.y = 1.85; group.add(head);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.18, 10),
        new THREE.MeshLambertMaterial({ color: 0x0f2446 })
      );
      cap.position.y = 2.05; group.add(cap);
    }
    group.position.set(px, 0, pz);
    this.scene.add(group);

    const unit = {
      mesh: group,
      isCar: asCar,
      health: CONFIG.police.health * (asCar ? 2.5 : 1),
      alive: true,
      heading: 0,
      fireTimer: rand(0.6, 1.6),
      sirenMatL, sirenMatR,
    };
    this.units.push(unit);
    return unit;
  }

  // wanted: nivel actual (0..maxStars). Las unidades aparecen/persiguen/disparan
  // segun el nivel. Las muertes por disparo del jugador se resuelven en combat
  // (tryHitByRay) y los atropellos en hitAt; main sube las estrellas.
  update(dt, player, wanted) {
    const stars = Math.round(wanted);

    // --- Aparicion escalonada segun presupuesto del nivel ---
    const budget = CONFIG.police.unitsByStar[stars] ?? 0;
    this.spawnTimer -= dt;
    if (stars > 0 && this.aliveUnits.length < budget && this.spawnTimer <= 0) {
      this.spawnTimer = CONFIG.police.spawnInterval;
      const asCar = stars >= CONFIG.police.carFromStar && Math.random() < 0.5;
      this._spawnOfficer(player, asCar);
    }

    // --- Helicoptero: aparece en niveles altos, uno solo a la vez ---
    if (stars >= CONFIG.police.heliFromStar && (!this.heli || !this.heli.alive)) {
      this._spawnHeli(player);
    }
    this._updateHeli(dt, player);

    // --- Sirenas: parpadeo alterno de luces en coches patrulla ---
    this.sirenPhase += dt * CONFIG.police.sirenHz * Math.PI * 2;
    const on = Math.sin(this.sirenPhase) > 0;
    for (const u of this.units) {
      if (!u.alive || !u.isCar || !u.sirenMatL) continue;
      u.sirenMatL.color.setHex(on ? 0x2f6bff : 0x0a1838);
      u.sirenMatR.color.setHex(on ? 0x1a1030 : 0xff3b3b);
    }

    // --- Si ya no hay busqueda, las unidades se retiran ---
    if (stars === 0) { this.clear(); return; }

    // --- IA por unidad ---
    for (const u of this.units) {
      if (!u.alive) continue;
      const pos = u.mesh.position;
      const d = distance2D(pos.x, pos.z, player.position.x, player.position.z);
      const desired = Math.atan2(player.position.x - pos.x, player.position.z - pos.z);
      u.heading += wrapAngle(desired - u.heading) * Math.min(1, dt * (u.isCar ? 2.5 : 4));
      u.mesh.rotation.y = u.heading;

      const stop = u.isCar ? 6 : 9;
      const speed = u.isCar ? CONFIG.police.speedCar : CONFIG.police.speedFoot;
      if (d > stop) {
        pos.x += Math.sin(u.heading) * speed * dt;
        pos.z += Math.cos(u.heading) * speed * dt;
      }

      // ATTACK: dispara si esta en rango y encarado.
      if (d < CONFIG.police.fireRange) {
        u.fireTimer -= dt;
        if (u.fireTimer <= 0) {
          u.fireTimer = rand(1.0, 2.2);
          this.shotsFired++;
          if (player.alive && Math.random() < 0.65) player.damage(CONFIG.police.damage);
          this.combat._tracer(
            pos.clone().setY(1.4),
            player.position.clone().setY(1.4),
            0x6b9bff
          );
        }
      }
    }
  }

  // Disparo del jugador contra la policia (llamado desde main tras el raycast).
  // Devuelve true si una unidad muere, para subir estrellas.
  tryHitByRay(origin, dir, range) {
    let hit = null, hitDist = Infinity;
    const candidates = [...this.aliveUnits];
    if (this.heli && this.heli.alive) candidates.push(this.heli);

    for (const u of candidates) {
      const aim = u.isHeli ? u.mesh.position.clone() : u.mesh.position.clone().setY(1.2);
      const to = aim.sub(origin);
      const along = to.dot(dir);
      if (along < 0 || along > range) continue;
      const perp = to.clone().sub(dir.clone().multiplyScalar(along)).length();
      const hitRadius = u.isHeli ? 2.5 : (u.isCar ? 1.6 : 0.9);
      if (perp < hitRadius && along < hitDist) { hit = u; hitDist = along; }
    }
    if (!hit) return { killed: false, dist: null };

    hit.health -= CONFIG.combat.damage;
    const killed = hit.health <= 0;
    if (killed) { hit.alive = false; this.scene.remove(hit.mesh); }
    return { killed, dist: hitDist };
  }

  // Atropello: el jugador en coche embiste a un policia.
  hitAt(x, z, radius = 2) {
    for (const u of this.units) {
      if (!u.alive) continue;
      if (distance2D(u.mesh.position.x, u.mesh.position.z, x, z) < radius) {
        u.alive = false;
        this.scene.remove(u.mesh);
        return true;
      }
    }
    return false;
  }

  positions() {
    const p = this.aliveUnits.map((u) => u.mesh.position);
    if (this.heli && this.heli.alive) p.push(this.heli.mesh.position);
    return p;
  }

  clear() {
    for (const u of this.units) if (u.alive) this.scene.remove(u.mesh);
    this.units = [];
    if (this.heli && this.heli.alive) this.scene.remove(this.heli.mesh);
    this.heli = null;
  }
}
