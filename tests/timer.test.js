import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MINUTE, SECOND, addTime, configure, createState, elapsed, formatClock, formatDuration,
  parseDuration, pause, phase, progress, remaining, reset, setMessage, start, stateFromParams,
  toggle, totalMs,
} from '../src/timer.js';

test('formatClock rounds remaining time up and shows overtime with a plus sign', () => {
  assert.equal(formatClock(15 * MINUTE), '15:00');
  assert.equal(formatClock(61 * SECOND), '01:01');
  assert.equal(formatClock(999), '00:01');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(-500), '+00:00');
  assert.equal(formatClock(-65 * SECOND), '+01:05');
  assert.equal(formatClock(90 * MINUTE), '1:30:00');
  assert.equal(formatClock(-(60 * MINUTE + 1 * SECOND)), '+1:00:01');
});

test('parseDuration understands the formats the control panel accepts', () => {
  assert.equal(parseDuration('15'), 15 * MINUTE);
  assert.equal(parseDuration('2,5'), 150 * SECOND);
  assert.equal(parseDuration('15:30'), 15 * MINUTE + 30 * SECOND);
  assert.equal(parseDuration('90:00'), 90 * MINUTE);
  assert.equal(parseDuration('1:15:00'), 75 * MINUTE);
  assert.equal(parseDuration('90s'), 90 * SECOND);
  assert.equal(parseDuration('20m'), 20 * MINUTE);
  assert.equal(parseDuration('20min'), 20 * MINUTE);
  assert.equal(parseDuration('1h'), 60 * MINUTE);
  assert.equal(parseDuration('1h30'), 90 * MINUTE);
  assert.equal(parseDuration('1h30m'), 90 * MINUTE);
  assert.equal(parseDuration(' 1h 30m 15s '), 90 * MINUTE + 15 * SECOND);
});

test('parseDuration rejects text that is not a duration', () => {
  for (const bad of ['', '   ', 'abc', '15:75', '1:2:3:4', 'h', 'm30', '-5', null, undefined]) {
    assert.equal(parseDuration(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('formatDuration writes durations in a format parseDuration reads back', () => {
  assert.equal(formatDuration(20 * MINUTE), '20');
  assert.equal(formatDuration(30 * SECOND), '0:30');
  assert.equal(formatDuration(90 * MINUTE), '1h30');
  const samples = [0, 30 * SECOND, 90 * SECOND, 15 * MINUTE + 30 * SECOND, 60 * MINUTE, 65 * MINUTE,
    90 * MINUTE + 15 * SECOND];
  for (const ms of samples) {
    assert.equal(parseDuration(formatDuration(ms)), ms, `round trip of ${ms} ms`);
  }
});

test('start and pause accumulate elapsed time across pauses', () => {
  let s = createState({ durationMs: 10 * MINUTE });
  s = start(s, 1_000);
  assert.equal(elapsed(s, 61_000), MINUTE);
  s = pause(s, 61_000);
  assert.equal(elapsed(s, 999_999), MINUTE, 'paused time does not count');
  s = start(s, 100_000);
  assert.equal(elapsed(s, 130_000), MINUTE + 30 * SECOND);
  assert.equal(remaining(s, 130_000), 8 * MINUTE + 30 * SECOND);
});

test('start and pause are idempotent and toggle switches between them', () => {
  const s = start(createState(), 0);
  assert.equal(start(s, 5_000), s);
  const p = pause(s, 5_000);
  assert.equal(pause(p, 9_000), p);
  assert.equal(toggle(p, 10_000).running, true);
  assert.equal(toggle(s, 10_000).running, false);
});

test('phase follows the warning thresholds and goes to overtime after zero', () => {
  let s = createState({ durationMs: 10 * MINUTE, warnMs: 5 * MINUTE, dangerMs: 1 * MINUTE });
  assert.equal(phase(s, 0), 'ready');
  s = start(s, 0);
  assert.equal(phase(s, 1 * MINUTE), 'normal');
  assert.equal(phase(s, 5 * MINUTE), 'warning');
  assert.equal(phase(s, 9 * MINUTE), 'danger');
  assert.equal(phase(s, 10 * MINUTE), 'danger');
  assert.equal(phase(s, 10 * MINUTE + 1), 'overtime');
  const paused = pause(s, 7 * MINUTE);
  assert.equal(phase(paused, 99 * MINUTE), 'warning', 'a paused timer keeps its phase');
  assert.equal(phase(reset(paused), 99 * MINUTE), 'ready');
});

test('addTime changes only the current talk and reset goes back to the configured time', () => {
  let s = start(createState({ durationMs: 2 * MINUTE }), 0);
  s = addTime(s, MINUTE);
  assert.equal(remaining(s, MINUTE), 2 * MINUTE, 'the time already spent is kept');
  assert.equal(s.durationMs, 2 * MINUTE, 'the configuration does not change');
  assert.equal(totalMs(addTime(s, -10 * MINUTE)), 0, 'a talk never gets negative time');
  assert.equal(remaining(reset(s), 0), 2 * MINUTE);
});

test('progress goes from 0 to 1 and stays there in overtime', () => {
  const s = start(createState({ durationMs: 4 * MINUTE }), 0);
  assert.equal(progress(s, 0), 0);
  assert.equal(progress(s, MINUTE), 0.25);
  assert.equal(progress(s, 9 * MINUTE), 1);
  assert.equal(progress(createState({ durationMs: 0 }), 0), 1);
});

test('configure resets the timer and keeps the message', () => {
  let s = setMessage(addTime(start(createState(), 0), MINUTE), '  Hora das perguntas ');
  assert.equal(s.message, 'Hora das perguntas');
  s = configure(s, { durationMs: 20 * MINUTE, warnMs: 3 * MINUTE, dangerMs: 30 * SECOND });
  assert.equal(s.running, false);
  assert.equal(elapsed(s, 999_999), 0);
  assert.equal(totalMs(s), 20 * MINUTE);
  assert.equal(s.message, 'Hora das perguntas');
});

test('stateFromParams reads the stage link and falls back to defaults', () => {
  const s = stateFromParams(new URLSearchParams('t=20&warn=3&danger=0:30'));
  assert.equal(s.durationMs, 20 * MINUTE);
  assert.equal(s.warnMs, 3 * MINUTE);
  assert.equal(s.dangerMs, 30 * SECOND);
  const d = stateFromParams(new URLSearchParams('t=banana'));
  assert.equal(d.durationMs, 15 * MINUTE);
  assert.equal(d.warnMs, 5 * MINUTE);
  assert.equal(d.dangerMs, MINUTE);
});
