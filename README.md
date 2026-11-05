# Project Liberty-Lite 🚗🔫

Prototipo 3D en tercera persona al estilo GTA, hecho con **Three.js** + **Cannon-es**.
Mundo abierto con ciudad, conducción con física, combate a pie, peatones, tráfico IA,
sistema de misiones, nivel de "se busca" y minimapa.

> ⚠️ Esto es un **prototipo jugable**, no un clon de GTA. Captura la *esencia* de las
> mecánicas pedidas en una base de código limpia y modular que puedes extender.

---

## ▶️ Cómo jugar (cero instalación)

El proyecto carga Three.js y Cannon-es desde CDN mediante un *import map*,
así que **no necesitas `npm install`**. Solo necesitas servirlo por HTTP
(los módulos ES no funcionan abriendo el archivo con `file://`).

Opción A — con Python (ya disponible):
```bash
python3 -m http.server 8000
```
Luego abre: http://localhost:8000

Opción B — con Node (si tienes `npx`):
```bash
npx serve .
```

> Nota: la carga desde CDN requiere conexión a internet en el navegador.
> Si prefieres una build offline con dependencias locales, usa Vite:
> `npm install && npm run dev` (requiere acceso al registro npm).

---

## 🎮 Controles

| Tecla | Acción |
|-------|--------|
| **W A S D** / Flechas | Mover (a pie) / Conducir |
| **F** | Entrar / salir del vehículo (acércate a uno) |
| **Ratón** | Apuntar / girar la cámara |
| **Clic** o **Espacio** | Disparar (a pie) |
| **Shift** | Correr |
| **R** | Reiniciar las misiones |

Haz **clic en la pantalla** para capturar el ratón.

---

## 🧩 Mecánicas incluidas

- **Conducción**: vehículo con física de cuerpo rígido (aceleración, giro según velocidad, inercia).
- **Combate**: disparo por raycast con trazadores; enemigos que persiguen y disparan.
- **Peatones**: deambulan por la ciudad y huyen de disparos o coches veloces.
- **Tráfico**: coches IA que recorren la red de calles y frenan ante obstáculos.
- **Misiones**: secuencia de objetivos (ir a punto, conducir, eliminar objetivos, escapar).
- **Nivel de búsqueda**: sube al atropellar/matar civiles o policías, decae con el tiempo. HUD con estrellas.
- **Policía**: reacciona al nivel de búsqueda. Más estrellas → más agentes y, a partir de ★★★, **coches patrulla** con luces de sirena parpadeantes. A partir de ★★★★ aparece un **helicóptero** que sobrevuela y dispara desde el aire. Persiguen, disparan y te embisten. Baja a 0 estrellas (o pulsa R) y se retiran. Puntos azules en el minimapa.
- **Audio procedural**: todo el sonido se **sintetiza en tiempo real** con la Web Audio API (sin ficheros externos): disparos, motor del coche (tono según velocidad), sirena nee-naw, impactos y arpegio al completar misión. El sonido arranca con el primer clic (política del navegador).
- **HUD + minimapa**: salud, objetivo de misión, velocímetro y radar (civiles, enemigos, policía y objetivo).

---

## 🗂️ Arquitectura

Cada sistema vive en su propio módulo (patrón `update(dt)`):

```
src/
├── main.js          Orquestador: bucle de juego, cámara, ensamblaje
├── config.js        Parámetros de balance (un solo lugar para ajustar)
├── utils.js         Matemáticas y helpers
├── input.js         Teclado + ratón (pointer lock)
├── city.js          Ciudad procedural + red de carriles para IA
├── player.js        Jugador a pie (movimiento cinemático)
├── vehicle.js       Vehículo con física Cannon-es
├── pedestrians.js   Peatones (deambular + huida)
├── traffic.js       Tráfico IA por waypoints
├── combat.js        Disparos, enemigos, trazadores
├── police.js        Facción policial: agentes, coches, helicóptero, sirenas
├── audio.js         Motor de audio procedural (Web Audio API)
├── missions.js      Sistema de misiones por fases
└── hud.js           Interfaz y minimapa
```

## 🔧 Ideas para extender

- Pathfinding A* real para tráfico y peatones.
- Modelos 3D (glTF) en lugar de primitivas.
- Más tipos de misión, economía y guardado.
- Niveles de búsqueda superiores: helicópteros, barricadas.
- Sonido (motor, disparos, sirenas, música).
