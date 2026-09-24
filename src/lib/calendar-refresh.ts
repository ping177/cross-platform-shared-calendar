export function createCalendarReadLoop(
  read: (isCurrent: () => boolean) => Promise<void>,
  onError: (error: unknown) => void,
  debounceMs = 150,
) {
  let active = true;
  let ready = false;
  let reading = false;
  let dirty = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancelTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function schedule(delay: number) {
    cancelTimer();
    if (active && ready) timer = setTimeout(() => { timer = null; void run(); }, delay);
  }

  async function run() {
    if (!active || !ready || reading) return;
    reading = true;
    dirty = false;
    const current = generation;
    const isCurrent = () => active && ready && current === generation;
    try {
      await read(isCurrent);
    } catch (error) {
      if (isCurrent()) onError(error);
    } finally {
      reading = false;
      if (active && ready && dirty) schedule(debounceMs);
    }
  }

  return {
    start() {
      if (!active) return;
      ready = true;
      generation += 1;
      dirty = true;
      if (!reading) schedule(0);
    },
    change() {
      if (!active) return;
      generation += 1;
      dirty = true;
      if (ready && !reading) schedule(debounceMs);
    },
    pause() {
      ready = false;
      generation += 1;
      cancelTimer();
    },
    stop() {
      active = false;
      ready = false;
      generation += 1;
      cancelTimer();
    },
  };
}
