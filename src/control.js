import {
  MINUTE, addTime, configure, createState, formatClock, formatDuration, parseDuration, phase,
  remaining, reset, setMessage, toggle,
} from './timer.js';
import { connect, stamp } from './sync.js';

const $ = (id) => document.getElementById(id);

let state = createState();
const sync = connect({
  getState: () => state,
  onState: (next) => {
    state = next;
    fillSettings();
    render();
  },
});

function commit(next) {
  state = stamp(next, state, Date.now());
  sync.publish(state);
  render();
}

const PHASE_LABEL = {
  ready: 'Pronto para começar',
  normal: 'Em andamento',
  warning: 'Aviso amarelo',
  danger: 'Aviso vermelho',
  overtime: 'Tempo esgotado',
};

function render() {
  const now = Date.now();
  const current = phase(state, now);
  $('preview').textContent = formatClock(remaining(state, now));
  $('preview').dataset.phase = current;
  const label = !state.running && current !== 'ready' ? 'Pausado' : PHASE_LABEL[current];
  const extra = Math.round(state.extraMs / MINUTE);
  $('phase').textContent = extra ? `${label} · ${extra > 0 ? '+' : '−'}${Math.abs(extra)} min nesta fala` : label;
  $('toggle').textContent = state.running ? 'Pausar' : (current === 'ready' ? 'Iniciar' : 'Continuar');
  $('current-message').textContent = state.message || 'Nenhuma mensagem na tela.';
  $('clear-message').disabled = !state.message;
}

// Settings

// Shows the configuration in use when it changes in another window,
// unless someone is typing in the form.
function fillSettings() {
  if ($('settings').contains(document.activeElement)) return;
  $('duration').value = formatDuration(state.durationMs);
  $('warn').value = formatDuration(state.warnMs);
  $('danger').value = formatDuration(state.dangerMs);
}

function readSettings() {
  const durationMs = parseDuration($('duration').value);
  const warnMs = parseDuration($('warn').value);
  const dangerMs = parseDuration($('danger').value);
  if (!durationMs || durationMs <= 0) return 'Informe a duração, por exemplo 15, 15:00 ou 1h30.';
  if (warnMs === null || dangerMs === null) return 'Os avisos aceitam minutos, como 5 ou 0:30.';
  if (dangerMs > warnMs) return 'O aviso vermelho precisa vir depois do amarelo.';
  return { durationMs, warnMs, dangerMs };
}

$('settings').addEventListener('submit', (event) => {
  event.preventDefault();
  const result = readSettings();
  if (typeof result === 'string') {
    $('settings-error').textContent = result;
    return;
  }
  $('settings-error').textContent = '';
  commit(configure(state, result));
});

// Timer buttons

$('toggle').addEventListener('click', () => commit(toggle(state, Date.now())));
$('reset').addEventListener('click', () => commit(reset(state)));
$('minus').addEventListener('click', () => commit(addTime(state, -MINUTE)));
$('plus').addEventListener('click', () => commit(addTime(state, MINUTE)));

// Messages for the speaker

document.querySelectorAll('[data-message]').forEach((button) => {
  button.addEventListener('click', () => commit(setMessage(state, button.dataset.message)));
});
$('message-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const text = $('custom-message').value;
  if (!text.trim()) return;
  commit(setMessage(state, text));
  $('custom-message').value = '';
});
$('clear-message').addEventListener('click', () => commit(setMessage(state, '')));

// Stage window

$('open-stage').addEventListener('click', () => {
  window.open('stage.html', 'stage-timer-stage', 'popup,width=1024,height=576');
});

// Keyboard shortcuts, except while typing in a field
document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, textarea, select, button')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    commit(toggle(state, Date.now()));
  } else if (event.key === 'r' || event.key === 'R') {
    commit(reset(state));
  } else if (event.key === 'ArrowUp') {
    commit(addTime(state, MINUTE));
  } else if (event.key === 'ArrowDown') {
    commit(addTime(state, -MINUTE));
  }
});

setInterval(render, 200);
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
