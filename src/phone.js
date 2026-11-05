// Movil interactivo estilo GTA V. Capa de UI en HTML/CSS (no 3D) superpuesta.
// Se abre/cierra con una tecla; mientras esta abierto, libera el raton para
// poder pulsar los iconos. Las apps pueden disparar acciones del juego
// mediante los callbacks recibidos en el constructor.
export class Phone {
  constructor(callbacks = {}) {
    this.cb = callbacks;           // { onStartMission, onSwitchChar, onSetVolume, isOpenChanged }
    this.open = false;
    this.view = 'home';

    this.root = document.getElementById('phone');
    this.screen = document.getElementById('phone-screen');
    this.clockEl = document.getElementById('phone-clock');

    document.getElementById('phone-home-btn')
      .addEventListener('click', () => this.show('home'));

    this._renderHome();
    this._tickClock();
    setInterval(() => this._tickClock(), 1000);
  }

  _tickClock() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (this.clockEl) this.clockEl.textContent = `${hh}:${mm}`;
  }

  toggle() { this.open ? this.hide() : this.showPhone(); }

  showPhone() {
    this.open = true;
    this.root.classList.remove('hidden');
    this.show('home');
    this.cb.isOpenChanged?.(true);
  }

  hide() {
    this.open = false;
    this.root.classList.add('hidden');
    this.cb.isOpenChanged?.(false);
  }

  // Cambia de vista dentro del telefono.
  show(view) {
    this.view = view;
    if (view === 'home') this._renderHome();
    else if (view === 'contacts') this._renderContacts();
    else if (view === 'map') this._renderMap();
    else if (view === 'settings') this._renderSettings();
  }

  _renderHome() {
    const apps = [
      { key: 'contacts', label: 'Contactos', glyph: '📇', bg: '#2a9d8f' },
      { key: 'map', label: 'Mapa', glyph: '🗺️', bg: '#4361ee' },
      { key: 'settings', label: 'Ajustes', glyph: '⚙️', bg: '#6d6875' },
    ];
    this.screen.innerHTML = `
      <div class="phone-apps">
        ${apps.map((a) => `
          <div class="app-icon" data-app="${a.key}">
            <div class="glyph" style="background:${a.bg}">${a.glyph}</div>
            ${a.label}
          </div>`).join('')}
      </div>`;
    this.screen.querySelectorAll('.app-icon').forEach((el) =>
      el.addEventListener('click', () => this.show(el.dataset.app)));
  }

  _renderContacts() {
    const contacts = this.cb.getContacts?.() ?? [];
    this.screen.innerHTML = `
      <span class="phone-back" data-back>‹ Inicio</span>
      <div class="phone-view-title">Contactos</div>
      ${contacts.map((c, i) => `
        <div class="contact" data-mission="${i}">
          <div class="avatar" style="background:${c.color}">${c.initial}</div>
          <div class="meta">
            <div class="cname">${c.name}</div>
            <div class="csub">${c.sub}</div>
          </div>
          <div class="call">📞</div>
        </div>`).join('')}
    `;
    this.screen.querySelector('[data-back]').addEventListener('click', () => this.show('home'));
    this.screen.querySelectorAll('.contact').forEach((el) =>
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.mission);
        this.cb.onStartMission?.(idx);
        this.hide();
      }));
  }

  _renderMap() {
    this.screen.innerHTML = `
      <span class="phone-back" data-back>‹ Inicio</span>
      <div class="phone-view-title">Mapa</div>
      <canvas id="phone-map-canvas" width="220" height="300"></canvas>
    `;
    this.screen.querySelector('[data-back]').addEventListener('click', () => this.show('home'));
    // El dibujo real del mapa lo refresca el juego via drawMap().
    this.mapCanvas = this.screen.querySelector('#phone-map-canvas');
  }

  _renderSettings() {
    const char = this.cb.getCharacter?.() ?? 'Mateo';
    this.screen.innerHTML = `
      <span class="phone-back" data-back>‹ Inicio</span>
      <div class="phone-view-title">Ajustes</div>
      <div class="phone-row">
        <span>Personaje</span>
        <button class="phone-btn" data-switch>${char} ⟳</button>
      </div>
      <div class="phone-row">
        <span>Volumen</span>
        <input type="range" min="0" max="100" value="50" data-vol />
      </div>
      <div class="phone-row">
        <span>Reiniciar misiones</span>
        <button class="phone-btn" data-restart>Reiniciar</button>
      </div>
    `;
    this.screen.querySelector('[data-back]').addEventListener('click', () => this.show('home'));
    this.screen.querySelector('[data-switch]').addEventListener('click', () => {
      this.cb.onSwitchChar?.();
      this.show('settings');
    });
    this.screen.querySelector('[data-vol]').addEventListener('input', (e) =>
      this.cb.onSetVolume?.(Number(e.target.value) / 100));
    this.screen.querySelector('[data-restart]').addEventListener('click', () => {
      this.cb.onRestart?.();
      this.hide();
    });
  }

  // El juego llama a esto cada frame si la vista de mapa esta abierta.
  drawMap(state) {
    if (this.view !== 'map' || !this.mapCanvas) return;
    const ctx = this.mapCanvas.getContext('2d');
    const w = this.mapCanvas.width, h = this.mapCanvas.height;
    const scale = Math.min(w, h) / (state.worldExtent * 2);
    const cx = w / 2, cy = h / 2;
    const toMap = (wx, wz) => [cx + wx * scale, cy + wz * scale];

    ctx.fillStyle = '#0f1218';
    ctx.fillRect(0, 0, w, h);

    // Objetivo.
    if (state.marker) {
      const [x, y] = toMap(state.marker.x, state.marker.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Jugador.
    const [px, py] = toMap(state.player.x, state.player.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
  }
}
