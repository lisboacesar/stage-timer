// Keeps the control panel and the stage screens in step.
// All windows run in the same browser on the same computer, so they share the
// clock: only the timer state travels between them.
//
// Every change carries updatedAt and the newest one wins. A window that has not
// changed anything yet (updatedAt 0) takes the state of the windows already
// open, so a control panel reloaded in the middle of a talk picks up the timer
// that is running on the stage.

const CHANNEL = 'stage-timer';

// Marks a change made in this window. It always comes out newer than the state
// it was made from, even when two changes land in the same millisecond or the
// system clock is set back during the event.
export function stamp(next, previous, now) {
  return { ...next, updatedAt: Math.max(now, previous.updatedAt + 1) };
}

export function connect({ getState, onState }) {
  if (!('BroadcastChannel' in globalThis)) {
    return { publish() {}, close() {} };
  }
  const channel = new BroadcastChannel(CHANNEL);

  channel.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg?.type === 'hello') {
      channel.postMessage({ type: 'state', state: getState() });
    } else if (msg?.type === 'state') {
      const current = getState();
      if (msg.state.updatedAt > current.updatedAt || current.updatedAt === 0) onState(msg.state);
    }
  });

  channel.postMessage({ type: 'hello' });

  return {
    publish(state) {
      channel.postMessage({ type: 'state', state });
    },
    close() {
      channel.close();
    },
  };
}
