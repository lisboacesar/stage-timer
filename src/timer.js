// Timer logic shared by the control panel and the stage screen.
// Every function is pure: it takes the current state (and the current time
// when it matters) and returns a new state, so it can be tested without a browser.

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;

export function createState({
  durationMs = 15 * MINUTE,
  warnMs = 5 * MINUTE,
  dangerMs = 1 * MINUTE,
} = {}) {
  return {
    durationMs,
    warnMs,
    dangerMs,
    extraMs: 0,
    running: false,
    startedAt: null,
    elapsedBeforeMs: 0,
    message: '',
    updatedAt: 0,
  };
}

// Length of the current talk: the configured duration plus the minutes given
// or taken while it runs.
export function totalMs(state) {
  return state.durationMs + state.extraMs;
}

// Elapsed time comes from the clock, not from counting ticks, so it stays right
// when the browser slows down the timers of a window in the background.
export function elapsed(state, now) {
  return state.elapsedBeforeMs + (state.running ? now - state.startedAt : 0);
}

export function remaining(state, now) {
  return totalMs(state) - elapsed(state, now);
}

export function progress(state, now) {
  const total = totalMs(state);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, elapsed(state, now) / total));
}

export function start(state, now) {
  if (state.running) return state;
  return { ...state, running: true, startedAt: now };
}

export function pause(state, now) {
  if (!state.running) return state;
  return { ...state, running: false, startedAt: null, elapsedBeforeMs: elapsed(state, now) };
}

export function toggle(state, now) {
  return state.running ? pause(state, now) : start(state, now);
}

// Back to the configured duration, ready for the next speaker.
export function reset(state) {
  return { ...state, running: false, startedAt: null, elapsedBeforeMs: 0, extraMs: 0 };
}

// Gives or takes time from the current talk only; the configuration stays.
export function addTime(state, deltaMs) {
  return { ...state, extraMs: Math.max(-state.durationMs, state.extraMs + deltaMs) };
}

export function configure(state, { durationMs, warnMs, dangerMs }) {
  return { ...reset(state), durationMs, warnMs, dangerMs };
}

export function setMessage(state, message) {
  return { ...state, message: String(message).trim() };
}

// ready: nothing happened yet; normal/warning/danger: time left against the
// two warning thresholds; overtime: the talk went past its time.
export function phase(state, now) {
  if (!state.running && elapsed(state, now) === 0) return 'ready';
  const left = remaining(state, now);
  if (left < 0) return 'overtime';
  if (left <= state.dangerMs) return 'danger';
  if (left <= state.warnMs) return 'warning';
  return 'normal';
}

const pad = (n) => String(n).padStart(2, '0');

// Time shown on the stage. Remaining time is rounded up, so "00:01" stays on
// screen until the last second is over; overtime counts up with a "+".
export function formatClock(ms) {
  const overtime = ms < 0;
  const totalSeconds = overtime ? Math.floor(-ms / SECOND) : Math.ceil(ms / SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const body = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  return overtime ? `+${body}` : body;
}

// Accepts "15" or "2.5" (minutes), "15:30" (min:s), "1:15:00" (h:min:s),
// and "90s", "20m", "20min", "1h", "1h30", "1h30m", "1h30m15s".
// Returns milliseconds, or null when the text is not a duration.
export function parseDuration(text) {
  const t = String(text ?? '').trim().toLowerCase().replace(',', '.').replace(/\s+/g, '');
  if (!t) return null;

  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * MINUTE);

  if (/^\d+(:\d{1,2}){1,2}$/.test(t)) {
    const parts = t.split(':').map(Number);
    if (parts.slice(1).some((p) => p >= 60)) return null;
    const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
    return ((h * 60 + m) * 60 + s) * SECOND;
  }

  const hm = t.match(/^(\d+)h(\d{1,2})$/);
  if (hm) return (Number(hm[1]) * 60 + Number(hm[2])) * MINUTE;

  const units = t.match(/^(?:(\d+)h)?(?:(\d+)m(?:in)?)?(?:(\d+)s)?$/);
  if (units && (units[1] || units[2] || units[3])) {
    const [, h = 0, m = 0, s = 0] = units;
    return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * SECOND;
  }
  return null;
}

// The way back from parseDuration, used to fill the settings form:
// "20", "0:30", "15:30", "1h", "1h30" or "1:30:15".
export function formatDuration(ms) {
  const total = Math.round(ms / SECOND);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0 && seconds > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return minutes > 0 ? `${hours}h${pad(minutes)}` : `${hours}h`;
  if (seconds > 0) return `${minutes}:${pad(seconds)}`;
  return String(minutes);
}

// Builds the starting state from a link such as stage.html?t=20&warn=5&danger=1.
export function stateFromParams(params) {
  const read = (key, fallback) => {
    const value = params.get(key);
    const ms = value === null ? null : parseDuration(value);
    return ms ?? fallback;
  };
  return createState({
    durationMs: read('t', 15 * MINUTE),
    warnMs: read('warn', 5 * MINUTE),
    dangerMs: read('danger', 1 * MINUTE),
  });
}
