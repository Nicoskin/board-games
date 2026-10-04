'use strict';

const COLORS = ['#6aa8ff', '#ff6a8a', '#5fe0a0', '#ffb84d'];
// Палитра для выбора цвета игрока в настройках
const PALETTE = ['#6aa8ff', '#ff6a8a', '#5fe0a0', '#ffb84d', '#b18cff', '#ff4b3e',
                 '#3fd7e8', '#ffe45c', '#ff8fd8', '#9be15d', '#ff9955', '#d0d6e6'];
const DEFAULT_NAMES = ['Игрок 1', 'Игрок 2', 'Игрок 3', 'Игрок 4'];
const STORE_KEY = 'star-realms-authority-v1';
const MERGE_MS = 2000;      // изменения одного игрока подряд склеиваются в одну запись
const HOLD_DELAY = 450;     // через сколько начинается автоповтор при удержании
const HOLD_EVERY = 110;

const $ = (s) => document.querySelector(s);

// ---------- Состояние ----------
function freshState(prev) {
  const count = prev?.count ?? 2;
  const start = prev?.start ?? 50;
  const names = prev?.names ?? DEFAULT_NAMES.slice();
  return {
    count, start, names,
    colors: prev?.colors ?? COLORS.slice(),
    faceToFace: prev?.faceToFace ?? true,
    fullscreen: prev?.fullscreen ?? true,
    style: prev?.style ?? 'digits',
    vibrate: prev?.vibrate ?? true,
    values: Array.from({ length: count }, () => start),
    log: [],
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Array.isArray(s.values) && s.values.length === s.count) return s;
  } catch (_) {}
  return freshState();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
}

let state = load();
state.colors ??= COLORS.slice();       // сохранения из старых версий
state.fullscreen ??= true;
const color = (i) => state.colors[i] || COLORS[i];

// ---------- Щит влияния (как на карточке из игры) ----------
function shieldSVG(id) {
  const wings = [[26, 8], [46, 20], [66, 32]]
    .map(([y, x]) => `M56 ${y}H${x}l10 14H56Z M144 ${y}H${200 - x}l-10 14H144Z`).join(' ');
  return `
  <svg class="badge" viewBox="0 0 200 150" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color:color-mix(in srgb, var(--sc) 55%, #fff)"/>
        <stop offset=".55" style="stop-color:var(--sc)"/>
        <stop offset="1" style="stop-color:color-mix(in srgb, var(--sc) 60%, #000)"/>
      </linearGradient>
    </defs>
    <g fill="url(#${id})" stroke="#0a120a" stroke-width="3" stroke-linejoin="round">
      <path d="${wings}"/>
      <path d="M50 12H150V24H144V92L100 140L56 92V24H50Z"/>
    </g>
    <path d="M63 29H137V89L100 130L63 89Z" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
    <text class="num" x="100" y="92" text-anchor="middle" font-size="58"></text>
  </svg>`;
}

// ---------- Отрисовка поля ----------
const panels = [];

function buildBoard() {
  const board = $('#board');
  board.innerHTML = '';
  board.className = state.style;
  panels.length = 0;

  const n = state.count;
  const topCount = Math.floor(n / 2);
  const top = document.createElement('div');
  const bottom = document.createElement('div');
  top.className = 'half' + (state.faceToFace ? ' flipped' : '');
  bottom.className = 'half';

  for (let i = 0; i < n; i++) {
    const el = document.createElement('section');
    el.className = 'player';
    el.style.setProperty('--c', color(i));
    el.innerHTML = `
      <button class="zone minus" aria-label="минус 1">−</button>
      <button class="zone plus" aria-label="плюс 1">+</button>
      <div class="name"></div>
      <div class="delta"></div>
      <div class="value"></div>
      ${shieldSVG('sg' + i)}
      <button class="five m" aria-label="минус 5">−5</button>
      <button class="five p" aria-label="плюс 5">+5</button>`;
    bindPress(el.querySelector('.zone.minus'), () => change(i, -1));
    bindPress(el.querySelector('.zone.plus'), () => change(i, +1));
    bindPress(el.querySelector('.five.m'), () => change(i, -5));
    bindPress(el.querySelector('.five.p'), () => change(i, +5));

    panels.push({
      el,
      name: el.querySelector('.name'),
      value: el.querySelector('.value'),
      delta: el.querySelector('.delta'),
      badge: el.querySelector('.badge'),
      num: el.querySelector('.badge .num'),
      run: 0, runTimer: null,
    });

    // Верхняя половина: при перевороте на 180° порядок игроков тоже разворачивается,
    // поэтому добавляем их так, чтобы каждый видел свою панель «у себя».
    (i < topCount ? top : bottom).appendChild(el);
  }

  if (topCount > 0) board.appendChild(top);
  board.appendChild(bottom);
  renderAll();
}

