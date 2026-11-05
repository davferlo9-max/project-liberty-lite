// Gestor central de entrada: teclado + raton (con pointer lock).
export class Input {
  constructor(domElement) {
    this.keys = new Set();
    this.mouseDown = false;
    this.mouseDX = 0;
    this.locked = false;
    this._justPressed = new Set();

    addEventListener('keydown', (e) => {
      const k = e.code;
      if (!this.keys.has(k)) this._justPressed.add(k);
      this.keys.add(k);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));

    domElement.addEventListener('click', () => {
      if (!this.locked) domElement.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === domElement;
    });
    addEventListener('mousemove', (e) => {
      if (this.locked) this.mouseDX += e.movementX;
    });
    addEventListener('mousedown', () => { this.mouseDown = true; });
    addEventListener('mouseup', () => { this.mouseDown = false; });
  }

  isDown(code) { return this.keys.has(code); }

  // Devuelve true solo en el primer frame en que se pulsa la tecla.
  pressed(code) {
    if (this._justPressed.has(code)) { this._justPressed.delete(code); return true; }
    return false;
  }

  // Lee y resetea el delta del raton acumulado este frame.
  consumeMouseDX() {
    const dx = this.mouseDX;
    this.mouseDX = 0;
    return dx;
  }

  endFrame() { this._justPressed.clear(); }
}
