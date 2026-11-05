import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';
import { clamp, distance2D } from './utils.js';
import { Input } from './input.js';
import { City } from './city.js';
import { Player } from './player.js';
import { Vehicle } from './vehicle.js';
import { Pedestrians } from './pedestrians.js';
import { Traffic } from './traffic.js';
import { Combat } from './combat.js';
import { Police } from './police.js';
import { AudioEngine } from './audio.js';
import { MissionSystem } from './missions.js';
import { HUD } from './hud.js';

class Game {
  constructor() {
    // --- Render ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87a7c4);
    this.scene.fog = new THREE.Fog(0x87a7c4, 80, 220);

    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
    this.camera.position.set(0, 12, 16);

    this._lights();

    // --- Fisica ---
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // --- Sistemas ---
    this.input = new Input(this.renderer.domElement);
    this.city = new City(this.scene, this.world);
    this.player = new Player(this.scene);
    this.vehicles = [
      new Vehicle(this.scene, this.world, 6, 6, 0xd83b3b),
      new Vehicle(this.scene, this.world, -12, 8, 0x2a9d8f),
    ];
    this.peds = new Pedestrians(this.scene, this.city);
    this.traffic = new Traffic(this.scene, this.city);
    this.combat = new Combat(this.scene, this.city);
    this.police = new Police(this.scene, this.city, this.combat);
    this.audio = new AudioEngine();
    this.hud = new HUD();

    // El AudioContext solo puede arrancar tras un gesto del usuario.
    this.renderer.domElement.addEventListener('click', () => this.audio.resume());
    this.missions = new MissionSystem(this.scene, {
      player: this.player, combat: this.combat, city: this.city, hud: this.hud,
    });

    this.wanted = 0;
    this.camYaw = 0;
    this.clock = new THREE.Clock();

    addEventListener('resize', () => this._onResize());

    this.hud.show();
    this.missions.start();
    this.hud.flash('Clic para capturar el ratón · WASD para moverte', 3500);
    this._loop();
  }

