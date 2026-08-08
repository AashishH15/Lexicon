// Popup backend monitor.
// Poll the backend ping. Show connected or offline.
// While offline, keep polling: the state flips to connected as soon as
// the desktop app is opened.

export function createBackendStatus({ ping, onChange, intervalMs = 1000 }) {
  const CHECKING = "checking";
  const CONNECTED = "connected";
  const OFFLINE = "offline";

  let state = CHECKING;
  let timer = null;

  function setState(next) {
    if (next === state) return;
    state = next;
    onChange(state);
  }

  async function poll() {
    if (await ping()) {
      setState(CONNECTED);
      stop();
      return;
    }
    setState(OFFLINE);
    timer = setTimeout(poll, intervalMs);
  }

  function start() {
    stop();
    setState(CHECKING);
    poll();
  }

  function stop() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
    get state() {
      return state;
    },
  };
}
