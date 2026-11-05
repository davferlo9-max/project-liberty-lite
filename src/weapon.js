import * as THREE from 'three';

// Construye un arma simple (pistola) como THREE.Group, pensada para
// adjuntarse a la mano del personaje. Orientada hacia +Z (delante).
export function buildPistol() {
  const group = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const grip = new THREE.MeshLambertMaterial({ color: 0x15171b });

  // Corredera / canon.
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.5), metal);
  slide.position.set(0, 0, 0.12);
  group.add(slide);

  // Canon que sobresale.
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.18), metal);
  barrel.position.set(0, 0.02, 0.4);
  group.add(barrel);

  // Empunadura.
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.14), grip);
  handle.position.set(0, -0.2, -0.05);
  handle.rotation.x = 0.25;
  group.add(handle);

  group.castShadow = true;
  return group;
}

// Fogonazo breve en la boca del canon. Se crea en la escena y se autodestruye.
export function muzzleFlash(scene, worldPos, dir) {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 })
  );
  flash.position.copy(worldPos);
  scene.add(flash);
  let life = 0.06;
  const tick = () => {
    life -= 0.016;
    flash.scale.multiplyScalar(0.8);
    if (life <= 0) { scene.remove(flash); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