function renderPlayer(i) {
  const p = panels[i];
  const v = state.values[i];
  p.name.textContent = state.names[i] || DEFAULT_NAMES[i];
  p.value.textContent = v;
  // В щит помещаются две цифры; более длинные числа сжимаем по ширине
  const s = String(v);
  p.num.textContent = s;
  if (s.length > 2) {
    p.num.setAttribute('textLength', 72);
    p.num.setAttribute('lengthAdjust', 'spacingAndGlyphs');
  } else {
    p.num.removeAttribute('textLength');
  }
  p.el.classList.toggle('dead', v <= 0);
  p.el.classList.toggle('low', v > 0 && v <= 10);
}

function renderAll() {
  for (let i = 0; i < state.count; i++) renderPlayer(i);
  $('#btn-undo').disabled = state.log.length === 0;
}

// ---------- Изменение влияния ----------
function change(i, d) {
  state.values[i] += d;

  const last = state.log[state.log.length - 1];
  const now = Date.now();
  if (last && last.p === i && now - last.t < MERGE_MS) {
    last.d += d; last.to = state.values[i]; last.t = now;
    if (last.d === 0) state.log.pop();
  } else {
    state.log.push({ p: i, d, to: state.values[i], t: now });
  }
  if (state.log.length > 500) state.log.shift();

  showDelta(i, d);
  renderPlayer(i);
  $('#btn-undo').disabled = state.log.length === 0;
  for (const el of [panels[i].value, panels[i].badge]) {
    el.classList.remove('bump'); void el.getBoundingClientRect(); el.classList.add('bump');
  }
  if (state.vibrate && navigator.vibrate) navigator.vibrate(state.values[i] <= 0 ? [30, 60, 30] : 12);
  save();
}

function showDelta(i, d) {
  const p = panels[i];
  p.run += d;
  p.delta.textContent = p.run > 0 ? '+' + p.run : p.run === 0 ? '±0' : '−' + Math.abs(p.run);
  p.delta.className = 'delta show ' + (p.run > 0 ? 'pos' : p.run < 0 ? 'neg' : '');
  clearTimeout(p.runTimer);
  p.runTimer = setTimeout(() => { p.run = 0; p.delta.classList.remove('show'); }, 1600);
}

function undo() {
  const e = state.log.pop();
  if (!e) return;
  state.values[e.p] -= e.d;
  const p = panels[e.p];
  p.run = 0; p.delta.classList.remove('show');
  renderAll();
  save();
  toast(`Отменено: ${state.names[e.p]} ${fmt(e.d)}`);
}

// ---------- Нажатия с автоповтором при удержании ----------
function bindPress(btn, fn) {
  let delay = null, rep = null;
  const stop = () => {
    clearTimeout(delay); clearInterval(rep);
    delay = rep = null;
    btn.classList.remove('pressed');
  };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    stop();
    ensureWakeLock();
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    btn.classList.add('pressed');
    fn();
    delay = setTimeout(() => { rep = setInterval(fn, HOLD_EVERY); }, HOLD_DELAY);
  });
  ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach((t) => btn.addEventListener(t, stop));
  // Страховка: отпускание пальца где угодно, уход из приложения — автоповтор всегда прекращается
  ['pointerup', 'pointercancel', 'blur'].forEach((t) => window.addEventListener(t, stop));
  document.addEventListener('visibilitychange', stop);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  // Клавиатура (Enter/Пробел) — одно нажатие
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  });
}

// ---------- Экран не гаснет (Wake Lock) ----------
let wakeLock = null;
let wakeWanted = true;
const wakeBtn = $('#btn-wake');

