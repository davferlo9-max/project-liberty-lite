import * as THREE from 'three';

// Factoria de avatares estilizados (NO retratos de personas reales).
// Construye un cuerpo articulado con cabeza, rostro simple, torso, brazos y
// piernas. Devuelve el grupo y referencias a las partes animables.
//
// Los presets (MATEO, LUCIA, etc.) son personajes de FICCION definidos por
// rasgos genericos: color de pelo, tono de piel, ropa. No reproducen a nadie.

export const CHARACTER_PRESETS = {
  MATEO: {
    name: 'Mateo',
    skin: 0xe3b58e,
    hair: 0x8a8a8a,       // entrecano
    hairStyle: 'short',
    top: 0x1c2a44,        // traje azul oscuro
    legs: 0x15213a,
    accent: 0xc62828,     // corbata roja
    hasTie: true,
    build: 1.0,
  },
  LUCIA: {
    name: 'Lucía',
    skin: 0xe7c0a0,
    hair: 0x6b4a2f,       // castaño
    hairStyle: 'long',
    top: 0x141414,        // camiseta negra
    legs: 0x23252b,
    accent: 0x141414,
    hasTie: false,
    build: 0.9,
  },
  ENEMY: {
    name: 'Matón',
    skin: 0xca9b74,
    hair: 0x1a1a1a,
    hairStyle: 'short',
    top: 0x6b1414,        // chaqueta roja oscura
    legs: 0x2a2a2a,
    accent: 0x3a0e0e,
    hasTie: false,
    build: 1.1,
  },
  CONTACT: {
    name: 'Contacto',
    skin: 0xdcb48a,
    hair: 0x3a2a1a,
    hairStyle: 'short',
    top: 0x2a6b4a,        // chaqueta verde
    legs: 0x1e2a24,
    accent: 0x2a6b4a,
    hasTie: false,
    build: 1.0,
  },
};

// Construye un avatar a partir de un preset. Devuelve { group, parts }.
export function buildCharacter(preset) {
  const p = preset;
  const group = new THREE.Group();
  const parts = {};

  const skinMat = new THREE.MeshLambertMaterial({ color: p.skin });
  const topMat = new THREE.MeshLambertMaterial({ color: p.top });
  const legMat = new THREE.MeshLambertMaterial({ color: p.legs });
  const hairMat = new THREE.MeshLambertMaterial({ color: p.hair });
  const b = p.build;

  // --- Torso ---
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62 * b, 0.9, 0.34), topMat);
  torso.position.y = 1.25;
  torso.castShadow = true;
  group.add(torso);

  // Corbata / detalle frontal.
  if (p.hasTie) {
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.5, 0.04),
      new THREE.MeshLambertMaterial({ color: p.accent })
    );
    tie.position.set(0, 1.25, 0.18);
    group.add(tie);
  }

  // --- Cadera + piernas ---
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.58 * b, 0.3, 0.32), legMat);
  hips.position.y = 0.75;
  group.add(hips);

  const legGeo = new THREE.BoxGeometry(0.24 * b, 0.8, 0.26);
  const legL = new THREE.Mesh(legGeo, legMat);
  const legR = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.16 * b, 0.4, 0);
  legR.position.set(0.16 * b, 0.4, 0);
  legL.castShadow = legR.castShadow = true;
  group.add(legL, legR);
  parts.legL = legL;
  parts.legR = legR;

  // --- Brazos (pivotan desde el hombro para animar y sostener el arma) ---
  const armGeo = new THREE.BoxGeometry(0.18 * b, 0.8, 0.2);

  const shoulderL = new THREE.Group();
  shoulderL.position.set(-0.4 * b, 1.6, 0);
  const armL = new THREE.Mesh(armGeo, topMat);
  armL.position.y = -0.4;
  armL.castShadow = true;
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), skinMat);
  handL.position.y = -0.82;
  shoulderL.add(armL, handL);
  group.add(shoulderL);

  const shoulderR = new THREE.Group();
  shoulderR.position.set(0.4 * b, 1.6, 0);
  const armR = new THREE.Mesh(armGeo, topMat);
  armR.position.y = -0.4;
  armR.castShadow = true;
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), skinMat);
  handR.position.y = -0.82;
  shoulderR.add(armR, handR);
  group.add(shoulderR);

  parts.shoulderL = shoulderL;
  parts.shoulderR = shoulderR;
  parts.handR = handR;    // mano derecha: sostiene el arma

  // --- Cabeza + rostro estilizado ---
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.34), skinMat);
  head.position.y = 2.0;
  head.castShadow = true;
  group.add(head);
  parts.head = head;

  // Ojos.
  const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08, 2.03, 0.17);
  eyeR.position.set(0.08, 2.03, 0.17);
  group.add(eyeL, eyeR);

  // Pelo segun estilo.
  if (p.hairStyle === 'short') {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.14, 0.37), hairMat);
    hair.position.y = 2.2;
    group.add(hair);
    // patillas
    const sideGeo = new THREE.BoxGeometry(0.05, 0.22, 0.34);
    const sL = new THREE.Mesh(sideGeo, hairMat);
    const sR = new THREE.Mesh(sideGeo, hairMat);
    sL.position.set(-0.19, 2.02, 0);
    sR.position.set(0.19, 2.02, 0);
    group.add(sL, sR);
  } else {
    // melena larga
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), hairMat);
    top.position.y = 2.22;
    group.add(top);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.6, 0.14), hairMat);
    back.position.set(0, 1.9, -0.2);
    group.add(back);
  }

  return { group, parts };
}
