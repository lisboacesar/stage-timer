import {
  MINUTE, addTime, formatClock, phase, progress, remaining, reset, stateFromParams, toggle,
} from './timer.js';
import { connect, stamp } from './sync.js';

const clockEl = document.getElementById('clock');
const messageEl = document.getElementById('message');
const barEl = document.getElementById('bar');
const statusEl = document.getElementById('status');

let state = stateFromParams(new URLSearchParams(location.search));
const sync = connect({ getState: () => state, onState: (next) => { state = next; render(); } });

function commit(next) {
  state = stamp(next, state, Date.now());
  sync.publish(state);
  render();
}

const STATUS = { ready: 'Pronto', overtime: 'Tempo esgotado' };

function render() {
  const now = Date.now();
  const current = phase(state, now);
  const text = formatClock(remaining(state, now));
  if (clockEl.textContent !== text) {
    clockEl.textContent = text;
    clockEl.style.setProperty('--chars', Math.max(5, text.length));
  }
  document.body.dataset.phase = current;
  document.body.classList.toggle('paused', !state.running && current !== 'ready');
  barEl.style.transform = `scaleX(${progress(state, now)})`;
  messageEl.textContent = state.message;
  messageEl.hidden = !state.message;
  statusEl.textContent = !state.running && current !== 'ready' ? 'Pausado' : (STATUS[current] ?? '');
  keepScreenOn(state.running);
}

// The projector should not go to sleep in the middle of a talk.
let wakeLock = null;
let wakeLockPending = false;
async function keepScreenOn(on) {
  if (!('wakeLock' in navigator) || wakeLockPending) return;
  wakeLockPending = true;
  try {
    if (on && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  } finally {
    wakeLockPending = false;
  }
}
document.addEventListener('visibilitychange', () => keepScreenOn(state.running));

document.addEventListener('keydown', (event) => {
  const now = Date.now();
  if (event.code === 'Space') {
    event.preventDefault();
    commit(toggle(state, now));
  } else if (event.key === 'r' || event.key === 'R') {
    commit(reset(state));
  } else if (event.key === 'ArrowUp') {
    commit(addTime(state, MINUTE));
  } else if (event.key === 'ArrowDown') {
    commit(addTime(state, -MINUTE));
  } else if (event.key === 'f' || event.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }
});

setInterval(render, 100);
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
