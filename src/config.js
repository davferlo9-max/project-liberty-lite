// Parametros globales de ajuste. Un solo lugar para balancear el juego.
export const CONFIG = {
  world: {
    blockSize: 40,      // tamano de manzana
    roadWidth: 10,      // ancho de calle
    gridCount: 6,       // manzanas por lado -> ciudad gridCount x gridCount
  },
  player: {
    walkSpeed: 7,
    runSpeed: 13,
    maxHealth: 100,
    radius: 0.6,
    height: 1.8,
  },
  vehicle: {
    enginePower: 900,
    maxSteer: 0.5,
    brakePower: 40,
    mass: 400,
  },
  combat: {
    damage: 25,
    range: 60,
    fireCooldown: 0.25,
    enemyHealth: 100,
  },
  traffic: { count: 14, speed: 9 },
  pedestrians: { count: 30, speed: 2.2 },
  wanted: {
    decayPerSecond: 0.12,
    maxStars: 5,
    killCivilian: 0.6,   // estrellas al atropellar/matar civil
    killCop: 1.0,        // estrellas al matar a un policia
  },
  police: {
    health: 90,
    speedFoot: 5.5,
    speedCar: 16,
    fireRange: 45,
    damage: 10,
    spawnInterval: 2.5,       // segundos entre apariciones
    attackRange: 40,
    // Presupuesto de unidades por nivel de busqueda (indice = estrellas).
    unitsByStar: [0, 2, 4, 6, 8, 10],
    carFromStar: 3,           // a partir de este nivel aparecen coches patrulla
    heliFromStar: 4,          // a partir de este nivel aparece helicoptero
    heliHealth: 350,
    heliAltitude: 28,
    heliSpeed: 18,
    heliFireRange: 60,
    heliDamage: 7,
    sirenHz: 2.2,             // frecuencia de parpadeo de luces (destellos/seg)
  },
};
