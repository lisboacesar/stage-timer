// Node has the same BroadcastChannel as the browser, so the sync rules can be
// tested with "windows" that live in one process.
import test from 'node:test';
import assert from 'node:assert/strict';

import { connect, stamp } from '../src/sync.js';
import { MINUTE, createState, setMessage, start, stateFromParams } from '../src/timer.js';

function openWindow(initial) {
  const win = { state: initial, received: [] };
  win.sync = connect({
    getState: () => win.state,
    onState: (next) => {
      win.state = next;
      win.received.push(next);
    },
  });
  return win;
}

async function until(check) {
  for (let i = 0; i < 200; i += 1) {
    if (check()) return;
    await new Promise((resolve) => { setTimeout(resolve, 5); });
  }
  throw new Error('the channel did not deliver in time');
}

test('stamp makes every change newer than the state it came from', () => {
  const previous = { ...createState(), updatedAt: 5_000 };
  assert.equal(stamp(previous, previous, 9_000).updatedAt, 9_000);
  assert.equal(stamp(previous, previous, 5_000).updatedAt, 5_001, 'same millisecond');
  assert.equal(stamp(previous, previous, 1_000).updatedAt, 5_001, 'clock set back');
});

test('a control panel reloaded mid-talk picks up the timer running on the stage', async (t) => {
  const running = { ...start(createState({ durationMs: 20 * MINUTE }), 1_000), updatedAt: 5 };
  const stage = openWindow(running);
  const control = openWindow(createState());
  t.after(() => { stage.sync.close(); control.sync.close(); });

  await until(() => control.received.length > 0);
  assert.equal(control.state.durationMs, 20 * MINUTE);
  assert.equal(control.state.running, true);
  assert.deepEqual(stage.received, [], 'the window already open keeps its own state');
});

test('a stage opened from a link passes its settings to a control panel opened later', async (t) => {
  const stage = openWindow(stateFromParams(new URLSearchParams('t=20&warn=3')));
  const control = openWindow(createState());
  t.after(() => { stage.sync.close(); control.sync.close(); });

  await until(() => control.received.length > 0);
  assert.equal(control.state.durationMs, 20 * MINUTE);
  assert.equal(control.state.warnMs, 3 * MINUTE);
  assert.deepEqual(stage.received, []);
});

test('the newest change wins and older ones are ignored', async (t) => {
  const a = openWindow({ ...createState(), updatedAt: 10 });
  const b = openWindow({ ...createState(), updatedAt: 20 });
  t.after(() => { a.sync.close(); b.sync.close(); });

  a.sync.publish({ ...setMessage(createState(), 'antiga'), updatedAt: 15 });
  a.sync.publish({ ...setMessage(createState(), 'nova'), updatedAt: 30 });
  await until(() => b.state.message === 'nova');
  assert.deepEqual(b.received.map((s) => s.message), ['nova']);
});
