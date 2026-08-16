// Poll the Lexicon backend and report connected or offline.

export function createBackendStatus({ ping, onChange, intervalMs = 1000 }) {
  const CHECKING = "checking";
  const CONNECTED = "connected";
  const OFFLINE = "offline";

  let state = CHECKING;
  let timer = null;
  let pollGeneration = 0;

  function setState(next) {
    if (next === state) return;
    state = next;
    onChange(state);
  }

  async function poll(generation) {
    let connected = false;
    try {
      connected = await ping();
    } catch {
      connected = false;
    }
    if (generation !== pollGeneration) return;
    setState(connected ? CONNECTED : OFFLINE);
    timer = setTimeout(() => poll(generation), intervalMs);
  }

  function start() {
    stop();
    const generation = ++pollGeneration;
    setState(CHECKING);
    poll(generation);
  }

  function stop() {
    pollGeneration += 1;
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