  _lights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.0);
    sun.position.set(60, 100, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = 120;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    sun.shadow.camera.far = 300;
    this.scene.add(sun);
  }

  _onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  // Entrar/salir de vehiculo con F.
  _handleVehicleToggle() {
    if (!this.input.pressed('KeyF')) return;
    if (this.player.inVehicle) {
      const veh = this.player.inVehicle;
      veh.exit();
      const px = veh.position.x + Math.cos(veh.heading) * 3;
      const pz = veh.position.z + Math.sin(veh.heading) * 3;
      this.player.inVehicle = null;
      this.player.teleport(px, pz);
      this.player.setVisible(true);
    } else {
      // Entrar al vehiculo mas cercano si esta en rango.
      let best = null, bestD = 4;
      for (const v of this.vehicles) {
        const d = distance2D(this.player.position.x, this.player.position.z, v.position.x, v.position.z);
        if (d < bestD) { best = v; bestD = d; }
      }
      if (best) {
        best.enter();
        this.player.inVehicle = best;
        this.player.setVisible(false);
      }
    }
  }

  _updateCamera(dt) {
    let targetPos, heading;
    if (this.player.inVehicle) {
      const v = this.player.inVehicle;
      targetPos = new THREE.Vector3(v.position.x, v.position.y, v.position.z);
      heading = v.heading;
    } else {
      targetPos = this.player.position.clone();
      heading = this.player.heading;
    }

    // Camara de persecucion detras del objetivo.
    const dist = this.player.inVehicle ? 12 : 7;
    const height = this.player.inVehicle ? 6 : 4;
    const camX = targetPos.x - Math.sin(heading) * dist;
    const camZ = targetPos.z - Math.cos(heading) * dist;
    const desired = new THREE.Vector3(camX, targetPos.y + height, camZ);

    this.camera.position.lerp(desired, Math.min(1, dt * 6));
    this.camera.lookAt(targetPos.x, targetPos.y + 1.5, targetPos.z);
  }

  _updateWanted(dt) {
    // El nivel de busqueda decae con el tiempo.
    this.wanted = clamp(this.wanted - CONFIG.wanted.decayPerSecond * dt, 0, CONFIG.wanted.maxStars);
  }

  // Traduce el estado del juego en sonido. Detecta "flancos" comparando
  // contadores entre frames para disparar efectos puntuales una sola vez.
  _updateAudio() {
    const a = this.audio;
    if (!a.enabled) return;

    this._prev = this._prev || { pShots: 0, eShots: 0, copShots: 0, missions: 0, dead: false };
    const prev = this._prev;

    // Disparos del jugador.
    if (this.combat.playerShots > prev.pShots) a.playerShot();
    // Disparos de enemigos de mision + policia (a pie, coche, heli).
    if (this.combat.enemyShots > prev.eShots) a.policeShot();
    if (this.police.shotsFired > prev.copShots) a.policeShot();
    // Mision completada.
    if (this.missions.completedCount > prev.missions) a.jingle();
    // Muerte del jugador.
    if (!this.player.alive && !prev.dead) a.impact();

    prev.pShots = this.combat.playerShots;
    prev.eShots = this.combat.enemyShots;
    prev.copShots = this.police.shotsFired;
    prev.missions = this.missions.completedCount;
    prev.dead = !this.player.alive;

    // Motor (continuo): activo solo dentro del vehiculo; tono segun velocidad.
    const veh = this.player.inVehicle;
    if (veh) {
      const speedNorm = clamp(veh.speedKmh / 120, 0, 1);
      a.setEngine(true, speedNorm);
    } else {
      a.setEngine(false);
    }

    // Sirena (continua): suena mientras haya policia persiguiendo.
    a.setSiren(this.police.aliveUnits.length > 0 || (this.police.heli && this.police.heli.alive));
  }

  _checkCollateral() {
    // Atropellos y colisiones a velocidad generan "buscado".
    const veh = this.player.inVehicle;
    if (!veh || veh.speedKmh < 15) return;
    const { x, z } = veh.position;
    if (this.peds.hitAt(x, z, 1.8)) this._raiseWanted(CONFIG.wanted.killCivilian);
    if (this.traffic.hitAt(x, z, 2.4)) this._raiseWanted(0.3);
    if (this.police.hitAt(x, z, 2.2)) this._raiseWanted(CONFIG.wanted.killCop);
  }

  _raiseWanted(amount) {
    this.wanted = clamp(this.wanted + amount, 0, CONFIG.wanted.maxStars);
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this._handleVehicleToggle();
    if (this.input.pressed('KeyR')) {
      this.missions.restart();
      this.police.clear();
      this.wanted = 0;
      this.player.health = CONFIG.player.maxHealth;
      this.player.alive = true;
      this.audio.setEngine(false);
      this.audio.setSiren(false);
    }

    // Fisica.
    this.world.step(1 / 60, dt, 3);

    // Actualizaciones de sistemas.
    this.player.update(dt, this.input);
    for (const v of this.vehicles) v.update(dt, this.input);
    if (this.player.inVehicle) {
      // Sincroniza posicion logica del jugador con el vehiculo.
      this.player.position.set(
        this.player.inVehicle.position.x, 0, this.player.inVehicle.position.z
      );
    }

    // Amenaza para peatones: disparos del jugador o vehiculo veloz.
    let threat = null;
    const veh = this.player.inVehicle;
    if (veh && veh.speedKmh > 20) {
      threat = { x: veh.position.x, z: veh.position.z, radius: 12 };
    } else if (this.input.mouseDown || this.input.isDown('Space')) {
      threat = { x: this.player.position.x, z: this.player.position.z, radius: 15 };
    }
    this.peds.update(dt, threat);

    const avoid = [...this.traffic.positions(), this.player.position];
    this.traffic.update(dt, avoid);

    // El disparo del jugador puede alcanzar tambien a la policia.
    this.combat.update(dt, this.player, this.camera, this.input, [this.police]);
    for (const faction of this.combat.consumeKills()) {
      if (faction === this.police) this._raiseWanted(CONFIG.wanted.killCop);
    }

    // Policia: reacciona al nivel de buscado.
    this.police.update(dt, this.player, this.wanted);

    this.missions.update(dt);

    this._checkCollateral();
    this._updateWanted(dt);
    this._updateCamera(dt);
    this._updateAudio(dt);

    // HUD.
    this.hud.update(dt, {
      health: this.player.health,
      wanted: this.wanted,
      missionTitle: this.missions.titleText,
      objective: this.missions.objectiveText,
      inVehicle: !!this.player.inVehicle,
      speed: veh ? veh.speedKmh : 0,
      worldExtent: this.city.extent,
      player: { x: this.player.position.x, z: this.player.position.z },
      traffic: this.traffic.positions(),
      enemies: this.combat.aliveEnemies.map((e) => e.mesh.position),
      police: this.police.positions(),
      marker: this.missions.markerPos,
    });

    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