async function ensureWakeLock() {
  if (!wakeWanted || wakeLock || document.visibilityState !== 'visible') return;
  if (!('wakeLock' in navigator)) { renderWake(); return; }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; renderWake(); });
  } catch (_) {
    wakeLock = null;
  }
  renderWake();
}

function renderWake() {
  wakeBtn.classList.remove('on', 'off');
  if (!('wakeLock' in navigator)) wakeBtn.classList.add('off');
  else if (wakeLock) wakeBtn.classList.add('on');
}

wakeBtn.addEventListener('click', async () => {
  if (!('wakeLock' in navigator)) {
    toast('Этот браузер не умеет держать экран включённым. Обновите браузер/iOS или увеличьте время блокировки в настройках телефона.', 5000);
    return;
  }
  if (wakeLock) {
    wakeWanted = false;
    await wakeLock.release();
    wakeLock = null;
    toast('Экран может гаснуть');
  } else {
    wakeWanted = true;
    await ensureWakeLock();
    toast(wakeLock ? 'Экран не будет гаснуть' : 'Не удалось включить — коснитесь экрана ещё раз');
  }
  renderWake();
});

// После сворачивания приложения блокировка снимается системой — берём заново
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') ensureWakeLock();
});
// Некоторым браузерам нужен жест пользователя
document.addEventListener('pointerdown', ensureWakeLock, { passive: true });

// ---------- Всплывающее сообщение ----------
let toastTimer;
function toast(text, ms = 2000) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

const fmt = (d) => (d > 0 ? '+' + d : '−' + Math.abs(d));

