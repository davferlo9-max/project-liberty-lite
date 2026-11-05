import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';
import { rand, randInt, pick } from './utils.js';

// Genera una textura de fachada (ventanas) procedural con canvas. Sin ficheros
// externos. Se cachean por color para no regenerar en cada edificio.
const _facadeCache = new Map();
function facadeTexture(baseHex) {
  if (_facadeCache.has(baseHex)) return _facadeCache.get(baseHex);
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  // Muro base.
  ctx.fillStyle = `#${baseHex.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);
  // Rejilla de ventanas.
  const cols = 6, rows = 6, pad = 4;
  const cw = (size - pad * (cols + 1)) / cols;
  const ch = (size - pad * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() < 0.35;
      ctx.fillStyle = lit ? '#ffe9a8' : '#20242c';
      const x = pad + c * (cw + pad);
      const y = pad + r * (ch + pad);
      ctx.fillRect(x, y, cw, ch);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  _facadeCache.set(baseHex, tex);
  return tex;
}

// Genera la ciudad: suelo, red de calles en rejilla, manzanas con edificios.
// Expone la red de carriles (waypoints) para que trafico y peatones circulen.
export class City {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.buildingBodies = [];
    this.roadCenters = [];   // coordenadas X/Z de ejes de calle
    this.laneNodes = [];     // nodos de carril para IA
    this._build();
  }

  get extent() {
    const { blockSize, roadWidth, gridCount } = CONFIG.world;
    return (gridCount * (blockSize + roadWidth)) / 2;
  }

  _build() {
    const { blockSize, roadWidth, gridCount } = CONFIG.world;
    const cell = blockSize + roadWidth;
    const span = gridCount * cell;
    const half = span / 2;

    // --- Suelo (asfalto base) ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(span + 40, span + 40),
      new THREE.MeshLambertMaterial({ color: 0x2b2f38 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);

    // --- Calles (franjas mas claras sobre el asfalto) ---
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
    for (let i = 0; i <= gridCount; i++) {
      const pos = -half + i * cell + roadWidth / 2;
      this.roadCenters.push(pos);
      // calle horizontal
      const h = new THREE.Mesh(new THREE.PlaneGeometry(span + 40, roadWidth), roadMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.02, pos - roadWidth / 2);
      this.scene.add(h);
      // calle vertical
      const v = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, span + 40), roadMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(pos - roadWidth / 2, 0.02, 0);
      this.scene.add(v);
    }

    this._buildLaneGraph();

    // --- Manzanas con edificios ---
    for (let gx = 0; gx < gridCount; gx++) {
      for (let gz = 0; gz < gridCount; gz++) {
        const cx = -half + gx * cell + roadWidth + blockSize / 2;
        const cz = -half + gz * cell + roadWidth + blockSize / 2;
        this._buildBlock(cx, cz, blockSize);
      }
    }

    // Aceras: ligero borde elevado alrededor de cada manzana (decorativo).
    this.spawnPoints = this.laneNodes.map((n) => ({ x: n.x, z: n.z }));

    this._buildCoast(span, half);
  }

  // Playa de arena + mar animado en el lado +Z, mas alla de la ciudad.
  _buildCoast(span, half) {
    const beachZ = half + 30;          // inicio de la playa
    const beachDepth = 40;             // ancho de la franja de arena
    const seaZ = beachZ + beachDepth;  // inicio del mar

    // --- Playa (arena) ---
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(span + 200, beachDepth),
      new THREE.MeshLambertMaterial({ color: 0xd9c08a })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, beachZ + beachDepth / 2);
    sand.receiveShadow = true;
    this.scene.add(sand);

    // Nota: la fisica del suelo general (plano infinito) ya cubre la playa,
    // asi que la arena es puramente visual y se puede pisar/conducir sobre ella.

    // Sombrillas para dar vida a la playa.
    for (let i = 0; i < 8; i++) {
      const ux = rand(-span / 2, span / 2);
      const uz = beachZ + rand(6, beachDepth - 6);
      this._parasol(ux, uz);
    }

    // --- Mar (plano con ondulacion animada) ---
    const segs = 40;
    const seaGeo = new THREE.PlaneGeometry(span + 400, 400, segs, segs);
    this.seaMat = new THREE.MeshLambertMaterial({
      color: 0x1f6f8b, transparent: true, opacity: 0.88,
    });
    this.sea = new THREE.Mesh(seaGeo, this.seaMat);
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.set(0, -0.2, seaZ + 200);
    this.scene.add(this.sea);

    // Guardamos las posiciones base para animar las olas.
    this._seaBase = seaGeo.attributes.position.array.slice();
  }

  _parasol(x, z) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b5533 })
    );
    pole.position.y = 1.1;
    group.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 0.7, 10),
      new THREE.MeshLambertMaterial({ color: pick([0xe76f51, 0xf4a261, 0x2a9d8f]) })
    );
    top.position.y = 2.3;
    group.add(top);
    group.position.set(x, 0, z);
    this.scene.add(group);
  }

  // Anima las olas del mar (llamar cada frame con el tiempo acumulado).
  updateWater(t) {
    if (!this.sea) return;
    const pos = this.sea.geometry.attributes.position;
    const base = this._seaBase;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      pos.array[i * 3 + 2] = Math.sin(x * 0.05 + t * 1.5) * 0.6
                           + Math.cos(y * 0.06 + t * 1.1) * 0.5;
    }
    pos.needsUpdate = true;
    this.sea.geometry.computeVertexNormals();
  }

  _buildBlock(cx, cz, size) {
    const pad = 4;
    const inner = size - pad * 2;
    const lots = randInt(1, 4);
    for (let i = 0; i < lots; i++) {
      const w = rand(inner * 0.3, inner * 0.6);
      const d = rand(inner * 0.3, inner * 0.6);
      const h = rand(6, 34);
      const bx = cx + rand(-inner / 2 + w / 2, inner / 2 - w / 2);
      const bz = cz + rand(-inner / 2 + d / 2, inner / 2 - d / 2);
      const color = pick([0x5a6472, 0x47505c, 0x6b7280, 0x3f4752, 0x525b68]);

      // Fachadas con ventanas (textura procedural); repetidas segun el tamano
      // para que las ventanas mantengan proporcion en edificios altos.
      const tex = facadeTexture(color).clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 6)));
      const wallMat = new THREE.MeshLambertMaterial({ map: tex });
      const roofMat = new THREE.MeshLambertMaterial({ color: 0x2b2f38 });
      // Orden de caras de BoxGeometry: +x,-x,+y,-y,+z,-z. Tejado = +y.
      const mats = [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat];

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      mesh.position.set(bx, h / 2, bz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
      });
      body.position.set(bx, h / 2, bz);
      this.world.addBody(body);
      this.buildingBodies.push(body);
    }
  }

  // Construye nodos de carril en las intersecciones para que la IA navegue.
  _buildLaneGraph() {
    this.laneNodes = [];
    for (const x of this.roadCenters) {
      for (const z of this.roadCenters) {
        this.laneNodes.push({ x: x - CONFIG.world.roadWidth / 2, z: z - CONFIG.world.roadWidth / 2 });
      }
    }
  }

  randomRoadPoint() {
    return pick(this.laneNodes);
  }
}