// ---------- История ----------
$('#btn-log').addEventListener('click', () => {
  const list = $('#log-list');
  list.innerHTML = '';
  if (!state.log.length) {
    list.innerHTML = '<li class="empty">Пока пусто</li>';
  } else {
    for (const e of state.log.slice().reverse()) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="dot" style="width:10px;height:10px;border-radius:50%;background:${color(e.p)}"></span>
        <span class="who"></span>
        <span class="d ${e.d > 0 ? 'pos' : 'neg'}">${fmt(e.d)}</span>
        <span class="to">${e.to}</span>`;
      li.querySelector('.who').textContent = state.names[e.p];
      list.appendChild(li);
    }
  }
  $('#dlg-log').showModal();
});

// ---------- Новая игра ----------
$('#btn-undo').addEventListener('click', undo);

$('#btn-new').addEventListener('click', () => {
  $('#new-start').textContent = state.start;
  $('#dlg-new').showModal();
});
$('#dlg-new').addEventListener('close', () => {
  if ($('#dlg-new').returnValue === 'yes') newGame();
});

function newGame(opts) {
  state = freshState({ ...state, ...opts });
  panels.forEach((p) => clearTimeout(p.runTimer));
  buildBoard();
  save();
  toast('Новая игра');
}

// ---------- Настройки ----------
const dlgS = $('#dlg-settings');
let draft;

function renderDraft() {
  document.querySelectorAll('#seg-players button').forEach((b) =>
    b.classList.toggle('on', +b.dataset.n === draft.count));
  $('#start-val').textContent = draft.start;
  const box = $('#names');
  box.innerHTML = '';
  for (let i = 0; i < draft.count; i++) {
    const row = document.createElement('div');
    row.className = 'name-row';
    row.innerHTML = `
      <button type="button" class="dot-btn" aria-label="Цвет игрока"><span class="dot"></span></button>
      <input maxlength="20" enterkeyhint="done">
      <div class="palette" hidden></div>`;
    const dot = row.querySelector('.dot');
    const pal = row.querySelector('.palette');
    dot.style.background = color(i);

    const inp = row.querySelector('input');
    inp.value = draft.names[i];
    inp.placeholder = DEFAULT_NAMES[i];
    inp.addEventListener('input', () => { draft.names[i] = inp.value; });

    row.querySelector('.dot-btn').addEventListener('click', () => {
      const open = pal.hidden;
      box.querySelectorAll('.palette').forEach((p) => { p.hidden = true; });
      pal.hidden = !open;
    });

    // Цвета из палитры + «другой» (системный выбор цвета)
    for (const c of PALETTE) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (c === color(i) ? ' on' : '');
      b.style.background = c;
      b.setAttribute('aria-label', c);
      b.addEventListener('click', () => { setColor(i, c); });
      pal.appendChild(b);
    }
    const custom = document.createElement('label');
    custom.className = 'swatch custom';
    custom.title = 'Другой цвет';
    custom.innerHTML = '<input type="color">';
    const ci = custom.querySelector('input');
    ci.value = color(i);
    ci.addEventListener('input', () => setColor(i, ci.value, false));
    pal.appendChild(custom);

    box.appendChild(row);
  }
}

// Цвет применяется сразу, счёт не сбрасывается
function setColor(i, c, rerender = true) {
  state.colors[i] = c;
  if (i < state.count) panels[i].el.style.setProperty('--c', c);
  save();
  if (rerender) renderDraft();
  else $('#names').children[i].querySelector('.dot').style.background = c;
}

$('#btn-settings').addEventListener('click', () => {
  draft = { count: state.count, start: state.start, names: state.names.slice() };
  $('#opt-face').checked = state.faceToFace;
  renderStyleSeg();
  $('#opt-vibe').checked = state.vibrate;
  $('#opt-full').checked = state.fullscreen;
  renderDraft();
  dlgS.showModal();
});

document.querySelectorAll('#seg-players button').forEach((b) =>
  b.addEventListener('click', () => { draft.count = +b.dataset.n; renderDraft(); }));

const clampStart = (v) => Math.max(1, Math.min(999, Math.round(v) || 50));
// Без поля ввода, чтобы не вылезала клавиатура; удержание кнопки меняет значение быстро
const setStart = (d) => { draft.start = clampStart(draft.start + d); $('#start-val').textContent = draft.start; };
bindPress($('#start-minus'), () => setStart(-1));
bindPress($('#start-plus'), () => setStart(+1));

// Вид счёта, переворот и вибрация применяются сразу, без сброса игры
function renderStyleSeg() {
  document.querySelectorAll('#seg-style button').forEach((b) =>
    b.classList.toggle('on', b.dataset.s === state.style));
}
document.querySelectorAll('#seg-style button').forEach((b) =>
  b.addEventListener('click', () => {
    state.style = b.dataset.s;
    $('#board').className = state.style;
    renderStyleSeg(); save();
  }));

$('#opt-face').addEventListener('change', (e) => { state.faceToFace = e.target.checked; buildBoard(); save(); });
$('#opt-vibe').addEventListener('change', (e) => { state.vibrate = e.target.checked; save(); });
$('#opt-full').addEventListener('change', (e) => {
  state.fullscreen = e.target.checked; save();
  if (state.fullscreen) enterFullscreen();
  else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
});

// Имена сохраняем и при простом закрытии — без сброса счёта
dlgS.addEventListener('close', () => {
  if (dlgS.returnValue === 'apply') return;
  for (let i = 0; i < state.count; i++) state.names[i] = (draft.names[i] || '').trim() || DEFAULT_NAMES[i];
  renderAll(); save();
});

$('#settings-apply').addEventListener('click', () => {
  const names = DEFAULT_NAMES.map((d, i) => (draft.names[i] || '').trim() || d);
  dlgS.close('apply');
  newGame({ count: draft.count, start: draft.start, names });
});

// ---------- На весь экран ----------
// Браузер разрешает полноэкранный режим только по касанию, поэтому входим в него
// при нажатии и снова — после возврата в приложение (система его сбрасывает).
const canFullscreen = !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
const isFullscreenApp = matchMedia('(display-mode: fullscreen)').matches;

function enterFullscreen() {
  if (!canFullscreen || !state.fullscreen || document.fullscreenElement || isFullscreenApp) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}
// Только по касанию игрового поля: если включать режим по кнопкам панели,
// он наложится на только что открытое окно настроек и перекроет его.
$('#board').addEventListener('pointerup', enterFullscreen, { passive: true });

// Полноэкранный элемент ложится поверх открытых окон — переоткрываем их, чтобы они снова были сверху
document.addEventListener('fullscreenchange', () => {
  for (const d of document.querySelectorAll('dialog[open]')) {
    d.returnValue = '';
    d.close();
    d.showModal();
  }
});
if (!canFullscreen) $('#row-full').hidden = true;

// ---------- Запуск ----------
buildBoard();
renderWake();
ensureWakeLock();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('../../sw.js').catch(() => {});
}
